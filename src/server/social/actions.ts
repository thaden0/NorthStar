'use server';

import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

export interface ActionResult {
  success: boolean;
  error?: string;
  data?: unknown;
}

// ==================== HELPERS ====================
async function checkAuth(): Promise<{ success: true; userId: string } | { success: false; error: string }> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: 'Unauthorized' };
  }
  return { success: true, userId: session.userId };
}

// ==================== USER STATUS ====================

export async function updateUserStatus(status: string, statusMessage?: string): Promise<ActionResult> {
  const auth = await checkAuth();
  if (!auth.success) return auth;

  await db.userStatus.upsert({
    where: { userId: auth.userId },
    create: {
      userId: auth.userId,
      currentStatus: status,
      statusMessage: statusMessage || null,
      isOnline: true,
      lastSeenAt: new Date(),
    },
    update: {
      currentStatus: status,
      statusMessage: statusMessage || null,
      isOnline: true,
      lastSeenAt: new Date(),
    },
  });

  revalidatePath('/dashboard/social');
  return { success: true };
}

export async function setOnlineStatus(online: boolean): Promise<ActionResult> {
  const auth = await checkAuth();
  if (!auth.success) return auth;

  await db.userStatus.upsert({
    where: { userId: auth.userId },
    create: {
      userId: auth.userId,
      isOnline: online,
      lastSeenAt: new Date(),
    },
    update: {
      isOnline: online,
      lastSeenAt: new Date(),
    },
  });

  return { success: true };
}

export async function getUserStatus(): Promise<ActionResult> {
  const auth = await checkAuth();
  if (!auth.success) return auth;

  const status = await db.userStatus.findUnique({
    where: { userId: auth.userId },
  });

  return { success: true, data: status };
}

// ==================== FRIENDSHIPS ====================

export async function getFriends(): Promise<ActionResult> {
  const auth = await checkAuth();
  if (!auth.success) return auth;

  // Get all accepted friendships where user is either requester or addressee
  const friendships = await db.friendship.findMany({
    where: {
      OR: [
        { requesterId: auth.userId, status: 'accepted' },
        { addresseeId: auth.userId, status: 'accepted' },
      ],
    },
    include: {
      requester: {
        select: { id: true, name: true, email: true, avatar: true },
      },
      addressee: {
        select: { id: true, name: true, email: true, avatar: true },
      },
    },
  });

  // Extract the friend (the other user in the friendship)
  const friends = await Promise.all(
    friendships.map(async (f) => {
      const friend = f.requesterId === auth.userId ? f.addressee : f.requester;
      // Get their online status
      const status = await db.userStatus.findUnique({
        where: { userId: friend.id },
      });
      return {
        ...friend,
        friendshipId: f.id,
        status: status || { isOnline: false, currentStatus: 'offline', lastSeenAt: null },
      };
    })
  );

  return { success: true, data: friends };
}

