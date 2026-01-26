'use client';

import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import { toast } from 'sonner';
import { FiCheck, FiUser, FiMail, FiMapPin, FiLinkedin, FiGithub, FiType, FiFileText } from 'react-icons/fi';
import { updatePortfolioSettingsAction } from '@/server/portfolio/actions';
import styles from '../portfolio.module.css';

interface PortfolioSettings {
  id: string;
  heroTitle: string;
  heroSubtitle: string;
  heroImage: string | null;
  aboutTitle: string;
  aboutText: string;
  aboutImage: string | null;
  name: string;
  profile: string;
  email: string;
  location: string;
  linkedIn: string | null;
  github: string | null;
  resumeSummary: string | null;
}

interface Props {
  settings: PortfolioSettings | null;
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={styles.submitBtn} disabled={pending}>
      {pending ? <span className={styles.spinner} /> : <><FiCheck /> Save Changes</>}
    </button>
  );
}

export default function PortfolioSettingsForm({ settings }: Props) {
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setError(null);
    setSuccess(false);
    
    const result = await updatePortfolioSettingsAction(formData);
    
    if (result.success) {
      setSuccess(true);
      toast.success('Settings saved successfully');
    } else {
      setError(result.error || 'Failed to save settings');
      toast.error(result.error || 'Failed to save settings');
    }
  }

  return (
    <form action={handleSubmit} className={styles.form}>
      {error && <div className={styles.error}>{error}</div>}
      {success && (
        <div className={styles.success}>
          <FiCheck /> Settings saved successfully
        </div>
      )}

      {/* Hero Section */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>
            <FiType className={styles.cardIcon} />
            Hero Section
          </h2>
        </div>
        <div className={styles.cardContent}>
          <div className={styles.formSection}>
            <div className={styles.formGrid}>
              <div className={styles.formGroup}>
                <label htmlFor="heroTitle">Hero Title</label>
                <input
                  id="heroTitle"
                  name="heroTitle"
                  type="text"
                  defaultValue={settings?.heroTitle || ''}
                  className={styles.input}
                  placeholder="Your Name"
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="heroImage">Hero Image URL</label>
                <input
                  id="heroImage"
                  name="heroImage"
                  type="text"
                  defaultValue={settings?.heroImage || ''}
                  className={styles.input}
                  placeholder="https://example.com/image.jpg"
                />
              </div>
              <div className={`${styles.formGroup} ${styles.formGroupFull}`}>
                <label htmlFor="heroSubtitle">Hero Subtitle</label>
                <input
                  id="heroSubtitle"
                  name="heroSubtitle"
                  type="text"
                  defaultValue={settings?.heroSubtitle || ''}
                  className={styles.input}
                  placeholder="Your professional tagline"
                  required
                />
                <span className={styles.hint}>This appears below your name on the homepage</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Contact Information */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>
            <FiUser className={styles.cardIcon} />
            Contact Information
          </h2>
        </div>
        <div className={styles.cardContent}>
          <div className={styles.formSection}>
            <div className={styles.formGrid}>
              <div className={styles.formGroup}>
                <label htmlFor="name">Full Name</label>
                <div className={styles.inputWrapper}>
                  <FiUser className={styles.inputIcon} />
                  <input
                    id="name"
                    name="name"
                    type="text"
                    defaultValue={settings?.name || ''}
                    className={`${styles.input} ${styles.inputWithIcon}`}
                    required
                  />
                </div>
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="profile">Professional Title</label>
                <input
                  id="profile"
                  name="profile"
                  type="text"
                  defaultValue={settings?.profile || ''}
                  className={styles.input}
                  placeholder="Senior Developer"
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="email">Email Address</label>
                <div className={styles.inputWrapper}>
                  <FiMail className={styles.inputIcon} />
                  <input
                    id="email"
                    name="email"
                    type="email"
                    defaultValue={settings?.email || ''}
                    className={`${styles.input} ${styles.inputWithIcon}`}
                    required
                  />
                </div>
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="location">Location</label>
                <div className={styles.inputWrapper}>
                  <FiMapPin className={styles.inputIcon} />
                  <input
                    id="location"
                    name="location"
                    type="text"
                    defaultValue={settings?.location || ''}
                    className={`${styles.input} ${styles.inputWithIcon}`}
                    placeholder="City, Country"
                    required
                  />
                </div>
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="linkedIn">LinkedIn URL</label>
                <div className={styles.inputWrapper}>
                  <FiLinkedin className={styles.inputIcon} />
                  <input
                    id="linkedIn"
                    name="linkedIn"
                    type="url"
                    defaultValue={settings?.linkedIn || ''}
                    className={`${styles.input} ${styles.inputWithIcon}`}
                    placeholder="https://linkedin.com/in/username"
                  />
                </div>
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="github">GitHub URL</label>
                <div className={styles.inputWrapper}>
                  <FiGithub className={styles.inputIcon} />
                  <input
                    id="github"
                    name="github"
                    type="url"
                    defaultValue={settings?.github || ''}
                    className={`${styles.input} ${styles.inputWithIcon}`}
                    placeholder="https://github.com/username"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* About Section */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>
            <FiFileText className={styles.cardIcon} />
            About Section
          </h2>
        </div>
        <div className={styles.cardContent}>
          <div className={styles.formSection}>
            <div className={styles.formGrid}>
              <div className={styles.formGroup}>
                <label htmlFor="aboutTitle">Section Title</label>
                <input
                  id="aboutTitle"
                  name="aboutTitle"
                  type="text"
                  defaultValue={settings?.aboutTitle || 'About Me'}
                  className={styles.input}
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="aboutImage">About Image URL</label>
                <input
                  id="aboutImage"
                  name="aboutImage"
                  type="text"
                  defaultValue={settings?.aboutImage || ''}
                  className={styles.input}
                  placeholder="https://example.com/about.jpg"
                />
              </div>
              <div className={`${styles.formGroup} ${styles.formGroupFull}`}>
                <label htmlFor="resumeSummary">Resume Summary</label>
                <textarea
                  id="resumeSummary"
                  name="resumeSummary"
                  defaultValue={settings?.resumeSummary || ''}
                  className={styles.textarea}
                  placeholder="A brief professional summary..."
                />
                <span className={styles.hint}>A short professional summary displayed in the about section</span>
              </div>
              <div className={`${styles.formGroup} ${styles.formGroupFull}`}>
                <label htmlFor="aboutText">About Text</label>
                <textarea
                  id="aboutText"
                  name="aboutText"
                  defaultValue={settings?.aboutText || ''}
                  className={`${styles.textarea} ${styles.textareaLarge}`}
                  placeholder="Tell your story in detail..."
                  required
                />
                <span className={styles.hint}>Use double line breaks for paragraphs. This is your main bio section.</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.formActions}>
        <SubmitButton />
      </div>
    </form>
  );
}
