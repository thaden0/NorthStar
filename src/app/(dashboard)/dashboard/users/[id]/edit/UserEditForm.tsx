'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useFormStatus } from 'react-dom';
import { toast } from 'sonner';
import { FiUser, FiMail, FiLock, FiShield, FiCheck, FiTrash2, FiAlertTriangle } from 'react-icons/fi';
import { 
  updateUserAction, 
  resetUserPasswordAction, 
  updateUserRolesAction,
  deleteUserAction 
} from '@/server/users/actions';
import styles from './user-edit.module.css';

interface Role {
  id: string;
  name: string;
  description: string | null;
}

interface UserRole {
  id: string;
  roleId: string;
  role: Role;
}

interface User {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  emailVerified: boolean;
  createdAt: Date;
  roles: UserRole[];
}

interface UserEditFormProps {
  user: User;
  allRoles: Role[];
  isCurrentUser: boolean;
}

function SubmitButton({ label, variant = 'primary' }: { label: string; variant?: 'primary' | 'danger' }) {
  const { pending } = useFormStatus();
  return (
    <button 
      type="submit" 
      className={variant === 'danger' ? styles.deleteBtn : styles.submitBtn} 
      disabled={pending}
    >
      {pending ? <span className={styles.spinner} /> : label}
    </button>
  );
}

export default function UserEditForm({ user, allRoles, isCurrentUser }: UserEditFormProps) {
  const router = useRouter();
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [rolesSuccess, setRolesSuccess] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [rolesError, setRolesError] = useState<string | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<string[]>(
    user.roles.map(r => r.roleId)
  );
  const [isDeleting, setIsDeleting] = useState(false);

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  async function handleProfileSubmit(formData: FormData) {
    setProfileError(null);
    setProfileSuccess(false);
    
    const result = await updateUserAction(user.id, formData);
    
    if (result.success) {
      setProfileSuccess(true);
      toast.success('User profile updated');
      router.refresh();
    } else {
      const error = result.error || Object.values(result.errors || {}).join(', ');
      setProfileError(error);
      toast.error(error);
    }
  }

  async function handlePasswordSubmit(formData: FormData) {
    setPasswordError(null);
    setPasswordSuccess(false);
    
    const result = await resetUserPasswordAction(user.id, formData);
    
    if (result.success) {
      setPasswordSuccess(true);
      toast.success('Password reset successfully');
      const form = document.getElementById('password-form') as HTMLFormElement;
      form?.reset();
    } else {
      const error = result.error || Object.values(result.errors || {}).join(', ');
      setPasswordError(error);
      toast.error(error);
    }
  }

  async function handleRolesSubmit(e: React.FormEvent) {
    e.preventDefault();
    setRolesError(null);
    setRolesSuccess(false);
    
    const result = await updateUserRolesAction(user.id, selectedRoles);
    
    if (result.success) {
      setRolesSuccess(true);
      toast.success('User roles updated');
      router.refresh();
    } else {
      setRolesError(result.error || 'Failed to update roles');
      toast.error(result.error || 'Failed to update roles');
    }
  }

  function toggleRole(roleId: string) {
    setSelectedRoles(prev => 
      prev.includes(roleId) 
        ? prev.filter(id => id !== roleId)
        : [...prev, roleId]
    );
  }

  async function handleDelete() {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      return;
    }
    
    setIsDeleting(true);
    const result = await deleteUserAction(user.id);
    
    if (!result.success) {
      toast.error(result.error || 'Failed to delete user');
      setIsDeleting(false);
    }
    // If successful, the action will redirect
  }

  return (
    <div className={styles.container}>
      {/* User Header */}
      <div className={styles.userHeader}>
        <div className={styles.avatar}>
          {user.avatar ? (
            <img src={user.avatar} alt={user.name} />
          ) : (
            <span>{getInitials(user.name)}</span>
          )}
        </div>
        <div className={styles.userInfo}>
          <h2>{user.name}</h2>
          <p>{user.email}</p>
          <div className={styles.userMeta}>
            <span className={styles.metaItem}>
              <FiUser size={14} />
              Joined {new Date(user.createdAt).toLocaleDateString()}
            </span>
            <span className={styles.metaItem}>
              <FiShield size={14} />
              {user.roles.map(r => r.role.name).join(', ') || 'No roles'}
            </span>
          </div>
        </div>
      </div>

      {/* Profile Form */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h3>
            <FiUser />
            Profile Information
          </h3>
        </div>
        <div className={styles.cardContent}>
          <form action={handleProfileSubmit} className={styles.form}>
            {profileError && (
              <div className={styles.error}>{profileError}</div>
            )}
            {profileSuccess && (
              <div className={styles.success}>
                <FiCheck /> Profile updated successfully
              </div>
            )}
            
            <div className={styles.formRow}>
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
            </div>

            <div className={styles.formActions}>
              <SubmitButton label="Save Changes" />
            </div>
          </form>
        </div>
      </div>

      {/* Roles Form */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h3>
            <FiShield />
            User Roles
          </h3>
        </div>
        <div className={styles.cardContent}>
          <form onSubmit={handleRolesSubmit} className={styles.form}>
            {rolesError && (
              <div className={styles.error}>{rolesError}</div>
            )}
            {rolesSuccess && (
              <div className={styles.success}>
                <FiCheck /> Roles updated successfully
              </div>
            )}
            
            <div className={styles.rolesGrid}>
              {allRoles.map(role => (
                <label 
                  key={role.id} 
                  className={`${styles.roleCheckbox} ${selectedRoles.includes(role.id) ? styles.active : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={selectedRoles.includes(role.id)}
                    onChange={() => toggleRole(role.id)}
                    disabled={isCurrentUser && role.name === 'Super Admin'}
                  />
                  <span>{role.name}</span>
                </label>
              ))}
            </div>

            <div className={styles.formActions}>
              <button type="submit" className={styles.submitBtn}>
                Update Roles
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Reset Password */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h3>
            <FiLock />
            Reset Password
          </h3>
        </div>
        <div className={styles.cardContent}>
          <form id="password-form" action={handlePasswordSubmit} className={styles.form}>
            {passwordError && (
              <div className={styles.error}>{passwordError}</div>
            )}
            {passwordSuccess && (
              <div className={styles.success}>
                <FiCheck /> Password reset successfully
              </div>
            )}
            
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

            <div className={styles.formActions}>
              <SubmitButton label="Reset Password" />
            </div>
          </form>
        </div>
      </div>

      {/* Danger Zone */}
      {!isCurrentUser && (
        <div className={`${styles.card} ${styles.dangerZone}`}>
          <div className={styles.cardHeader}>
            <h3>
              <FiAlertTriangle />
              Danger Zone
            </h3>
          </div>
          <div className={styles.cardContent}>
            <p className={styles.dangerText}>
              Once you delete a user, there is no going back. This will permanently remove the user 
              and all their data from the system.
            </p>
            <button 
              type="button"
              className={styles.deleteBtn}
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <span className={styles.spinner} />
              ) : (
                <>
                  <FiTrash2 />
                  Delete User
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
