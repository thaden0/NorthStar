'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  FiSearch, 
  FiSend, 
  FiUserPlus, 
  FiMessageCircle, 
  FiUsers,
  FiCheck,
  FiX,
  FiLink,
  FiCircle
} from 'react-icons/fi';
import { 
  FaFacebook, 
  FaLinkedin, 
  FaDiscord, 
  FaTwitter, 
  FaGithub 
} from 'react-icons/fa';
import { toast } from 'sonner';
import {
  getFriends,
  getPendingFriendRequests,
  sendFriendRequest,
  respondToFriendRequest,
  getMessages,
  sendMessage,
  getSocialAccounts,
  getUserStatus,
  updateUserStatus,
  searchUsers,
} from '@/server/social/actions';
import styles from './social.module.css';

interface Friend {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  friendshipId: string;
  status: {
    isOnline: boolean;
    currentStatus: string;
    lastSeenAt: Date | null;
  };
}

interface Message {
  id: string;
  senderId: string;
  content: string;
  createdAt: string;
  sender: {
    id: string;
    name: string;
    avatar: string | null;
  };
}

interface FriendRequest {
  id: string;
  user: {
    id: string;
    name: string;
    email: string;
    avatar: string | null;
  };
  createdAt: string;
}

interface SocialAccount {
  id: string;
  provider: string;
  username: string | null;
  isActive: boolean;
}

interface SearchResult {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  friendshipStatus: string | null;
}

const SOCIAL_PROVIDERS = [
  { id: 'facebook', name: 'Facebook', icon: FaFacebook, color: '#1877F2' },
  { id: 'linkedin', name: 'LinkedIn', icon: FaLinkedin, color: '#0A66C2' },
  { id: 'discord', name: 'Discord', icon: FaDiscord, color: '#5865F2' },
  { id: 'twitter', name: 'Twitter/X', icon: FaTwitter, color: '#1DA1F2' },
  { id: 'github', name: 'GitHub', icon: FaGithub, color: '#6e5494' },
];

const STATUS_OPTIONS = [
  { id: 'available', label: 'Available', color: '#22c55e' },
  { id: 'busy', label: 'Busy', color: '#ef4444' },
  { id: 'away', label: 'Away', color: '#f59e0b' },
  { id: 'dnd', label: 'Do Not Disturb', color: '#6b7280' },
];

