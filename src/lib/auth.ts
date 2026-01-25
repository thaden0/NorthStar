import { cookies } from 'next/headers';
import { db } from './db';
import bcrypt from 'bcryptjs';

const SESSION_COOKIE_NAME = 'north_star_session';
const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  avatar: string | null;
  roles: string[];
}

export interface Session {
  userId: string;
  user: SessionUser;
}

// ==================== PASSWORD UTILS ====================
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

// ==================== SESSION MANAGEMENT ====================
export async function createSession(userId: string): Promise<string> {
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE * 1000);
  
  const session = await db.session.create({
    data: {
      userId,
      expiresAt,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, session.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE,
    path: '/',
  });

  return session.id;
}

export async function getSession(): Promise<Session | null> {
  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (!sessionId) {
      return null;
    }

    const session = await db.session.findUnique({
      where: { id: sessionId },
      include: {
        user: {
          include: {
            roles: {
              include: {
                role: true,
              },
            },
          },
        },
      },
    });

    if (!session || session.expiresAt < new Date()) {
      if (session) {
        await db.session.delete({ where: { id: sessionId } });
      }
      return null;
    }

    return {
      userId: session.userId,
      user: {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        avatar: session.user.avatar,
        roles: session.user.roles.map((r: { role: { name: string } }) => r.role.name),
      },
    };
  } catch {
    return null;
  }
}

export async function invalidateSession(): Promise<void> {
  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (sessionId) {
      await db.session.delete({ where: { id: sessionId } }).catch(() => {});
    }

    cookieStore.delete(SESSION_COOKIE_NAME);
  } catch {
    // Ignore errors during logout
  }
}

// ==================== AUTH HELPERS ====================
export async function requireAuth(): Promise<Session> {
  const session = await getSession();
  if (!session) {
    throw new Error('Unauthorized');
  }
  return session;
}

export function hasRole(session: Session, ...roles: string[]): boolean {
  return session.user.roles.some((role) => roles.includes(role));
}

export function isSuperAdmin(session: Session): boolean {
  return hasRole(session, 'Super Admin');
}

export function isAdmin(session: Session): boolean {
  return hasRole(session, 'Super Admin', 'Admin');
}

// ==================== USER OPERATIONS ====================
export async function authenticateUser(email: string, password: string) {
  const user = await db.user.findUnique({
    where: { email: email.toLowerCase() },
    include: {
      roles: {
        include: {
          role: true,
        },
      },
    },
  });

  if (!user) {
    return null;
  }

  const isValid = await verifyPassword(password, user.hashedPassword);
  if (!isValid) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatar: user.avatar,
    roles: user.roles.map((r: { role: { name: string } }) => r.role.name),
  };
}

export async function createUser(data: {
  email: string;
  password: string;
  name: string;
}) {
  const hashedPassword = await hashPassword(data.password);

  const user = await db.user.create({
    data: {
      email: data.email.toLowerCase(),
      hashedPassword,
      name: data.name,
    },
  });

  // Assign default "User" role
  const userRole = await db.role.findUnique({ where: { name: 'User' } });
  if (userRole) {
    await db.userRole.create({
      data: {
        userId: user.id,
        roleId: userRole.id,
      },
    });
  }

  return user;
}

/**
 * Get the current authenticated user (or null if not authenticated)
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await getSession();
  return session?.user ?? null;
}

// ==================== SERVICE TOKEN GENERATION ====================
/**
 * Generate a JWT token for inter-service communication
 * This token is used to call Agent Service, Google Service, etc.
 */
export async function generateServiceToken(userId: string, email?: string): Promise<string> {
  // Use the same JWT configuration as the services
  const secret = process.env.JWT_SECRET || 'northstar-agent-service-secret-key-2026';
  const issuer = process.env.JWT_ISSUER || 'north-star';
  const audience = process.env.JWT_AUDIENCE || 'google-service';

  // Create a simple JWT manually (or use jose library)
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: userId,
    email: email,
    iat: now,
    exp: now + 3600, // 1 hour expiry
    iss: issuer,
    aud: audience,
  };

  const base64Header = Buffer.from(JSON.stringify(header)).toString('base64url');
  const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signingInput = `${base64Header}.${base64Payload}`;

  // Use crypto for HMAC-SHA256 signature
  const crypto = await import('crypto');
  const signature = crypto
    .createHmac('sha256', secret)
    .update(signingInput)
    .digest('base64url');

  return `${signingInput}.${signature}`;
}

