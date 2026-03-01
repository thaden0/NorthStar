'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { FiShield, FiMonitor, FiCheck, FiX, FiTrash2, FiRefreshCw, FiLogIn } from 'react-icons/fi';
import styles from './jobSearch.module.css';

interface BoardProfile {
  board: string;
  name: string;
  hasProfile: boolean;
}

const BOARDS = [
  { value: 'indeed', label: 'Indeed', icon: '🔍' },
  { value: 'linkedin', label: 'LinkedIn', icon: '💼' },
  { value: 'glassdoor', label: 'Glassdoor', icon: '🚪' },
  { value: 'ziprecruiter', label: 'ZipRecruiter', icon: '⚡' },
];

export default function SettingsTab() {
  const [profiles, setProfiles] = useState<BoardProfile[]>([]);
  const [loginBoard, setLoginBoard] = useState<string | null>(null);
  const [loginStatus, setLoginStatus] = useState<'idle' | 'connecting' | 'ready' | 'logged_in'>('idle');
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [checking, setChecking] = useState<string | null>(null);
  const [typeText, setTypeText] = useState('');
  const [isPopup, setIsPopup] = useState(false);
  const screenshotRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const fetchProfiles = useCallback(async () => {
    try {
      const res = await fetch('/api/job-search/login-session');
      if (res.ok) {
        const data = await res.json();
        setProfiles(data.profiles || []);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchProfiles();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchProfiles]);

  const startLogin = async (board: string) => {
    setLoginBoard(board);
    setLoginStatus('connecting');
    setScreenshot(null);
    setMessage({ type: 'info', text: 'Launching browser...' });

    try {
      const res = await fetch('/api/job-search/login-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start', board }),
      });
      const data = await res.json();

      if (data.error) {
        setMessage({ type: 'error', text: data.error });
        setLoginStatus('idle');
        return;
      }

      setLoginStatus(data.status === 'logged_in' ? 'logged_in' : 'ready');
      setScreenshot(data.screenshot);
      setMessage(data.status === 'logged_in'
        ? { type: 'success', text: 'Already logged in! Session is active.' }
        : { type: 'info', text: 'Click on the page below to interact. Complete login and any 2FA.' }
      );

      // Start polling for screenshots
      startPoll(board);
    } catch {
      setMessage({ type: 'error', text: 'Failed to connect to agent service' });
      setLoginStatus('idle');
    }
  };

  const startPoll = useCallback((board: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch('/api/job-search/login-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'screenshot', board }),
        });
        const data = await res.json();
        if (data.screenshot) setScreenshot(data.screenshot);
        if (data.isPopup !== undefined) setIsPopup(data.isPopup);
        if (data.status === 'logged_in' && loginStatus !== 'logged_in') {
          setLoginStatus('logged_in');
          setMessage({ type: 'success', text: 'Login successful! Your session is saved.' });
        }
      } catch { /* ignore */ }
    }, 2000);
  }, [loginStatus]);

  const handleScreenshotClick = async (e: React.MouseEvent<HTMLDivElement>) => {
    if (!loginBoard || loginStatus === 'connecting') return;

    const rect = e.currentTarget.getBoundingClientRect();
    const img = e.currentTarget.querySelector('img');
    if (!img) return;

    // Scale coordinates to match the actual browser viewport (1280x800)
    const scaleX = 1280 / img.clientWidth;
    const scaleY = 800 / img.clientHeight;
    const x = Math.round((e.clientX - rect.left) * scaleX);
    const y = Math.round((e.clientY - rect.top) * scaleY);

    try {
      const res = await fetch('/api/job-search/login-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'click', board: loginBoard, x, y }),
      });
      const data = await res.json();
      if (data.screenshot) setScreenshot(data.screenshot);
      if (data.status === 'logged_in') {
        setLoginStatus('logged_in');
        setMessage({ type: 'success', text: 'Login successful! Your session is saved.' });
      }
    } catch { /* ignore */ }
  };

  const handleType = async () => {
    if (!loginBoard || !typeText) return;

    try {
      const res = await fetch('/api/job-search/login-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'type', board: loginBoard, text: typeText }),
      });
      const data = await res.json();
      if (data.screenshot) setScreenshot(data.screenshot);
      setTypeText('');
    } catch { /* ignore */ }
  };

  const handleKeyPress = async (key: string) => {
    if (!loginBoard) return;

    try {
      const res = await fetch('/api/job-search/login-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'keypress', board: loginBoard, key }),
      });
      const data = await res.json();
      if (data.screenshot) setScreenshot(data.screenshot);
      if (data.status === 'logged_in') {
        setLoginStatus('logged_in');
        setMessage({ type: 'success', text: 'Login successful! Your session is saved.' });
      }
    } catch { /* ignore */ }
  };

  const endSession = async () => {
    if (!loginBoard) return;

    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }

    try {
      await fetch('/api/job-search/login-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'end', board: loginBoard }),
      });
    } catch { /* ignore */ }

    setLoginBoard(null);
    setLoginStatus('idle');
    setScreenshot(null);
    setMessage(null);
    fetchProfiles();
  };

  const deleteProfile = async (board: string) => {
    try {
      await fetch('/api/job-search/login-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', board }),
      });
      setMessage({ type: 'success', text: 'Session deleted' });
      fetchProfiles();
    } catch { /* ignore */ }
  };

  const checkSession = async (board: string) => {
    setChecking(board);
    try {
      const res = await fetch('/api/job-search/login-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'check', board }),
      });
      const data = await res.json();
      setMessage({
        type: data.valid ? 'success' : 'error',
        text: data.valid ? `${board} session is active!` : `${board} session expired — please log in again`,
      });
    } catch { /* ignore */ }
    setChecking(null);
  };

  return (
    <div className={styles.settingsContainer}>
      {/* Login Sessions Card */}
      <div className={styles.settingsCard}>
        <div className={styles.settingsCardHeader}>
          <FiShield />
          <div>
            <h3>Job Board Login Sessions</h3>
            <p>Log in to job boards so the Auto Apply agent can use your session. Your browser profile is saved and persists across server restarts. Complete any 2FA verification during login.</p>
          </div>
        </div>

        {/* Saved Profiles */}
        <div className={styles.savedCredentials}>
          <h4>Board Sessions</h4>
          {BOARDS.map(board => {
            const profile = profiles.find(p => p.board === board.value);
            const hasProfile = profile?.hasProfile || false;
            return (
              <div key={board.value} className={styles.credentialRow}>
                <span className={styles.credentialBoard}>
                  {board.icon} {board.label}
                </span>
                <span className={`${styles.sessionStatus} ${hasProfile ? styles.sessionActive : styles.sessionInactive}`}>
                  {hasProfile ? (
                    <><FiCheck /> Session Saved</>
                  ) : (
                    <><FiX /> Not Connected</>
                  )}
                </span>
                <div className={styles.sessionActions}>
                  {hasProfile && (
                    <>
                      <button
                        className={styles.sessionActionBtn}
                        onClick={() => checkSession(board.value)}
                        disabled={checking === board.value}
                        title="Check if session is still valid"
                      >
                        <FiRefreshCw className={checking === board.value ? styles.spinning : ''} />
                      </button>
                      <button
                        className={styles.sessionActionBtn}
                        onClick={() => deleteProfile(board.value)}
                        title="Delete saved session"
                      >
                        <FiTrash2 />
                      </button>
                    </>
                  )}
                  <button
                    className={styles.credentialSaveBtn}
                    onClick={() => startLogin(board.value)}
                    disabled={loginBoard !== null}
                  >
                    <FiLogIn /> {hasProfile ? 'Re-login' : 'Login'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {message && !loginBoard && (
          <div className={`${styles.credentialMessage} ${
            message.type === 'error' ? styles.credentialError :
            message.type === 'success' ? styles.credentialSuccess :
            styles.credentialInfo
          }`}>
            {message.text}
          </div>
        )}
      </div>

      {/* Interactive Login Modal */}
      {loginBoard && (
        <div className={styles.loginOverlay}>
          <div className={styles.loginModal}>
            <div className={styles.loginHeader}>
              <div className={styles.loginHeaderInfo}>
                <FiMonitor />
                <div>
                  <h3>Login to {BOARDS.find(b => b.value === loginBoard)?.label}</h3>
                  <p className={`${styles.loginStatusText} ${
                    loginStatus === 'logged_in' ? styles.statusGreen :
                    loginStatus === 'ready' ? styles.statusBlue :
                    styles.statusYellow
                  }`}>
                    {loginStatus === 'connecting' && '⟳ Launching browser...'}
                    {loginStatus === 'ready' && (isPopup ? '🔐 Popup window — complete sign-in here' : '● Click on the page to interact')}
                    {loginStatus === 'logged_in' && '✓ Logged in — session saved!'}
                  </p>
                </div>
              </div>
              <button className={styles.loginCloseBtn} onClick={endSession}>
                <FiX /> {loginStatus === 'logged_in' ? 'Done' : 'Cancel'}
              </button>
            </div>

            {/* Browser View */}
            <div className={styles.browserView} ref={screenshotRef}>
              {screenshot ? (
                <div className={styles.browserScreenshot} onClick={handleScreenshotClick}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`data:image/jpeg;base64,${screenshot}`}
                    alt="Browser view"
                    draggable={false}
                  />
                  {loginStatus === 'connecting' && (
                    <div className={styles.browserOverlay}>
                      <div className={styles.browserSpinner} />
                      <span>Loading...</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className={styles.browserPlaceholder}>
                  <div className={styles.browserSpinner} />
                  <span>Starting browser session...</span>
                </div>
              )}
            </div>

            {/* Controls */}
            <div className={styles.loginControls}>
              <div className={styles.typeRow}>
                <input
                  type="text"
                  className={styles.typeInput}
                  value={typeText}
                  onChange={e => setTypeText(e.target.value)}
                  placeholder="Type text here, then press Send..."
                  onKeyDown={e => { if (e.key === 'Enter') handleType(); }}
                />
                <button className={styles.typeBtn} onClick={handleType} disabled={!typeText}>
                  Send
                </button>
              </div>
              <div className={styles.keyRow}>
                <button className={styles.keyBtn} onClick={() => handleKeyPress('Enter')}>Enter ↵</button>
                <button className={styles.keyBtn} onClick={() => handleKeyPress('Tab')}>Tab ⇥</button>
                <button className={styles.keyBtn} onClick={() => handleKeyPress('Backspace')}>⌫</button>
                <button className={styles.keyBtn} onClick={() => handleKeyPress('Escape')}>Esc</button>
                <button className={styles.keyBtn} onClick={() => handleKeyPress('Control+a')}>Select All</button>
              </div>

              {message && (
                <div className={`${styles.credentialMessage} ${
                  message.type === 'error' ? styles.credentialError :
                  message.type === 'success' ? styles.credentialSuccess :
                  styles.credentialInfo
                }`}>
                  {message.text}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
