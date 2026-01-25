'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { 
  FiSend, 
  FiPlus, 
  FiMessageSquare, 
  FiTrash2,
  FiCpu,
  FiGlobe,
  FiTrendingUp,
  FiSearch,
  FiCode,
  FiAlertCircle,
  FiChevronRight,
  FiZap
} from 'react-icons/fi';
import styles from './ai-insights.module.css';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  toolName?: string;
  toolResult?: string;
  createdAt: string;
}

interface Conversation {
  id: string;
  userId: string;
  title: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface SSEEvent {
  type: 'connected' | 'status' | 'thinking' | 'tool_start' | 'tool_result' | 'content' | 'complete' | 'error';
  message?: string;
  content?: string;
  finalContent?: string;
  toolName?: string;
  result?: string;
  error?: string;
}

interface ChatClientProps {
  userId: string;
  userName: string;
  userEmail: string;
}

const SUGGESTIONS = [
  {
    icon: <FiGlobe />,
    title: 'Browse the Web',
    description: 'Research any topic online',
    prompt: 'Search for the latest news about AI technology',
    gradient: 'linear-gradient(135deg, #3B82F6, #1D4ED8)',
  },
  {
    icon: <FiTrendingUp />,
    title: 'Get News',
    description: 'Latest headlines & updates',
    prompt: 'What are the top technology headlines today?',
    gradient: 'linear-gradient(135deg, #F59E0B, #D97706)',
  },
  {
    icon: <FiSearch />,
    title: 'Research Topics',
    description: 'Deep dive into any subject',
    prompt: 'Research and summarize the current state of quantum computing',
    gradient: 'linear-gradient(135deg, #8B5CF6, #6D28D9)',
  },
  {
    icon: <FiCode />,
    title: 'Technical Help',
    description: 'Coding & tech questions',
    prompt: 'Explain the differences between REST and GraphQL APIs',
    gradient: 'linear-gradient(135deg, #22C55E, #16A34A)',
  },
];

// Component for rendering thinking blocks as collapsible sections
function ThinkingBlock({ content }: { content: string }) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  return (
    <div className={styles.thinkingBlock}>
      <div 
        className={styles.thinkingHeader}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <FiChevronRight 
          className={`${styles.thinkingIcon} ${isExpanded ? styles.thinkingIconExpanded : ''}`} 
        />
        <FiZap size={12} />
        <span>AI Reasoning</span>
      </div>
      <div className={`${styles.thinkingContent} ${!isExpanded ? styles.thinkingContentHidden : ''}`}>
        {content}
      </div>
    </div>
  );
}

