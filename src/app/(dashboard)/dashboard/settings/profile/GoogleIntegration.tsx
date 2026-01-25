'use client';

import { useState, useEffect } from 'react';
import { FiLink, FiCheck, FiX, FiExternalLink, FiMail, FiCalendar, FiUsers, FiRefreshCw } from 'react-icons/fi';

interface GoogleStatus {
  connected: boolean;
  email?: string;
}

export default function GoogleIntegration() {
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
      window.history.replaceState({}, '', window.location.pathname);
    }
    if (errorParam) {
      setError(decodeURIComponent(errorParam));
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  // Fetch Google connection status
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await fetch('/api/google/status');
        if (response.ok) {
          const data = await response.json();
          setGoogleStatus(data);
        } else {
          setGoogleStatus({ connected: false });
        }
      } catch {
        setGoogleStatus({ connected: false });
      } finally {
        setIsLoading(false);
      }
    };
    fetchStatus();
  }, []);

  const handleConnectGoogle = async () => {
    setIsConnecting(true);
    setError(null);
    
    try {
      const response = await fetch('/api/google/authorize');
      if (response.ok) {
        const data = await response.json();
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
      const response = await fetch('/api/google/disconnect', { method: 'DELETE' });
      
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
    <div style={{
      background: 'var(--glass-2)',
      borderRadius: 'var(--radius-lg)',
      border: '1px solid var(--glass-border)',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 'var(--space-4)',
        borderBottom: '1px solid var(--glass-border)',
        background: 'rgba(0,0,0,0.1)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <FiLink style={{ color: 'var(--blue-ice)' }} />
          <span style={{ fontWeight: 600 }}>Google Integration</span>
        </div>
        
        {isLoading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
            <FiRefreshCw className="animate-spin" />
            Checking...
          </div>
        ) : googleStatus?.connected ? (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-1)',
            padding: '4px 12px',
            background: 'rgba(34, 197, 94, 0.15)',
            border: '1px solid rgba(34, 197, 94, 0.3)',
            borderRadius: 'var(--radius-full)',
            color: '#22c55e',
            fontSize: '0.75rem',
            fontWeight: 500,
          }}>
            <FiCheck size={12} />
            Connected
          </div>
        ) : (
          <div style={{
            padding: '4px 12px',
            background: 'var(--glass-3)',
            borderRadius: 'var(--radius-full)',
            color: 'var(--text-muted)',
            fontSize: '0.75rem',
          }}>
            Not connected
          </div>
        )}
      </div>

      {/* Content */}
      <div style={{ padding: 'var(--space-4)' }}>
        {/* Messages */}
        {success && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            padding: 'var(--space-2) var(--space-3)',
            background: 'rgba(34, 197, 94, 0.15)',
            border: '1px solid rgba(34, 197, 94, 0.3)',
            borderRadius: 'var(--radius-md)',
            color: '#22c55e',
            marginBottom: 'var(--space-3)',
            fontSize: '0.85rem',
          }}>
            <FiCheck size={14} />
            <span>{success}</span>
            <button onClick={() => setSuccess(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}>
              <FiX size={14} />
            </button>
          </div>
        )}

        {error && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            padding: 'var(--space-2) var(--space-3)',
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 'var(--radius-md)',
            color: '#ef4444',
            marginBottom: 'var(--space-3)',
            fontSize: '0.85rem',
          }}>
            <FiX size={14} />
            <span>{error}</span>
            <button onClick={() => setError(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}>
              <FiX size={14} />
            </button>
          </div>
        )}

        {/* Features */}
        <div style={{ display: 'flex', gap: 'var(--space-4)', marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <div style={{
              width: '28px',
              height: '28px',
              borderRadius: 'var(--radius-sm)',
              background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
            }}>
              <FiMail size={14} />
            </div>
            <span style={{ fontSize: '0.85rem' }}>Gmail</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <div style={{
              width: '28px',
              height: '28px',
              borderRadius: 'var(--radius-sm)',
              background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
            }}>
              <FiCalendar size={14} />
            </div>
            <span style={{ fontSize: '0.85rem' }}>Calendar</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <div style={{
              width: '28px',
              height: '28px',
              borderRadius: 'var(--radius-sm)',
              background: 'linear-gradient(135deg, #f59e0b, #d97706)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
            }}>
              <FiUsers size={14} />
            </div>
            <span style={{ fontSize: '0.85rem' }}>Contacts</span>
          </div>
        </div>

        {/* Connected Account */}
        {googleStatus?.connected && googleStatus.email && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
            padding: 'var(--space-3)',
            background: 'var(--glass-3)',
            borderRadius: 'var(--radius-md)',
            marginBottom: 'var(--space-3)',
          }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: 'var(--gradient-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontWeight: 600,
              fontSize: '0.8rem',
            }}>
              {googleStatus.email.charAt(0).toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize: '0.85rem', fontWeight: 500 }}>Connected Account</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{googleStatus.email}</div>
            </div>
          </div>
        )}

        {/* Action Button */}
        {googleStatus?.connected ? (
          <button
            onClick={handleDisconnectGoogle}
            disabled={isDisconnecting}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              padding: 'var(--space-2) var(--space-3)',
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: 'var(--radius-md)',
              color: '#ef4444',
              fontSize: '0.8rem',
              fontWeight: 500,
              cursor: isDisconnecting ? 'not-allowed' : 'pointer',
              opacity: isDisconnecting ? 0.6 : 1,
            }}
          >
            {isDisconnecting ? <><FiRefreshCw className="animate-spin" size={14} /> Disconnecting...</> : <><FiX size={14} /> Disconnect</>}
          </button>
        ) : (
          <button
            onClick={handleConnectGoogle}
            disabled={isConnecting || isLoading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              padding: 'var(--space-2) var(--space-3)',
              background: 'var(--gradient-primary)',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              color: 'white',
              fontSize: '0.8rem',
              fontWeight: 500,
              cursor: isConnecting || isLoading ? 'not-allowed' : 'pointer',
              opacity: isConnecting || isLoading ? 0.6 : 1,
            }}
          >
            {isConnecting ? <><FiRefreshCw className="animate-spin" size={14} /> Connecting...</> : <><FiExternalLink size={14} /> Connect Google Account</>}
          </button>
        )}
      </div>
    </div>
  );
}
