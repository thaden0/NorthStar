'use client';

import { useState, useEffect } from 'react';
import { FiSave, FiTrash2, FiEye, FiEyeOff, FiShield } from 'react-icons/fi';
import styles from './jobSearch.module.css';

interface Credential {
  id: string;
  board: string;
  email: string;
  updatedAt: string;
}

const BOARDS = [
  { value: 'indeed', label: 'Indeed', icon: '🔍' },
  { value: 'linkedin', label: 'LinkedIn', icon: '💼' },
  { value: 'glassdoor', label: 'Glassdoor', icon: '🚪' },
  { value: 'ziprecruiter', label: 'ZipRecruiter', icon: '⚡' },
  { value: 'monster', label: 'Monster', icon: '👾' },
];

export default function SettingsTab() {
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [selectedBoard, setSelectedBoard] = useState('indeed');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchCredentials();
  }, []);

  const fetchCredentials = async () => {
    try {
      const res = await fetch('/api/job-search/credentials');
      if (res.ok) {
        const data = await res.json();
        setCredentials(data.credentials);
      }
    } catch { /* ignore */ }
  };

  const saveCredential = async () => {
    if (!email || !password) {
      setMessage({ type: 'error', text: 'Email and password are required' });
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/job-search/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ board: selectedBoard, email, password }),
      });
      if (res.ok) {
        setMessage({ type: 'success', text: `${BOARDS.find(b => b.value === selectedBoard)?.label} credentials saved!` });
        setEmail('');
        setPassword('');
        fetchCredentials();
      } else {
        setMessage({ type: 'error', text: 'Failed to save credentials' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Network error' });
    } finally {
      setSaving(false);
    }
  };

  const deleteCredential = async (board: string) => {
    try {
      const res = await fetch('/api/job-search/credentials', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ board }),
      });
      if (res.ok) {
        fetchCredentials();
        setMessage({ type: 'success', text: 'Credentials removed' });
      }
    } catch { /* ignore */ }
  };

  return (
    <div className={styles.settingsContainer}>
      <div className={styles.settingsCard}>
        <div className={styles.settingsCardHeader}>
          <FiShield />
          <div>
            <h3>Job Board Credentials</h3>
            <p>Save your login credentials so the Auto Apply agent can sign in on your behalf. Passwords are encrypted with AES-256.</p>
          </div>
        </div>

        {/* Saved credentials */}
        {credentials.length > 0 && (
          <div className={styles.savedCredentials}>
            <h4>Saved Accounts</h4>
            {credentials.map(cred => {
              const board = BOARDS.find(b => b.value === cred.board);
              return (
                <div key={cred.id} className={styles.credentialRow}>
                  <span className={styles.credentialBoard}>
                    {board?.icon} {board?.label || cred.board}
                  </span>
                  <span className={styles.credentialEmail}>{cred.email}</span>
                  <span className={styles.credentialDate}>
                    Updated {new Date(cred.updatedAt).toLocaleDateString()}
                  </span>
                  <button
                    className={styles.credentialDeleteBtn}
                    onClick={() => deleteCredential(cred.board)}
                    title="Remove"
                  >
                    <FiTrash2 />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Add/Update form */}
        <div className={styles.credentialForm}>
          <h4>Add / Update Credentials</h4>
          <div className={styles.credentialFormRow}>
            <select
              className={styles.credentialSelect}
              value={selectedBoard}
              onChange={e => setSelectedBoard(e.target.value)}
            >
              {BOARDS.map(b => (
                <option key={b.value} value={b.value}>
                  {b.icon} {b.label}
                </option>
              ))}
            </select>
            <input
              type="email"
              className={styles.credentialInput}
              placeholder="Email / Username"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
            <div className={styles.passwordWrapper}>
              <input
                type={showPassword ? 'text' : 'password'}
                className={styles.credentialInput}
                placeholder="Password"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
              <button
                className={styles.passwordToggle}
                onClick={() => setShowPassword(!showPassword)}
                type="button"
              >
                {showPassword ? <FiEyeOff /> : <FiEye />}
              </button>
            </div>
            <button
              className={styles.credentialSaveBtn}
              onClick={saveCredential}
              disabled={saving}
            >
              <FiSave /> {saving ? 'Saving...' : 'Save'}
            </button>
          </div>

          {message && (
            <div className={`${styles.credentialMessage} ${message.type === 'error' ? styles.credentialError : styles.credentialSuccess}`}>
              {message.text}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