// Component to render markdown content with proper styling
function MarkdownContent({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        // Style headers
        h1: ({ children }) => <h1 className={styles.mdH1}>{children}</h1>,
        h2: ({ children }) => <h2 className={styles.mdH2}>{children}</h2>,
        h3: ({ children }) => <h3 className={styles.mdH3}>{children}</h3>,
        h4: ({ children }) => <h4 className={styles.mdH4}>{children}</h4>,
        // Style paragraphs
        p: ({ children }) => <p className={styles.mdP}>{children}</p>,
        // Style lists
        ul: ({ children }) => <ul className={styles.mdUl}>{children}</ul>,
        ol: ({ children }) => <ol className={styles.mdOl}>{children}</ol>,
        li: ({ children }) => <li className={styles.mdLi}>{children}</li>,
        // Style links
        a: ({ href, children }) => (
          <a href={href} target="_blank" rel="noopener noreferrer" className={styles.mdLink}>
            {children}
          </a>
        ),
        // Style code
        code: ({ className, children, ...props }) => {
          const isInline = !className;
          return isInline ? (
            <code className={styles.mdInlineCode} {...props}>{children}</code>
          ) : (
            <code className={`${styles.mdCodeBlock} ${className || ''}`} {...props}>{children}</code>
          );
        },
        pre: ({ children }) => <pre className={styles.mdPre}>{children}</pre>,
        // Style blockquotes
        blockquote: ({ children }) => <blockquote className={styles.mdBlockquote}>{children}</blockquote>,
        // Style horizontal rules
        hr: () => <hr className={styles.mdHr} />,
        // Style strong/bold
        strong: ({ children }) => <strong className={styles.mdStrong}>{children}</strong>,
        // Style emphasis/italic
        em: ({ children }) => <em className={styles.mdEm}>{children}</em>,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

// Function to parse message content and render thinking blocks with markdown
function renderMessageContent(content: string): React.ReactNode {
  // Match <think>...</think> blocks (case insensitive, handles multiline)
  const thinkRegex = /<think>([\s\S]*?)<\/think>/gi;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;
  let partKey = 0;
  
  while ((match = thinkRegex.exec(content)) !== null) {
    // Add text before the think block (rendered as markdown)
    if (match.index > lastIndex) {
      const textBefore = content.slice(lastIndex, match.index).trim();
      if (textBefore) {
        parts.push(<MarkdownContent key={partKey++} content={textBefore} />);
      }
    }
    
    // Add the thinking block component
    const thinkContent = match[1].trim();
    if (thinkContent) {
      parts.push(<ThinkingBlock key={partKey++} content={thinkContent} />);
    }
    
    lastIndex = match.index + match[0].length;
  }
  
  // Add remaining text after the last think block (rendered as markdown)
  if (lastIndex < content.length) {
    const remainingText = content.slice(lastIndex).trim();
    if (remainingText) {
      parts.push(<MarkdownContent key={partKey++} content={remainingText} />);
    }
  }
  
  // If no think blocks found, render entire content as markdown
  if (parts.length === 0) {
    return <MarkdownContent content={content} />;
  }
  
  return <>{parts}</>;
}

export default function ChatClient({ userId, userName, userEmail: _userEmail }: ChatClientProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [serviceOnline, setServiceOnline] = useState(true);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Scroll to bottom when messages change
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, statusMessage, scrollToBottom]);

  // Load conversations on mount
  useEffect(() => {
    loadConversations();
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [input]);

  // Cleanup EventSource on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  async function loadConversations() {
    try {
      const response = await fetch('/api/agent/conversations');
      if (response.ok) {
        const data = await response.json();
        setConversations(data);
        setServiceOnline(true);
      } else {
        console.error('Failed to load conversations');
        setServiceOnline(false);
      }
    } catch (err) {
      console.error('Failed to load conversations:', err);
      setServiceOnline(false);
    }
  }

  async function loadConversation(conversationId: string) {
    try {
      const response = await fetch(`/api/agent/conversations/${conversationId}`);
      if (response.ok) {
        const data = await response.json();
        setCurrentConversation(data.conversation);
        setMessages(data.messages || []);
      }
    } catch (err) {
      console.error('Failed to load conversation:', err);
    }
  }

  async function deleteConversation(conversationId: string) {
    try {
      await fetch(`/api/agent/conversations/${conversationId}`, {
        method: 'DELETE',
      });
      setConversations(prev => prev.filter(c => c.id !== conversationId));
      if (currentConversation?.id === conversationId) {
        setCurrentConversation(null);
        setMessages([]);
      }
    } catch (err) {
      console.error('Failed to delete conversation:', err);
    }
  }

  function startNewChat() {
    setCurrentConversation(null);
    setMessages([]);
    setError(null);
    setStatusMessage('');
  }

  async function sendMessage(prompt?: string) {
    const messageContent = prompt || input.trim();
    if (!messageContent || isLoading) return;

    setInput('');
    setIsLoading(true);
    setError(null);
    setStatusMessage('');

    // Add user message immediately
    const userMessage: Message = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: messageContent,
      createdAt: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMessage]);

    try {
      // Start chat
      const response = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: messageContent,
          conversationId: currentConversation?.id,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to start chat');
      }

      const data = await response.json();
      const { conversationId } = data;

      // Set current conversation
      if (!currentConversation) {
        const newConvo: Conversation = {
          id: conversationId,
          userId,
          title: messageContent.slice(0, 50) + (messageContent.length > 50 ? '...' : ''),
          status: 'active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        setCurrentConversation(newConvo);
        setConversations(prev => [newConvo, ...prev]);
      }

      // Connect to SSE stream through Next.js proxy (not directly to Agent Service)
      // The browser should never talk directly to internal microservices
      const streamUrl = `/api/agent/chat/${conversationId}/stream`;
      
      // Close any existing connection
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      // Create EventSource - no token needed, Next.js handles auth via session cookies
      const eventSource = new EventSource(streamUrl);
      eventSourceRef.current = eventSource;

      let assistantContent = '';

      eventSource.onmessage = (event) => {
        try {
          const sseEvent: SSEEvent = JSON.parse(event.data);
          
          switch (sseEvent.type) {
            case 'connected':
              setStatusMessage('Connected to agent...');
              break;
              
            case 'status':
              setStatusMessage(sseEvent.message || 'Processing...');
              break;
              
            case 'thinking':
              setStatusMessage('Thinking...');
              break;
              
            case 'tool_start':
              setStatusMessage(`Using tool: ${sseEvent.toolName}`);
              break;
              
            case 'tool_result':
              setStatusMessage('');
              break;
              
            case 'content':
              if (sseEvent.content) {
                assistantContent += sseEvent.content;
                // Update the assistant message
                setMessages(prev => {
                  const lastMessage = prev[prev.length - 1];
                  if (lastMessage?.role === 'assistant' && lastMessage.id.startsWith('streaming-')) {
                    return [
                      ...prev.slice(0, -1),
                      { ...lastMessage, content: assistantContent },
                    ];
                  } else {
                    return [
                      ...prev,
                      {
                        id: `streaming-${conversationId}`,
                        role: 'assistant',
                        content: assistantContent,
                        createdAt: new Date().toISOString(),
                      },
                    ];
                  }
                });
              }
              break;
              
            case 'complete':
              // Update the final message content if provided
              const finalContent = sseEvent.finalContent || sseEvent.content;
              if (finalContent) {
                setMessages(prev => {
                  const lastMessage = prev[prev.length - 1];
                  if (lastMessage?.role === 'assistant') {
                    return [
                      ...prev.slice(0, -1),
                      { ...lastMessage, content: finalContent },
                    ];
                  }
                  return prev;
                });
              }
              setStatusMessage('');
              setIsLoading(false);
              eventSource.close();
              loadConversations(); // Refresh conversations list
              break;
              
            case 'error':
              setError(sseEvent.error || 'An error occurred');
              setStatusMessage('');
              setIsLoading(false);
              eventSource.close();
              break;
          }
        } catch (e) {
          console.error('Failed to parse SSE event:', e);
        }
      };

      eventSource.onerror = () => {
        setStatusMessage('');
        setIsLoading(false);
        eventSource.close();
        // If we don't have any assistant content yet, reload the conversation
        if (!assistantContent) {
          setTimeout(() => loadConversation(conversationId), 1000);
        }
      };

    } catch (err) {
      console.error('Chat error:', err);
      setError(err instanceof Error ? err.message : 'Failed to send message');
      setIsLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function getInitials(name: string) {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  function formatTime(dateString: string) {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function formatDate(dateString: string) {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return date.toLocaleDateString([], { weekday: 'short' });
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }

  return (
    <div className={styles.page}>
      {/* Sidebar - Conversations List */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <h3 className={styles.sidebarTitle}>Conversations</h3>
        </div>
        <div className={styles.conversationsList}>
          {conversations.length === 0 ? (
            <div className={styles.emptyConversations}>
              <FiMessageSquare />
              <p>No conversations yet</p>
            </div>
          ) : (
            conversations.map(conv => (
              <div
                key={conv.id}
                className={`${styles.conversationItem} ${currentConversation?.id === conv.id ? styles.conversationItemActive : ''}`}
                onClick={() => loadConversation(conv.id)}
              >
                <FiMessageSquare className={styles.conversationIcon} />
                <div className={styles.conversationInfo}>
                  <p className={styles.conversationTitle}>{conv.title}</p>
                  <p className={styles.conversationTime}>{formatDate(conv.createdAt)}</p>
                </div>
                <button
                  className={styles.deleteBtn}
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteConversation(conv.id);
                  }}
                  title="Delete conversation"
                >
                  <FiTrash2 size={12} />
                </button>
              </div>
            ))
          )}
        </div>
      </aside>

      {/* Chat Container */}
      <div className={styles.chatContainer}>
        {/* Chat Header with controls */}
        <div className={styles.chatHeader}>
          <h2 className={styles.chatTitle}>
            {currentConversation?.title || 'New Conversation'}
          </h2>
          <div className={styles.chatActions}>
            <div className={styles.serviceStatus}>
              <div className={`${styles.statusIndicator} ${serviceOnline ? styles.statusOnline : styles.statusOffline}`} />
              <span>{serviceOnline ? 'Agent Online' : 'Offline'}</span>
            </div>
            <button className={styles.newChatBtn} onClick={startNewChat}>
              <FiPlus size={14} />
              New Chat
            </button>
          </div>
        </div>

        {/* Messages Area */}
        <div className={styles.messagesContainer}>
          {messages.length === 0 && !currentConversation ? (
            // Empty State with Suggestions
            <div className={styles.emptyChat}>
              <FiCpu className={styles.emptyIcon} />
              <h2 className={styles.emptyTitle}>How can I help you today?</h2>
              <p className={styles.emptyDescription}>
                I can browse the web, search for news, research topics, and help with technical questions.
              </p>
              <div className={styles.suggestionGrid}>
                {SUGGESTIONS.map((suggestion, index) => (
                  <button
                    key={index}
                    className={styles.suggestionCard}
                    onClick={() => sendMessage(suggestion.prompt)}
                  >
                    <div className={styles.suggestionIcon} style={{ background: suggestion.gradient, color: 'white' }}>
                      {suggestion.icon}
                    </div>
                    <div className={styles.suggestionText}>
                      <div className={styles.suggestionTitle}>{suggestion.title}</div>
                      <div className={styles.suggestionDesc}>{suggestion.description}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`${styles.messageWrapper} ${message.role === 'user' ? styles.messageWrapperUser : ''}`}
                >
                  <div className={`${styles.messageAvatar} ${message.role === 'user' ? styles.avatarUser : styles.avatarAi}`}>
                    {message.role === 'user' ? getInitials(userName) : <FiCpu size={14} />}
                  </div>
                  <div className={`${styles.messageBubble} ${message.role === 'user' ? styles.bubbleUser : styles.bubbleAi}`}>
                    <div className={styles.messageContent}>
                      {message.role === 'assistant' 
                        ? renderMessageContent(message.content)
                        : message.content
                      }
                    </div>
                    {message.toolName && (
                      <div className={styles.toolCall}>
                        <div className={styles.toolCallHeader}>
                          <FiCode size={12} /> Tool: {message.toolName}
                        </div>
                        {message.toolResult && (
                          <div className={styles.toolCallResult}>
                            {message.toolResult.slice(0, 200)}
                            {message.toolResult.length > 200 && '...'}
                          </div>
                        )}
                      </div>
                    )}
                    <div className={styles.messageTime}>
                      {formatTime(message.createdAt)}
                    </div>
                  </div>
                </div>
              ))}

              {/* Status Message */}
              {statusMessage && (
                <div className={styles.statusMessage}>
                  <div className={styles.statusDot} />
                  {statusMessage}
                </div>
              )}

              {/* Typing Indicator */}
              {isLoading && !statusMessage && (
                <div className={styles.messageWrapper}>
                  <div className={`${styles.messageAvatar} ${styles.avatarAi}`}>
                    <FiCpu size={14} />
                  </div>
                  <div className={`${styles.messageBubble} ${styles.bubbleAi}`}>
                    <div className={styles.typingIndicator}>
                      <div className={styles.typingDot} />
                      <div className={styles.typingDot} />
                      <div className={styles.typingDot} />
                    </div>
                  </div>
                </div>
              )}

              {/* Error Message */}
              {error && (
                <div className={styles.errorMessage}>
                  <FiAlertCircle size={14} />
                  <span>{error}</span>
                </div>
              )}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className={styles.inputArea}>
          <div className={styles.inputContainer}>
            <div className={styles.textareaWrapper}>
              <textarea
                ref={textareaRef}
                className={styles.textarea}
                placeholder="Ask me anything... (Shift+Enter for new line)"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
                disabled={isLoading || !serviceOnline}
              />
            </div>
            <button
              className={styles.sendBtn}
              onClick={() => sendMessage()}
              disabled={!input.trim() || isLoading || !serviceOnline}
            >
              {isLoading ? (
                <div className={styles.loadingSpinner} />
              ) : (
                <FiSend />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
