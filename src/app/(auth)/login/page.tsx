'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useFormStatus } from 'react-dom';
import { FiMail, FiLock, FiEye, FiEyeOff, FiAlertCircle } from 'react-icons/fi';
import { loginAction } from '@/server/auth/actions';
import styles from './login.module.css';

function SubmitButton() {
  const { pending } = useFormStatus();
  
  return (
    <button type="submit" className={styles.submitBtn} disabled={pending}>
      {pending ? (
        <span className={styles.spinner} />
      ) : (
        'Sign In'
      )}
    </button>
  );
}

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function handleSubmit(formData: FormData) {
    setError(null);
    setFieldErrors({});
    
    const result = await loginAction(formData);
    
    if (!result.success) {
      if (result.error) {
        setError(result.error);
      }
      if (result.errors) {
        setFieldErrors(result.errors);
      }
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.glow} />
      
      <motion.div
        className={styles.card}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className={styles.header}>
          <Link href="/" className={styles.logo}>
            <div className={styles.logoIcon}>★</div>
            <span>North Star</span>
          </Link>
          <h1 className={styles.title}>Welcome Back</h1>
          <p className={styles.subtitle}>Sign in to access your dashboard</p>
        </div>

        {error && (
          <motion.div
            className={styles.error}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
          >
            <FiAlertCircle />
            <span>{error}</span>
          </motion.div>
        )}

        <form action={handleSubmit} className={styles.form}>
          <div className={styles.formGroup}>
            <label htmlFor="email" className={styles.label}>Email</label>
            <div className={styles.inputWrapper}>
              <FiMail className={styles.inputIcon} />
              <input
                id="email"
                name="email"
                type="email"
                placeholder="you@example.com"
                className={`${styles.input} ${fieldErrors.email ? styles.inputError : ''}`}
                required
              />
            </div>
            {fieldErrors.email && (
              <span className={styles.fieldError}>{fieldErrors.email}</span>
            )}
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="password" className={styles.label}>Password</label>
            <div className={styles.inputWrapper}>
              <FiLock className={styles.inputIcon} />
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                className={`${styles.input} ${fieldErrors.password ? styles.inputError : ''}`}
                required
              />
              <button
                type="button"
                className={styles.togglePassword}
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <FiEyeOff /> : <FiEye />}
              </button>
            </div>
            {fieldErrors.password && (
              <span className={styles.fieldError}>{fieldErrors.password}</span>
            )}
          </div>

          <SubmitButton />
        </form>

        <div className={styles.footer}>
          <p>
            Don&apos;t have an account?{' '}
            <Link href="/register" className={styles.link}>
              Sign up
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
