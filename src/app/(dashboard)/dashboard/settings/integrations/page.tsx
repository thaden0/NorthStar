'use client';

import { useState, useEffect } from 'react';
import { FiLink, FiCheck, FiX, FiExternalLink, FiMail, FiCalendar, FiUsers, FiRefreshCw } from 'react-icons/fi';
import styles from '../../dashboard.module.css';

interface GoogleStatus {
  connected: boolean;
  email?: string;
}

export default function IntegrationsPage() {
  const [googleStatus, setGoogleStatus] = useState<GoogleStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Check URL params for success/error messages
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const successParam = params.get('success');
    const errorParam = params.get('error');

    if (successParam === 'google_connected') {
      setSuccess('Google account connected successfully!');
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    }
    if (errorParam) {
      setError(decodeURIComponent(errorParam));
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  // Fetch Google connection status
  const fetchGoogleStatus = async () => {
    try {
      const response = await fetch('/api/google/status');
      if (response.ok) {
        const data = await response.json();
        setGoogleStatus(data);
      } else {
        setGoogleStatus({ connected: false });
      }
    } catch (err) {
      console.error('Failed to fetch Google status:', err);
      setGoogleStatus({ connected: false });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchGoogleStatus();
  }, []);

  const handleConnectGoogle = async () => {
    setIsConnecting(true);
    setError(null);
    
    try {
      const response = await fetch('/api/google/authorize');
      if (response.ok) {
        const data = await response.json();
        // Redirect to Google OAuth
        window.location.href = data.url;
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to start Google authorization');
      }
    } catch {
      setError('Failed to connect to Google service');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnectGoogle = async () => {
    if (!confirm('Are you sure you want to disconnect your Google account?')) {
      return;
    }

    setIsDisconnecting(true);
    setError(null);
    
    try {
      const response = await fetch('/api/google/disconnect', {
        method: 'DELETE',
      });
      
      if (response.ok) {
        setGoogleStatus({ connected: false });
        setSuccess('Google account disconnected');
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to disconnect');
      }
    } catch {
      setError('Failed to disconnect Google account');
    } finally {
      setIsDisconnecting(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>
            <FiLink style={{ marginRight: '12px', color: 'var(--blue-ice)' }} />
            Integrations
          </h1>
          <p className={styles.subtitle}>
            Connect external services to enhance your North Star experience
          </p>
        </div>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          padding: 'var(--space-3) var(--space-4)',
          background: 'rgba(34, 197, 94, 0.15)',
          border: '1px solid rgba(34, 197, 94, 0.3)',
          borderRadius: 'var(--radius-md)',
          color: '#22c55e',
          marginBottom: 'var(--space-4)',
        }}>
          <FiCheck />
          <span>{success}</span>
          <button 
            onClick={() => setSuccess(null)}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}
          >
            <FiX />
          </button>
        </div>
      )}

      {error && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          padding: 'var(--space-3) var(--space-4)',
          background: 'rgba(239, 68, 68, 0.15)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: 'var(--radius-md)',
          color: '#ef4444',
          marginBottom: 'var(--space-4)',
        }}>
          <FiX />
          <span>{error}</span>
          <button 
            onClick={() => setError(null)}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}
          >
            <FiX />
          </button>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        {/* Google Integration Card */}
        <div className={styles.card}>
          <div className={styles.cardHeader} style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              {/* Google Logo */}
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: 'var(--radius-md)',
                background: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
              </div>
              <div>
                <h2 className={styles.cardTitle} style={{ margin: 0 }}>Google</h2>
                <p style={{ 
                  fontSize: '0.85rem', 
                  color: 'var(--text-muted)', 
                  margin: '4px 0 0 0' 
                }}>
                  Gmail, Calendar, and Contacts
                </p>
              </div>
            </div>
            
            {/* Status Badge */}
            {isLoading ? (
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 'var(--space-2)',
                color: 'var(--text-muted)',
                fontSize: '0.85rem',
              }}>
                <FiRefreshCw className="animate-spin" />
                Checking...
              </div>
            ) : googleStatus?.connected ? (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                padding: 'var(--space-1) var(--space-3)',
                background: 'rgba(34, 197, 94, 0.15)',
                border: '1px solid rgba(34, 197, 94, 0.3)',
                borderRadius: 'var(--radius-full)',
                color: '#22c55e',
                fontSize: '0.8rem',
                fontWeight: 500,
              }}>
                <FiCheck />
                Connected
              </div>
            ) : (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                padding: 'var(--space-1) var(--space-3)',
                background: 'var(--glass-2)',
                borderRadius: 'var(--radius-full)',
                color: 'var(--text-muted)',
                fontSize: '0.8rem',
              }}>
                Not connected
              </div>
            )}
          </div>

          <div className={styles.cardContent}>
            {/* Features List */}
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 'var(--space-4)',
              marginBottom: 'var(--space-5)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                }}>
                  <FiMail />
                </div>
                <div>
                  <div style={{ fontWeight: 500, fontSize: '0.9rem' }}>Gmail</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Read, send, and search emails</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                }}>
                  <FiCalendar />
                </div>
                <div>
                  <div style={{ fontWeight: 500, fontSize: '0.9rem' }}>Calendar</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>View and manage events</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                }}>
                  <FiUsers />
                </div>
                <div>
                  <div style={{ fontWeight: 500, fontSize: '0.9rem' }}>Contacts</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Access your contact list</div>
                </div>
              </div>
            </div>

            {/* Connected Account Info */}
            {googleStatus?.connected && googleStatus.email && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-3)',
                padding: 'var(--space-3) var(--space-4)',
                background: 'var(--glass-2)',
                borderRadius: 'var(--radius-md)',
                marginBottom: 'var(--space-4)',
              }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  background: 'var(--gradient-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontWeight: 600,
                }}>
                  {googleStatus.email.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontWeight: 500 }}>Connected Account</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{googleStatus.email}</div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
              {googleStatus?.connected ? (
                <button
                  onClick={handleDisconnectGoogle}
                  disabled={isDisconnecting}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-2)',
                    padding: 'var(--space-2) var(--space-4)',
                    background: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: 'var(--radius-md)',
                    color: '#ef4444',
                    fontSize: '0.85rem',
                    fontWeight: 500,
                    cursor: isDisconnecting ? 'not-allowed' : 'pointer',
                    opacity: isDisconnecting ? 0.6 : 1,
                    transition: 'all 0.2s',
                  }}
                >
                  {isDisconnecting ? (
                    <>
                      <FiRefreshCw className="animate-spin" />
                      Disconnecting...
                    </>
                  ) : (
                    <>
                      <FiX />
                      Disconnect
                    </>
                  )}
                </button>
              ) : (
                <button
                  onClick={handleConnectGoogle}
                  disabled={isConnecting || isLoading}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-2)',
                    padding: 'var(--space-2) var(--space-4)',
                    background: 'var(--gradient-primary)',
                    border: 'none',
                    borderRadius: 'var(--radius-md)',
                    color: 'white',
                    fontSize: '0.85rem',
                    fontWeight: 500,
                    cursor: isConnecting || isLoading ? 'not-allowed' : 'pointer',
                    opacity: isConnecting || isLoading ? 0.6 : 1,
                    transition: 'all 0.2s',
                  }}
                >
                  {isConnecting ? (
                    <>
                      <FiRefreshCw className="animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <FiExternalLink />
                      Connect Google Account
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Info Card */}
        <div className={styles.card} style={{ background: 'var(--glass-2)' }}>
          <div className={styles.cardContent}>
            <h3 style={{ 
              margin: '0 0 var(--space-3) 0', 
              fontSize: '1rem',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
            }}>
              <span style={{ color: 'var(--blue-ice)' }}>ℹ️</span>
              About Integrations
            </h3>
            <p style={{ 
              margin: 0, 
              fontSize: '0.9rem', 
              color: 'var(--text-secondary)',
              lineHeight: 1.6,
            }}>
              When you connect your Google account, the AI assistant can help you manage your emails, 
              schedule calendar events, and look up contacts. All data is accessed securely using OAuth 2.0, 
              and you can disconnect at any time. Your credentials are never stored - only secure access tokens 
              are used.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