export async function getPendingFriendRequests(): Promise<ActionResult> {
  const auth = await checkAuth();
  if (!auth.success) return auth;

  // Get requests sent TO the current user
  const incoming = await db.friendship.findMany({
    where: {
      addresseeId: auth.userId,
      status: 'pending',
    },
    include: {
      requester: {
        select: { id: true, name: true, email: true, avatar: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Get requests sent BY the current user
  const outgoing = await db.friendship.findMany({
    where: {
      requesterId: auth.userId,
      status: 'pending',
    },
    include: {
      addressee: {
        select: { id: true, name: true, email: true, avatar: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return {
    success: true,
    data: {
      incoming: incoming.map((r) => ({ ...r, user: r.requester })),
      outgoing: outgoing.map((r) => ({ ...r, user: r.addressee })),
    },
  };
}

export async function sendFriendRequest(email: string): Promise<ActionResult> {
  const auth = await checkAuth();
  if (!auth.success) return auth;

  // Find user by email
  const targetUser = await db.user.findUnique({
    where: { email: email.toLowerCase().trim() },
    select: { id: true, name: true, email: true },
  });

  if (!targetUser) {
    return { success: false, error: 'User not found with that email' };
  }

  if (targetUser.id === auth.userId) {
    return { success: false, error: 'You cannot send a friend request to yourself' };
  }

  // Check if friendship already exists (in either direction)
  const existingFriendship = await db.friendship.findFirst({
    where: {
      OR: [
        { requesterId: auth.userId, addresseeId: targetUser.id },
        { requesterId: targetUser.id, addresseeId: auth.userId },
      ],
    },
  });

  if (existingFriendship) {
    if (existingFriendship.status === 'accepted') {
      return { success: false, error: 'You are already friends with this user' };
    }
    if (existingFriendship.status === 'pending') {
      return { success: false, error: 'A friend request already exists' };
    }
    if (existingFriendship.status === 'blocked') {
      return { success: false, error: 'This user cannot be added as a friend' };
    }
  }

  // Create friend request
  await db.friendship.create({
    data: {
      requesterId: auth.userId,
      addresseeId: targetUser.id,
      status: 'pending',
    },
  });

  revalidatePath('/dashboard/social');
  return { success: true, data: { message: `Friend request sent to ${targetUser.name}` } };
}

export async function respondToFriendRequest(friendshipId: string, action: 'accept' | 'decline'): Promise<ActionResult> {
  const auth = await checkAuth();
  if (!auth.success) return auth;

  const friendship = await db.friendship.findFirst({
    where: {
      id: friendshipId,
      addresseeId: auth.userId,
      status: 'pending',
    },
    include: {
      requester: { select: { name: true } },
    },
  });

  if (!friendship) {
    return { success: false, error: 'Friend request not found' };
  }

  if (action === 'accept') {
    await db.friendship.update({
      where: { id: friendshipId },
      data: {
        status: 'accepted',
        acceptedAt: new Date(),
      },
    });

    // Create a notification for the requester
    await db.notification.create({
      data: {
        userId: friendship.requesterId,
        type: 'friend_accepted',
        title: 'Friend Request Accepted',
        message: `Your friend request has been accepted!`,
      },
    });
  } else {
    await db.friendship.update({
      where: { id: friendshipId },
      data: { status: 'declined' },
    });
  }

  revalidatePath('/dashboard/social');
  return { success: true };
}

export async function removeFriend(friendshipId: string): Promise<ActionResult> {
  const auth = await checkAuth();
  if (!auth.success) return auth;

  const friendship = await db.friendship.findFirst({
    where: {
      id: friendshipId,
      OR: [
        { requesterId: auth.userId },
        { addresseeId: auth.userId },
      ],
    },
  });

  if (!friendship) {
    return { success: false, error: 'Friendship not found' };
  }

  await db.friendship.delete({
    where: { id: friendshipId },
  });

  revalidatePath('/dashboard/social');
  return { success: true };
}

// ==================== MESSAGES ====================

export async function getConversations(): Promise<ActionResult> {
  const auth = await checkAuth();
  if (!auth.success) return auth;

  // Get the last message with each user
  const messages = await db.message.findMany({
    where: {
      OR: [
        { senderId: auth.userId },
        { receiverId: auth.userId },
      ],
    },
    orderBy: { createdAt: 'desc' },
    include: {
      sender: { select: { id: true, name: true, avatar: true } },
      receiver: { select: { id: true, name: true, avatar: true } },
    },
  });

  // Group by conversation partner
  const conversationsMap = new Map<string, {
    user: { id: string; name: string; avatar: string | null };
    lastMessage: typeof messages[0];
    unreadCount: number;
  }>();

  for (const msg of messages) {
    const partnerId = msg.senderId === auth.userId ? msg.receiverId : msg.senderId;
    const partner = msg.senderId === auth.userId ? msg.receiver : msg.sender;

    if (!conversationsMap.has(partnerId)) {
      // Count unread messages from this partner
      const unreadCount = messages.filter(
        (m) => m.senderId === partnerId && m.receiverId === auth.userId && !m.isRead
      ).length;

      conversationsMap.set(partnerId, {
        user: partner,
        lastMessage: msg,
        unreadCount,
      });
    }
  }

  const conversations = Array.from(conversationsMap.values());

  return { success: true, data: conversations };
}

export async function getMessages(partnerId: string): Promise<ActionResult> {
  const auth = await checkAuth();
  if (!auth.success) return auth;

  const messages = await db.message.findMany({
    where: {
      OR: [
        { senderId: auth.userId, receiverId: partnerId },
        { senderId: partnerId, receiverId: auth.userId },
      ],
    },
    orderBy: { createdAt: 'asc' },
    include: {
      sender: { select: { id: true, name: true, avatar: true } },
    },
  });

  // Mark messages as read
  await db.message.updateMany({
    where: {
      senderId: partnerId,
      receiverId: auth.userId,
      isRead: false,
    },
    data: {
      isRead: true,
      readAt: new Date(),
    },
  });

  return { success: true, data: messages };
}

export async function sendMessage(receiverId: string, content: string): Promise<ActionResult> {
  const auth = await checkAuth();
  if (!auth.success) return auth;

  if (!content.trim()) {
    return { success: false, error: 'Message cannot be empty' };
  }

  // Verify friendship exists
  const friendship = await db.friendship.findFirst({
    where: {
      status: 'accepted',
      OR: [
        { requesterId: auth.userId, addresseeId: receiverId },
        { requesterId: receiverId, addresseeId: auth.userId },
      ],
    },
  });

  if (!friendship) {
    return { success: false, error: 'You can only message friends' };
  }

  const message = await db.message.create({
    data: {
      senderId: auth.userId,
      receiverId,
      content: content.trim(),
      isInternal: true,
      platform: 'internal',
    },
    include: {
      sender: { select: { id: true, name: true, avatar: true } },
    },
  });

  // Create notification for internal messages
  const sender = await db.user.findUnique({
    where: { id: auth.userId },
    select: { name: true },
  });

  await db.notification.create({
    data: {
      userId: receiverId,
      type: 'message',
      title: 'New Message',
      message: `${sender?.name || 'Someone'} sent you a message`,
    },
  });

  revalidatePath('/dashboard/social');
  return { success: true, data: message };
}

export async function getUnreadMessageCount(): Promise<ActionResult> {
  const auth = await checkAuth();
  if (!auth.success) return auth;

  const count = await db.message.count({
    where: {
      receiverId: auth.userId,
      isRead: false,
    },
  });

  return { success: true, data: count };
}

// ==================== SOCIAL ACCOUNTS ====================

export async function getSocialAccounts(): Promise<ActionResult> {
  const auth = await checkAuth();
  if (!auth.success) return auth;

  const accounts = await db.socialAccount.findMany({
    where: { userId: auth.userId },
    orderBy: { provider: 'asc' },
  });

  return { success: true, data: accounts };
}

export async function disconnectSocialAccount(provider: string): Promise<ActionResult> {
  const auth = await checkAuth();
  if (!auth.success) return auth;

  await db.socialAccount.deleteMany({
    where: {
      userId: auth.userId,
      provider,
    },
  });

  revalidatePath('/dashboard/social');
  return { success: true };
}

// ==================== SEARCH USERS ====================

export async function searchUsers(query: string): Promise<ActionResult> {
  const auth = await checkAuth();
  if (!auth.success) return auth;

  if (!query || query.length < 2) {
    return { success: true, data: [] };
  }

  const users = await db.user.findMany({
    where: {
      AND: [
        { id: { not: auth.userId } },
        {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { email: { contains: query, mode: 'insensitive' } },
          ],
        },
      ],
    },
    select: {
      id: true,
      name: true,
      email: true,
      avatar: true,
    },
    take: 10,
  });

  // Check friendship status for each user
  const usersWithStatus = await Promise.all(
    users.map(async (user) => {
      const friendship = await db.friendship.findFirst({
        where: {
          OR: [
            { requesterId: auth.userId, addresseeId: user.id },
            { requesterId: user.id, addresseeId: auth.userId },
          ],
        },
      });
      return {
        ...user,
        friendshipStatus: friendship?.status || null,
      };
    })
  );

  return { success: true, data: usersWithStatus };
}
