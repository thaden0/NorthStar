'use client';

import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import { toast } from 'sonner';
import { FiUser, FiMail, FiLock, FiCamera, FiCheck, FiCpu } from 'react-icons/fi';
import { updateProfileAction, changePasswordAction } from '@/server/auth/actions';
import styles from './profile.module.css';

interface ProfileFormProps {
  user: {
    id: string;
    name: string;
    email: string;
    avatar: string | null;
    aiInstructions: string | null;
  };
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={styles.submitBtn} disabled={pending}>
      {pending ? <span className={styles.spinner} /> : label}
    </button>
  );
}

export default function ProfileForm({ user }: ProfileFormProps) {
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [aiSuccess, setAiSuccess] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  async function handleProfileSubmit(formData: FormData) {
    setProfileError(null);
    setProfileSuccess(false);
    
    const result = await updateProfileAction(formData);
    
    if (result.success) {
      setProfileSuccess(true);
      toast.success('Profile updated successfully');
    } else {
      setProfileError(result.error || 'Failed to update profile');
      toast.error(result.error || 'Failed to update profile');
    }
  }

  async function handlePasswordSubmit(formData: FormData) {
    setPasswordError(null);
    setPasswordSuccess(false);
    
    const result = await changePasswordAction(formData);
    
    if (result.success) {
      setPasswordSuccess(true);
      toast.success('Password changed successfully');
      // Reset form
      const form = document.getElementById('password-form') as HTMLFormElement;
      form?.reset();
    } else {
      setPasswordError(result.error || 'Failed to change password');
      toast.error(result.error || 'Failed to change password');
    }
  }

  async function handleAiInstructionsSubmit(formData: FormData) {
    setAiError(null);
    setAiSuccess(false);
    
    // Add name and email to satisfy validation
    formData.set('name', user.name);
    formData.set('email', user.email);
    
    const result = await updateProfileAction(formData);
    
    if (result.success) {
      setAiSuccess(true);
      toast.success('AI instructions updated');
    } else {
      setAiError(result.error || 'Failed to update AI instructions');
      toast.error(result.error || 'Failed to update AI instructions');
    }
  }

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <div className={styles.container}>
      {/* Avatar Section */}
      <div className={styles.avatarSection}>
        <div className={styles.avatarWrapper}>
          <div className={styles.avatar}>
            {user.avatar ? (
              <img src={user.avatar} alt={user.name} />
            ) : (
              <span>{getInitials(user.name)}</span>
            )}
          </div>
          <button className={styles.avatarBtn} type="button">
            <FiCamera />
          </button>
        </div>
        <div className={styles.avatarInfo}>
          <h3>{user.name}</h3>
          <p>{user.email}</p>
        </div>
      </div>

      {/* Profile Form */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h2>
            <FiUser style={{ marginRight: '8px' }} />
            Profile Information
          </h2>
        </div>
        <form action={handleProfileSubmit} className={styles.form}>
          {profileError && (
            <div className={styles.error}>{profileError}</div>
          )}
          {profileSuccess && (
            <div className={styles.success}>
              <FiCheck /> Profile updated successfully
            </div>
          )}
          
          <div className={styles.formGroup}>
            <label htmlFor="name">Full Name</label>
            <div className={styles.inputWrapper}>
              <FiUser className={styles.inputIcon} />
              <input
                id="name"
                name="name"
                type="text"
                defaultValue={user.name}
                className={styles.input}
                required
              />
            </div>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="email">Email Address</label>
            <div className={styles.inputWrapper}>
              <FiMail className={styles.inputIcon} />
              <input
                id="email"
                name="email"
                type="email"
                defaultValue={user.email}
                className={styles.input}
                required
              />
            </div>
          </div>

          <SubmitButton label="Save Changes" />
        </form>
      </div>

      {/* AI Instructions Form */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h2>
            <FiCpu style={{ marginRight: '8px' }} />
            AI Instructions
          </h2>
        </div>
        <form action={handleAiInstructionsSubmit} className={styles.form}>
          {aiError && (
            <div className={styles.error}>{aiError}</div>
          )}
          {aiSuccess && (
            <div className={styles.success}>
              <FiCheck /> AI instructions updated
            </div>
          )}
          
          <div className={styles.formGroup}>
            <label htmlFor="aiInstructions">Custom Instructions</label>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
              These instructions will be included in every AI conversation. Use this to customize how the AI responds to you.
            </p>
            <textarea
              id="aiInstructions"
              name="aiInstructions"
              defaultValue={user.aiInstructions || ''}
              className={styles.textarea}
              rows={6}
              placeholder="Example: Always respond in a friendly, casual tone. My timezone is EST. I prefer concise answers unless I ask for more detail."
            />
          </div>

          <SubmitButton label="Save AI Instructions" />
        </form>
      </div>

      {/* Password Form */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h2>
            <FiLock style={{ marginRight: '8px' }} />
            Change Password
          </h2>
        </div>
        <form id="password-form" action={handlePasswordSubmit} className={styles.form}>
          {passwordError && (
            <div className={styles.error}>{passwordError}</div>
          )}
          {passwordSuccess && (
            <div className={styles.success}>
              <FiCheck /> Password changed successfully
            </div>
          )}
          
          <div className={styles.formGroup}>
            <label htmlFor="currentPassword">Current Password</label>
            <div className={styles.inputWrapper}>
              <FiLock className={styles.inputIcon} />
              <input
                id="currentPassword"
                name="currentPassword"
                type="password"
                className={styles.input}
                required
              />
            </div>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="newPassword">New Password</label>
            <div className={styles.inputWrapper}>
              <FiLock className={styles.inputIcon} />
              <input
                id="newPassword"
                name="newPassword"
                type="password"
                className={styles.input}
                required
              />
            </div>
            <span className={styles.hint}>
              Must be at least 8 characters with uppercase, lowercase, and numbers
            </span>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="confirmPassword">Confirm New Password</label>
            <div className={styles.inputWrapper}>
              <FiLock className={styles.inputIcon} />
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                className={styles.input}
                required
              />
            </div>
          </div>

          <SubmitButton label="Change Password" />
        </form>
      </div>
    </div>
  );
}