export default function SocialPage() {
  // State
  const [friends, setFriends] = useState<Friend[]>([]);
  const [pendingRequests, setPendingRequests] = useState<{ incoming: FriendRequest[]; outgoing: FriendRequest[] }>({ incoming: [], outgoing: [] });
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [socialAccounts, setSocialAccounts] = useState<SocialAccount[]>([]);
  const [currentStatus, setCurrentStatus] = useState('available');
  const [statusMessage, setStatusMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [activeTab, setActiveTab] = useState<'friends' | 'requests'>('friends');
  const [loading, setLoading] = useState(true);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load initial data
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [friendsRes, requestsRes, accountsRes, statusRes] = await Promise.all([
          getFriends(),
          getPendingFriendRequests(),
          getSocialAccounts(),
          getUserStatus(),
        ]);

        if (friendsRes.success && friendsRes.data) {
          setFriends(friendsRes.data as Friend[]);
        }
        if (requestsRes.success && requestsRes.data) {
          setPendingRequests(requestsRes.data as { incoming: FriendRequest[]; outgoing: FriendRequest[] });
        }
        if (accountsRes.success && accountsRes.data) {
          setSocialAccounts(accountsRes.data as SocialAccount[]);
        }
        if (statusRes.success && statusRes.data) {
          const status = statusRes.data as { currentStatus: string; statusMessage: string | null };
          setCurrentStatus(status.currentStatus);
          setStatusMessage(status.statusMessage || '');
        }
      } catch (error) {
        console.error('Failed to load social data:', error);
        toast.error('Failed to load social data');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Load messages when friend is selected
  useEffect(() => {
    if (selectedFriend) {
      loadMessages(selectedFriend.id);
    }
  }, [selectedFriend]);

  // Scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Search users with debounce
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (searchQuery.length >= 2) {
      searchTimeoutRef.current = setTimeout(async () => {
        const result = await searchUsers(searchQuery);
        if (result.success && result.data) {
          setSearchResults(result.data as SearchResult[]);
        }
      }, 300);
    } else {
      setSearchResults([]);
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  const loadMessages = async (friendId: string) => {
    const result = await getMessages(friendId);
    if (result.success && result.data) {
      setMessages(result.data as Message[]);
    }
  };

  const handleSendMessage = async () => {
    if (!selectedFriend || !newMessage.trim()) return;

    const result = await sendMessage(selectedFriend.id, newMessage);
    if (result.success) {
      setNewMessage('');
      await loadMessages(selectedFriend.id);
    } else {
      toast.error(result.error || 'Failed to send message');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleSendFriendRequest = async (email: string) => {
    const result = await sendFriendRequest(email);
    if (result.success) {
      toast.success('Friend request sent!');
      setSearchQuery('');
      setSearchResults([]);
      // Reload pending requests
      const requestsRes = await getPendingFriendRequests();
      if (requestsRes.success && requestsRes.data) {
        setPendingRequests(requestsRes.data as { incoming: FriendRequest[]; outgoing: FriendRequest[] });
      }
    } else {
      toast.error(result.error || 'Failed to send friend request');
    }
  };

  const handleRespondToRequest = async (requestId: string, action: 'accept' | 'decline') => {
    const result = await respondToFriendRequest(requestId, action);
    if (result.success) {
      toast.success(action === 'accept' ? 'Friend request accepted!' : 'Friend request declined');
      // Reload data
      const [friendsRes, requestsRes] = await Promise.all([
        getFriends(),
        getPendingFriendRequests(),
      ]);
      if (friendsRes.success && friendsRes.data) {
        setFriends(friendsRes.data as Friend[]);
      }
      if (requestsRes.success && requestsRes.data) {
        setPendingRequests(requestsRes.data as { incoming: FriendRequest[]; outgoing: FriendRequest[] });
      }
    } else {
      toast.error(result.error || 'Failed to respond to request');
    }
  };

  const handleStatusChange = async (status: string) => {
    setCurrentStatus(status);
    await updateUserStatus(status, statusMessage);
  };

  const handleStatusMessageChange = useCallback(
    async (message: string) => {
      setStatusMessage(message);
      // Debounce the update
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      searchTimeoutRef.current = setTimeout(async () => {
        await updateUserStatus(currentStatus, message);
      }, 500);
    },
    [currentStatus]
  );

  const getStatusClass = (status: string, isOnline: boolean) => {
    if (!isOnline) return styles.statusOffline;
    switch (status) {
      case 'available':
        return styles.statusOnline;
      case 'away':
        return styles.statusAway;
      case 'busy':
      case 'dnd':
        return styles.statusBusy;
      default:
        return styles.statusOffline;
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'var(--text-muted)' }}>
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Left Panel - Friends & Requests */}
      <div className={styles.leftPanel}>
        {/* Search / Add Friend */}
        <div className={styles.card}>
          <div className={styles.cardBody}>
            <div className={styles.searchWrapper}>
              <FiSearch className={styles.searchIcon} />
              <input
                type="text"
                className={styles.searchInput}
                placeholder="Search users by email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className={styles.friendsList}>
                {searchResults.map((user) => (
                  <div key={user.id} className={styles.friendItem}>
                    <div className={styles.friendAvatar}>
                      {user.avatar ? (
                        <img src={user.avatar} alt={user.name} />
                      ) : (
                        <div className={styles.avatarFallback}>{getInitials(user.name)}</div>
                      )}
                    </div>
                    <div className={styles.friendInfo}>
                      <div className={styles.friendName}>{user.name}</div>
                      <div className={styles.friendStatus}>{user.email}</div>
                    </div>
                    {user.friendshipStatus === null && (
                      <button
                        className={styles.btnAccept}
                        onClick={() => handleSendFriendRequest(user.email)}
                      >
                        <FiUserPlus size={14} />
                      </button>
                    )}
                    {user.friendshipStatus === 'pending' && (
                      <span className={styles.requestBadge}>Pending</span>
                    )}
                    {user.friendshipStatus === 'accepted' && (
                      <span className={styles.requestBadge} style={{ background: '#22c55e' }}>Friend</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Friends / Requests Tabs */}
        <div className={styles.card} style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div className={styles.cardHeader}>
            <div className={styles.sectionTabs}>
              <button
                className={`${styles.sectionTab} ${activeTab === 'friends' ? styles.sectionTabActive : ''}`}
                onClick={() => setActiveTab('friends')}
              >
                <FiUsers size={12} /> Friends ({friends.length})
              </button>
              <button
                className={`${styles.sectionTab} ${activeTab === 'requests' ? styles.sectionTabActive : ''}`}
                onClick={() => setActiveTab('requests')}
              >
                <FiUserPlus size={12} /> Requests
                {pendingRequests.incoming.length > 0 && (
                  <span className={styles.requestBadge} style={{ marginLeft: '0.25rem' }}>
                    {pendingRequests.incoming.length}
                  </span>
                )}
              </button>
            </div>
          </div>
          <div className={styles.cardBody} style={{ flex: 1, overflow: 'auto' }}>
            {activeTab === 'friends' ? (
              friends.length > 0 ? (
                <div className={styles.friendsList}>
                  {friends.map((friend) => (
                    <div
                      key={friend.id}
                      className={`${styles.friendItem} ${selectedFriend?.id === friend.id ? styles.friendItemActive : ''}`}
                      onClick={() => setSelectedFriend(friend)}
                    >
                      <div className={styles.friendAvatar}>
                        {friend.avatar ? (
                          <img src={friend.avatar} alt={friend.name} />
                        ) : (
                          <div className={styles.avatarFallback}>{getInitials(friend.name)}</div>
                        )}
                        <span
                          className={`${styles.statusIndicator} ${getStatusClass(friend.status.currentStatus, friend.status.isOnline)}`}
                        />
                      </div>
                      <div className={styles.friendInfo}>
                        <div className={styles.friendName}>{friend.name}</div>
                        <div className={styles.friendStatus}>
                          {friend.status.isOnline
                            ? STATUS_OPTIONS.find((s) => s.id === friend.status.currentStatus)?.label || 'Online'
                            : 'Offline'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className={styles.emptyState}>
                  <FiUsers className={styles.emptyStateIcon} />
                  <p className={styles.emptyStateText}>
                    No friends yet. Search for users to add!
                  </p>
                </div>
              )
            ) : (
              <>
                {pendingRequests.incoming.length > 0 && (
                  <>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                      Incoming Requests
                    </div>
                    {pendingRequests.incoming.map((request) => (
                      <div key={request.id} className={styles.requestItem}>
                        <div className={styles.friendAvatar}>
                          {request.user.avatar ? (
                            <img src={request.user.avatar} alt={request.user.name} />
                          ) : (
                            <div className={styles.avatarFallback}>{getInitials(request.user.name)}</div>
                          )}
                        </div>
                        <div className={styles.friendInfo}>
                          <div className={styles.friendName}>{request.user.name}</div>
                          <div className={styles.friendStatus}>{request.user.email}</div>
                        </div>
                        <div className={styles.requestActions}>
                          <button
                            className={styles.btnAccept}
                            onClick={() => handleRespondToRequest(request.id, 'accept')}
                          >
                            <FiCheck size={14} />
                          </button>
                          <button
                            className={styles.btnDecline}
                            onClick={() => handleRespondToRequest(request.id, 'decline')}
                          >
                            <FiX size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </>
                )}
                {pendingRequests.outgoing.length > 0 && (
                  <>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '1rem', marginBottom: '0.5rem' }}>
                      Outgoing Requests
                    </div>
                    {pendingRequests.outgoing.map((request) => (
                      <div key={request.id} className={styles.friendItem}>
                        <div className={styles.friendAvatar}>
                          {request.user.avatar ? (
                            <img src={request.user.avatar} alt={request.user.name} />
                          ) : (
                            <div className={styles.avatarFallback}>{getInitials(request.user.name)}</div>
                          )}
                        </div>
                        <div className={styles.friendInfo}>
                          <div className={styles.friendName}>{request.user.name}</div>
                          <div className={styles.friendStatus}>Pending...</div>
                        </div>
                      </div>
                    ))}
                  </>
                )}
                {pendingRequests.incoming.length === 0 && pendingRequests.outgoing.length === 0 && (
                  <div className={styles.emptyState}>
                    <FiUserPlus className={styles.emptyStateIcon} />
                    <p className={styles.emptyStateText}>No pending requests</p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Center Panel - Chat */}
      <div className={styles.centerPanel}>
        <div className={styles.card} style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {selectedFriend ? (
            <div className={styles.chatContainer}>
              <div className={styles.chatHeader}>
                <div className={styles.chatAvatar}>
                  {selectedFriend.avatar ? (
                    <img src={selectedFriend.avatar} alt={selectedFriend.name} />
                  ) : (
                    <div className={styles.avatarFallback}>{getInitials(selectedFriend.name)}</div>
                  )}
                </div>
                <div className={styles.chatUserInfo}>
                  <div className={styles.chatUserName}>{selectedFriend.name}</div>
                  <div className={styles.chatUserStatus}>
                    {selectedFriend.status.isOnline ? 'Online' : 'Offline'}
                  </div>
                </div>
              </div>
              <div className={styles.chatMessages}>
                {messages.length === 0 ? (
                  <div className={styles.emptyState}>
                    <FiMessageCircle className={styles.emptyStateIcon} />
                    <p className={styles.emptyStateText}>No messages yet. Start the conversation!</p>
                  </div>
                ) : (
                  messages.map((msg, idx) => {
                    const isOutgoing = msg.sender.id !== selectedFriend.id;
                    const showTime = idx === 0 || 
                      new Date(messages[idx].createdAt).getTime() - new Date(messages[idx - 1].createdAt).getTime() > 300000;
                    
                    return (
                      <div key={msg.id}>
                        {showTime && (
                          <div className={`${styles.messageTime} ${isOutgoing ? styles.messageTimeOutgoing : ''}`}>
                            {formatTime(msg.createdAt)}
                          </div>
                        )}
                        <div className={`${styles.messageGroup} ${isOutgoing ? styles.messageGroupOutgoing : styles.messageGroupIncoming}`}>
                          <div className={`${styles.message} ${isOutgoing ? styles.messageOutgoing : styles.messageIncoming}`}>
                            {msg.content}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>
              <div className={styles.chatInput}>
                <textarea
                  className={styles.chatInputField}
                  placeholder="Type a message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  rows={1}
                />
                <button
                  className={styles.sendBtn}
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim()}
                >
                  <FiSend size={18} />
                </button>
              </div>
            </div>
          ) : (
            <div className={styles.noChatSelected}>
              <FiMessageCircle className={styles.noChatIcon} />
              <p>Select a friend to start chatting</p>
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Connected Accounts & Status */}
      <div className={styles.rightPanel}>
        {/* My Status */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <span className={styles.cardTitle}>
              <FiCircle size={14} /> My Status
            </span>
          </div>
          <div className={styles.cardBody}>
            <div className={styles.statusSelector}>
              {STATUS_OPTIONS.map((status) => (
                <div
                  key={status.id}
                  className={`${styles.statusOption} ${currentStatus === status.id ? styles.statusOptionActive : ''}`}
                  onClick={() => handleStatusChange(status.id)}
                >
                  <span className={styles.statusDot} style={{ backgroundColor: status.color }} />
                  <span className={styles.statusLabel}>{status.label}</span>
                </div>
              ))}
            </div>
            <input
              type="text"
              className={styles.customStatusInput}
              placeholder="Set a status message..."
              value={statusMessage}
              onChange={(e) => handleStatusMessageChange(e.target.value)}
            />
          </div>
        </div>

        {/* Connected Accounts */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <span className={styles.cardTitle}>
              <FiLink size={14} /> Connected Accounts
            </span>
          </div>
          <div className={styles.cardBody}>
            <div className={styles.accountsList}>
              {SOCIAL_PROVIDERS.map((provider) => {
                const connected = socialAccounts.find((a) => a.provider === provider.id);
                const Icon = provider.icon;
                return (
                  <div key={provider.id} className={styles.accountItem}>
                    <div className={styles.accountIcon} style={{ background: `${provider.color}20`, color: provider.color }}>
                      <Icon />
                    </div>
                    <div className={styles.accountInfo}>
                      <div className={styles.accountName}>{provider.name}</div>
                      {connected ? (
                        <div className={styles.accountUsername}>@{connected.username || 'Connected'}</div>
                      ) : (
                        <div className={styles.accountUsername}>Not connected</div>
                      )}
                    </div>
                    {connected ? (
                      <span className={`${styles.accountStatus} ${styles.accountStatusConnected}`}>
                        Connected
                      </span>
                    ) : (
                      <button
                        className={styles.connectBtn}
                        onClick={() => toast.info(`${provider.name} OAuth integration coming soon!`)}
                      >
                        Connect
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
