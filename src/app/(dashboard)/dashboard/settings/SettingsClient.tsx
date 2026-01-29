'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { 
  FiGlobe, FiDroplet, FiShield, FiBell, FiCpu, FiLayout, 
  FiBriefcase, FiClock, FiLink, FiMail, FiTool,
  FiRefreshCw
} from 'react-icons/fi';
import { SiteSettings } from '@prisma/client';
import { updateSetting, resetSettings } from '@/server/settings/actions';
import styles from './settings.module.css';

interface SettingsClientProps {
  settings: SiteSettings;
}

type TabKey = 'general' | 'appearance' | 'security' | 'notifications' | 'ai' | 'dashboard' | 'portfolio' | 'timeTracking' | 'integrations' | 'email' | 'maintenance';

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: 'general', label: 'General', icon: <FiGlobe size={16} /> },
  { key: 'appearance', label: 'Appearance', icon: <FiDroplet size={16} /> },
  { key: 'security', label: 'Security', icon: <FiShield size={16} /> },
  { key: 'notifications', label: 'Notifications', icon: <FiBell size={16} /> },
  { key: 'ai', label: 'AI', icon: <FiCpu size={16} /> },
  { key: 'dashboard', label: 'Dashboard', icon: <FiLayout size={16} /> },
  { key: 'portfolio', label: 'Portfolio', icon: <FiBriefcase size={16} /> },
  { key: 'timeTracking', label: 'Time Tracking', icon: <FiClock size={16} /> },
  { key: 'integrations', label: 'Integrations', icon: <FiLink size={16} /> },
  { key: 'email', label: 'Email', icon: <FiMail size={16} /> },
  { key: 'maintenance', label: 'Maintenance', icon: <FiTool size={16} /> },
];

interface SettingRowProps {
  label: string;
  description: string;
  children: React.ReactNode;
}

function SettingRow({ label, description, children }: SettingRowProps) {
  return (
    <div className={styles.settingRow}>
      <div className={styles.settingInfo}>
        <div className={styles.settingLabel}>{label}</div>
        <p className={styles.settingDescription}>{description}</p>
      </div>
      <div className={styles.settingControl}>
        {children}
      </div>
    </div>
  );
}

interface ToggleProps {
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}

function Toggle({ value, onChange, disabled }: ToggleProps) {
  return (
    <button
      type="button"
      className={`${styles.toggle} ${value ? styles.toggleActive : ''}`}
      onClick={() => !disabled && onChange(!value)}
      disabled={disabled}
    >
      <div className={styles.toggleHandle} />
    </button>
  );
}

export default function SettingsClient({ settings: initialSettings }: SettingsClientProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('general');
  const [settings, setSettings] = useState<SiteSettings>(initialSettings);
  const [isPending, startTransition] = useTransition();
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const handleUpdate = async (key: keyof SiteSettings, value: string | number | boolean | null) => {
    setSavingKey(String(key));
    
    // Optimistic update
    setSettings((prev: SiteSettings) => ({ ...prev, [key]: value }));
    
    startTransition(async () => {
      const result = await updateSetting(key as keyof Omit<SiteSettings, 'id' | 'createdAt' | 'updatedAt'>, value);
      
      if (result.success) {
        toast.success(`${String(key)} updated`);
      } else {
        // Revert on error
        setSettings((prev: SiteSettings) => ({ ...prev, [key]: initialSettings[key] }));
        toast.error(result.error || 'Failed to update');
      }
      setSavingKey(null);
    });
  };

  const handleReset = async () => {
    if (!confirm('Are you sure you want to reset all settings to defaults?')) return;
    
    startTransition(async () => {
      const result = await resetSettings();
      
      if (result.success && result.settings) {
        setSettings(result.settings as SiteSettings);
        toast.success('Settings reset to defaults');
      } else {
        toast.error(result.error || 'Failed to reset settings');
      }
    });
  };

  const renderGeneralTab = () => (
    <>
      <div className={styles.panelHeader}>
        <h2 className={styles.panelTitle}><FiGlobe /> General Settings</h2>
        <p className={styles.panelDescription}>Basic site configuration and preferences</p>
      </div>
      <div className={styles.panelContent}>
        <div className={styles.settingsGrid}>
          <SettingRow label="Site Name" description="The name displayed in the browser tab and header">
            <input
              type="text"
              className={styles.input}
              value={settings.siteName}
              onChange={(e) => handleUpdate('siteName', e.target.value)}
            />
          </SettingRow>
          
          <SettingRow label="Site Tagline" description="A short description of your site">
            <input
              type="text"
              className={styles.input}
              value={settings.siteTagline}
              onChange={(e) => handleUpdate('siteTagline', e.target.value)}
            />
          </SettingRow>
          
          <SettingRow label="Site URL" description="The public URL of your site">
            <input
              type="url"
              className={styles.input}
              value={settings.siteUrl}
              onChange={(e) => handleUpdate('siteUrl', e.target.value)}
            />
          </SettingRow>
          
          <SettingRow label="Timezone" description="Your local timezone for scheduling and displays">
            <select
              className={styles.select}
              value={settings.timezone}
              onChange={(e) => handleUpdate('timezone', e.target.value)}
            >
              <option value="America/Toronto">America/Toronto (EST)</option>
              <option value="America/New_York">America/New_York (EST)</option>
              <option value="America/Chicago">America/Chicago (CST)</option>
              <option value="America/Denver">America/Denver (MST)</option>
              <option value="America/Los_Angeles">America/Los_Angeles (PST)</option>
              <option value="Europe/London">Europe/London (GMT)</option>
              <option value="Europe/Paris">Europe/Paris (CET)</option>
              <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
              <option value="UTC">UTC</option>
            </select>
          </SettingRow>
          
          <SettingRow label="Date Format" description="How dates are displayed throughout the site">
            <select
              className={styles.select}
              value={settings.dateFormat}
              onChange={(e) => handleUpdate('dateFormat', e.target.value)}
            >
              <option value="MMM dd, yyyy">Jan 28, 2026</option>
              <option value="dd/MM/yyyy">28/01/2026</option>
              <option value="MM/dd/yyyy">01/28/2026</option>
              <option value="yyyy-MM-dd">2026-01-28</option>
            </select>
          </SettingRow>
          
          <SettingRow label="Time Format" description="12-hour or 24-hour time display">
            <select
              className={styles.select}
              value={settings.timeFormat}
              onChange={(e) => handleUpdate('timeFormat', e.target.value)}
            >
              <option value="h:mm a">12-hour (3:30 PM)</option>
              <option value="HH:mm">24-hour (15:30)</option>
            </select>
          </SettingRow>
          
          <SettingRow label="Language" description="Interface language">
            <select
              className={styles.select}
              value={settings.language}
              onChange={(e) => handleUpdate('language', e.target.value)}
            >
              <option value="en">English</option>
              <option value="fr">Français</option>
              <option value="es">Español</option>
              <option value="de">Deutsch</option>
            </select>
          </SettingRow>
        </div>
      </div>
    </>
  );

  const renderAppearanceTab = () => (
    <>
      <div className={styles.panelHeader}>
        <h2 className={styles.panelTitle}><FiDroplet /> Appearance</h2>
        <p className={styles.panelDescription}>Customize the look and feel of your dashboard</p>
      </div>
      <div className={styles.panelContent}>
        <div className={styles.settingsGrid}>
          <SettingRow label="Theme" description="Choose your preferred color scheme">
            <select
              className={styles.select}
              value={settings.theme}
              onChange={(e) => handleUpdate('theme', e.target.value)}
            >
              <option value="dark">Dark</option>
              <option value="light">Light</option>
              <option value="system">System</option>
            </select>
          </SettingRow>
          
          <SettingRow label="Accent Color" description="Primary color for buttons and highlights">
            <div className={styles.colorPicker}>
              <div
                className={styles.colorSwatch}
                style={{ backgroundColor: settings.accentColor }}
                onClick={() => document.getElementById('colorInput')?.click()}
              />
              <input
                id="colorInput"
                type="color"
                className={styles.colorInput}
                value={settings.accentColor}
                onChange={(e) => handleUpdate('accentColor', e.target.value)}
              />
              <input
                type="text"
                className={`${styles.input} ${styles.inputSmall}`}
                value={settings.accentColor}
                onChange={(e) => handleUpdate('accentColor', e.target.value)}
              />
            </div>
          </SettingRow>
          
          <SettingRow label="Enable Animations" description="Show smooth animations and transitions">
            <Toggle
              value={settings.enableAnimations}
              onChange={(v) => handleUpdate('enableAnimations', v)}
            />
          </SettingRow>
          
          <SettingRow label="Sidebar Collapsed" description="Start with sidebar collapsed by default">
            <Toggle
              value={settings.sidebarCollapsed}
              onChange={(v) => handleUpdate('sidebarCollapsed', v)}
            />
          </SettingRow>
          
          <SettingRow label="Compact Mode" description="Use smaller spacing and font sizes">
            <Toggle
              value={settings.compactMode}
              onChange={(v) => handleUpdate('compactMode', v)}
            />
          </SettingRow>
        </div>
      </div>
    </>
  );

  const renderSecurityTab = () => (
    <>
      <div className={styles.panelHeader}>
        <h2 className={styles.panelTitle}><FiShield /> Security Settings</h2>
        <p className={styles.panelDescription}>Configure authentication and security options</p>
      </div>
      <div className={styles.panelContent}>
        <div className={styles.settingsGrid}>
          <SettingRow label="Session Duration" description="How long users stay logged in (days)">
            <input
              type="number"
              className={`${styles.input} ${styles.inputSmall}`}
              value={settings.sessionDurationDays}
              min={1}
              max={365}
              onChange={(e) => handleUpdate('sessionDurationDays', parseInt(e.target.value) || 30)}
            />
          </SettingRow>
          
          <SettingRow label="Require Strong Password" description="Enforce 8+ chars with mixed case and numbers">
            <Toggle
              value={settings.requireStrongPassword}
              onChange={(v) => handleUpdate('requireStrongPassword', v)}
            />
          </SettingRow>
          
          <SettingRow label="Max Login Attempts" description="Lock account after this many failed attempts">
            <input
              type="number"
              className={`${styles.input} ${styles.inputSmall}`}
              value={settings.maxLoginAttempts}
              min={1}
              max={20}
              onChange={(e) => handleUpdate('maxLoginAttempts', parseInt(e.target.value) || 5)}
            />
          </SettingRow>
          
          <SettingRow label="Lockout Duration" description="Minutes to lock account after failed attempts">
            <input
              type="number"
              className={`${styles.input} ${styles.inputSmall}`}
              value={settings.lockoutDurationMins}
              min={1}
              max={1440}
              onChange={(e) => handleUpdate('lockoutDurationMins', parseInt(e.target.value) || 15)}
            />
          </SettingRow>
          
          <SettingRow label="Two-Factor Authentication" description="Require 2FA for all users">
            <Toggle
              value={settings.enable2FA}
              onChange={(v) => handleUpdate('enable2FA', v)}
            />
          </SettingRow>
        </div>
      </div>
    </>
  );

  const renderNotificationsTab = () => (
    <>
      <div className={styles.panelHeader}>
        <h2 className={styles.panelTitle}><FiBell /> Notification Settings</h2>
        <p className={styles.panelDescription}>Configure how and when you receive notifications</p>
      </div>
      <div className={styles.panelContent}>
        <div className={styles.settingsGrid}>
          <SettingRow label="Email Notifications" description="Receive notifications via email">
            <Toggle
              value={settings.enableEmailNotifications}
              onChange={(v) => handleUpdate('enableEmailNotifications', v)}
            />
          </SettingRow>
          
          <SettingRow label="Push Notifications" description="Receive browser push notifications">
            <Toggle
              value={settings.enablePushNotifications}
              onChange={(v) => handleUpdate('enablePushNotifications', v)}
            />
          </SettingRow>
          
          <SettingRow label="Digest Frequency" description="How often to send notification digests">
            <select
              className={styles.select}
              value={settings.notificationDigestFreq}
              onChange={(e) => handleUpdate('notificationDigestFreq', e.target.value)}
            >
              <option value="instant">Instant</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </select>
          </SettingRow>
          
          <SettingRow label="Quiet Hours Start" description="Mute notifications starting at this time">
            <input
              type="time"
              className={styles.input}
              value={settings.quietHoursStart || ''}
              onChange={(e) => handleUpdate('quietHoursStart', e.target.value || null)}
            />
          </SettingRow>
          
          <SettingRow label="Quiet Hours End" description="Resume notifications at this time">
            <input
              type="time"
              className={styles.input}
              value={settings.quietHoursEnd || ''}
              onChange={(e) => handleUpdate('quietHoursEnd', e.target.value || null)}
            />
          </SettingRow>
        </div>
      </div>
    </>
  );

  const renderAITab = () => (
    <>
      <div className={styles.panelHeader}>
        <h2 className={styles.panelTitle}><FiCpu /> AI Settings</h2>
        <p className={styles.panelDescription}>Configure AI assistant behavior and capabilities</p>
      </div>
      <div className={styles.panelContent}>
        <div className={styles.settingsGrid}>
          <SettingRow label="AI Enabled" description="Enable AI assistant features">
            <Toggle
              value={settings.aiEnabled}
              onChange={(v) => handleUpdate('aiEnabled', v)}
            />
          </SettingRow>
          
          <SettingRow label="Default Model" description="The AI model to use for conversations">
            <input
              type="text"
              className={styles.input}
              value={settings.aiDefaultModel}
              onChange={(e) => handleUpdate('aiDefaultModel', e.target.value)}
            />
          </SettingRow>
          
          <SettingRow label="Max Tokens" description="Maximum response length">
            <input
              type="number"
              className={`${styles.input} ${styles.inputSmall}`}
              value={settings.aiMaxTokens}
              min={256}
              max={32768}
              onChange={(e) => handleUpdate('aiMaxTokens', parseInt(e.target.value) || 4096)}
            />
          </SettingRow>
          
          <SettingRow label="Temperature" description="Creativity level (0 = focused, 1 = creative)">
            <input
              type="number"
              className={`${styles.input} ${styles.inputSmall}`}
              value={settings.aiTemperature}
              min={0}
              max={2}
              step={0.1}
              onChange={(e) => handleUpdate('aiTemperature', parseFloat(e.target.value) || 0.7)}
            />
          </SettingRow>
          
          <SettingRow label="Memory Enabled" description="Allow AI to remember information across sessions">
            <Toggle
              value={settings.aiMemoryEnabled}
              onChange={(v) => handleUpdate('aiMemoryEnabled', v)}
            />
          </SettingRow>
          
          <SettingRow label="Proactive Memory" description="AI proactively recalls relevant memories">
            <Toggle
              value={settings.aiProactiveMemory}
              onChange={(v) => handleUpdate('aiProactiveMemory', v)}
            />
          </SettingRow>
        </div>
      </div>
    </>
  );

  const renderDashboardTab = () => (
    <>
      <div className={styles.panelHeader}>
        <h2 className={styles.panelTitle}><FiLayout /> Dashboard Settings</h2>
        <p className={styles.panelDescription}>Customize your dashboard experience</p>
      </div>
      <div className={styles.panelContent}>
        <div className={styles.settingsGrid}>
          <SettingRow label="Layout" description="Choose your preferred dashboard layout">
            <select
              className={styles.select}
              value={settings.dashboardLayout}
              onChange={(e) => handleUpdate('dashboardLayout', e.target.value)}
            >
              <option value="default">Default</option>
              <option value="compact">Compact</option>
              <option value="expanded">Expanded</option>
            </select>
          </SettingRow>
          
          <SettingRow label="Welcome Message" description="Show greeting on dashboard">
            <Toggle
              value={settings.showWelcomeMessage}
              onChange={(v) => handleUpdate('showWelcomeMessage', v)}
            />
          </SettingRow>
          
          <SettingRow label="Default Tab" description="Which tab to show on dashboard load">
            <select
              className={styles.select}
              value={settings.defaultDashboardTab}
              onChange={(e) => handleUpdate('defaultDashboardTab', e.target.value)}
            >
              <option value="overview">Overview</option>
              <option value="analytics">Analytics</option>
              <option value="tasks">Tasks</option>
            </select>
          </SettingRow>
          
          <SettingRow label="Quick Actions" description="Show quick action buttons">
            <Toggle
              value={settings.enableQuickActions}
              onChange={(v) => handleUpdate('enableQuickActions', v)}
            />
          </SettingRow>
        </div>
      </div>
    </>
  );

  const renderPortfolioTab = () => (
    <>
      <div className={styles.panelHeader}>
        <h2 className={styles.panelTitle}><FiBriefcase /> Portfolio Settings</h2>
        <p className={styles.panelDescription}>Configure your public portfolio page</p>
      </div>
      <div className={styles.panelContent}>
        <div className={styles.settingsGrid}>
          <SettingRow label="Portfolio Enabled" description="Show the portfolio section">
            <Toggle
              value={settings.portfolioEnabled}
              onChange={(v) => handleUpdate('portfolioEnabled', v)}
            />
          </SettingRow>
          
          <SettingRow label="Public Access" description="Allow visitors without login">
            <Toggle
              value={settings.portfolioPublic}
              onChange={(v) => handleUpdate('portfolioPublic', v)}
            />
          </SettingRow>
          
          <SettingRow label="Contact Form" description="Show contact form on portfolio">
            <Toggle
              value={settings.showContactForm}
              onChange={(v) => handleUpdate('showContactForm', v)}
            />
          </SettingRow>
          
          <SettingRow label="Blog Comments" description="Allow comments on blog posts">
            <Toggle
              value={settings.enableBlogComments}
              onChange={(v) => handleUpdate('enableBlogComments', v)}
            />
          </SettingRow>
        </div>
      </div>
    </>
  );

  const renderTimeTrackingTab = () => (
    <>
      <div className={styles.panelHeader}>
        <h2 className={styles.panelTitle}><FiClock /> Time Tracking Settings</h2>
        <p className={styles.panelDescription}>Configure time tracking and billing options</p>
      </div>
      <div className={styles.panelContent}>
        <div className={styles.settingsGrid}>
          <SettingRow label="Time Tracking Enabled" description="Enable time tracking features">
            <Toggle
              value={settings.timeTrackingEnabled}
              onChange={(v) => handleUpdate('timeTrackingEnabled', v)}
            />
          </SettingRow>
          
          <SettingRow label="Default Billable Rate" description="Default hourly rate for new entries ($)">
            <input
              type="number"
              className={`${styles.input} ${styles.inputSmall}`}
              value={settings.defaultBillableRate}
              min={0}
              step={0.01}
              onChange={(e) => handleUpdate('defaultBillableRate', parseFloat(e.target.value) || 0)}
            />
          </SettingRow>
          
          <SettingRow label="Reminder Time" description="Daily reminder to log time">
            <input
              type="time"
              className={styles.input}
              value={settings.trackingReminderTime || ''}
              onChange={(e) => handleUpdate('trackingReminderTime', e.target.value || null)}
            />
          </SettingRow>
          
          <SettingRow label="Auto-Stop Timer" description="Stop timer after this many hours">
            <input
              type="number"
              className={`${styles.input} ${styles.inputSmall}`}
              value={settings.autoStopTimerHours}
              min={1}
              max={24}
              onChange={(e) => handleUpdate('autoStopTimerHours', parseInt(e.target.value) || 8)}
            />
          </SettingRow>
          
          <SettingRow label="Round Time To" description="Round time entries to nearest minutes">
            <select
              className={styles.select}
              value={settings.roundTimeTo}
              onChange={(e) => handleUpdate('roundTimeTo', parseInt(e.target.value))}
            >
              <option value={1}>1 minute</option>
              <option value={5}>5 minutes</option>
              <option value={15}>15 minutes</option>
              <option value={30}>30 minutes</option>
              <option value={60}>1 hour</option>
            </select>
          </SettingRow>
        </div>
      </div>
    </>
  );

  const renderIntegrationsTab = () => (
    <>
      <div className={styles.panelHeader}>
        <h2 className={styles.panelTitle}><FiLink /> Integrations</h2>
        <p className={styles.panelDescription}>Connect with external services</p>
      </div>
      <div className={styles.panelContent}>
        <div className={styles.settingsGrid}>
          <SettingRow label="Google Calendar Sync" description="Sync events with Google Calendar">
            <Toggle
              value={settings.googleCalendarSync}
              onChange={(v) => handleUpdate('googleCalendarSync', v)}
            />
          </SettingRow>
          
          <SettingRow label="Google Contacts Sync" description="Sync contacts with Google Contacts">
            <Toggle
              value={settings.googleContactsSync}
              onChange={(v) => handleUpdate('googleContactsSync', v)}
            />
          </SettingRow>
          
          <SettingRow label="Slack Integration" description="Send notifications to Slack">
            <Toggle
              value={settings.slackIntegration}
              onChange={(v) => handleUpdate('slackIntegration', v)}
            />
          </SettingRow>
          
          <SettingRow label="Webhooks Enabled" description="Allow webhook integrations">
            <Toggle
              value={settings.webhooksEnabled}
              onChange={(v) => handleUpdate('webhooksEnabled', v)}
            />
          </SettingRow>
        </div>
      </div>
    </>
  );

  const renderEmailTab = () => (
    <>
      <div className={styles.panelHeader}>
        <h2 className={styles.panelTitle}><FiMail /> Email Settings (SMTP)</h2>
        <p className={styles.panelDescription}>Configure outgoing email server</p>
      </div>
      <div className={styles.panelContent}>
        <div className={styles.settingsGrid}>
          <SettingRow label="SMTP Enabled" description="Enable outgoing email">
            <Toggle
              value={settings.smtpEnabled}
              onChange={(v) => handleUpdate('smtpEnabled', v)}
            />
          </SettingRow>
          
          <SettingRow label="SMTP Host" description="Mail server hostname">
            <input
              type="text"
              className={styles.input}
              value={settings.smtpHost || ''}
              placeholder="smtp.gmail.com"
              onChange={(e) => handleUpdate('smtpHost', e.target.value || null)}
            />
          </SettingRow>
          
          <SettingRow label="SMTP Port" description="Mail server port">
            <input
              type="number"
              className={`${styles.input} ${styles.inputSmall}`}
              value={settings.smtpPort}
              onChange={(e) => handleUpdate('smtpPort', parseInt(e.target.value) || 587)}
            />
          </SettingRow>
          
          <SettingRow label="SMTP User" description="Authentication username">
            <input
              type="text"
              className={styles.input}
              value={settings.smtpUser || ''}
              onChange={(e) => handleUpdate('smtpUser', e.target.value || null)}
            />
          </SettingRow>
          
          <SettingRow label="SMTP Password" description="Authentication password">
            <input
              type="password"
              className={styles.input}
              value={settings.smtpPassword || ''}
              placeholder="••••••••"
              onChange={(e) => handleUpdate('smtpPassword', e.target.value || null)}
            />
          </SettingRow>
          
          <SettingRow label="From Email" description="Sender email address">
            <input
              type="email"
              className={styles.input}
              value={settings.smtpFromEmail || ''}
              placeholder="noreply@example.com"
              onChange={(e) => handleUpdate('smtpFromEmail', e.target.value || null)}
            />
          </SettingRow>
          
          <SettingRow label="From Name" description="Sender display name">
            <input
              type="text"
              className={styles.input}
              value={settings.smtpFromName || ''}
              placeholder="North Star"
              onChange={(e) => handleUpdate('smtpFromName', e.target.value || null)}
            />
          </SettingRow>
          
          <SettingRow label="Use TLS/SSL" description="Encrypt connection to mail server">
            <Toggle
              value={settings.smtpSecure}
              onChange={(v) => handleUpdate('smtpSecure', v)}
            />
          </SettingRow>
        </div>
      </div>
    </>
  );

  const renderMaintenanceTab = () => (
    <>
      <div className={styles.panelHeader}>
        <h2 className={styles.panelTitle}><FiTool /> Maintenance</h2>
        <p className={styles.panelDescription}>System maintenance and debugging options</p>
      </div>
      <div className={styles.panelContent}>
        <div className={styles.settingsGrid}>
          <SettingRow label="Maintenance Mode" description="Show maintenance page to visitors">
            <Toggle
              value={settings.maintenanceMode}
              onChange={(v) => handleUpdate('maintenanceMode', v)}
            />
          </SettingRow>
          
          <SettingRow label="Maintenance Message" description="Message shown during maintenance">
            <input
              type="text"
              className={styles.input}
              value={settings.maintenanceMessage || ''}
              placeholder="Site is under maintenance..."
              onChange={(e) => handleUpdate('maintenanceMessage', e.target.value || null)}
            />
          </SettingRow>
          
          <SettingRow label="Debug Mode" description="Enable verbose logging">
            <Toggle
              value={settings.debugMode}
              onChange={(v) => handleUpdate('debugMode', v)}
            />
          </SettingRow>
          
          <SettingRow label="Log Retention" description="Days to keep log entries">
            <input
              type="number"
              className={`${styles.input} ${styles.inputSmall}`}
              value={settings.logRetentionDays}
              min={1}
              max={365}
              onChange={(e) => handleUpdate('logRetentionDays', parseInt(e.target.value) || 30)}
            />
          </SettingRow>
        </div>
      </div>
      
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.btnDanger}
          onClick={handleReset}
          disabled={isPending}
        >
          <FiRefreshCw />
          Reset All Settings
        </button>
      </div>
    </>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'general': return renderGeneralTab();
      case 'appearance': return renderAppearanceTab();
      case 'security': return renderSecurityTab();
      case 'notifications': return renderNotificationsTab();
      case 'ai': return renderAITab();
      case 'dashboard': return renderDashboardTab();
      case 'portfolio': return renderPortfolioTab();
      case 'timeTracking': return renderTimeTrackingTab();
      case 'integrations': return renderIntegrationsTab();
      case 'email': return renderEmailTab();
      case 'maintenance': return renderMaintenanceTab();
      default: return null;
    }
  };

  return (
    <div className={styles.container}>
      {/* Tabs */}
      <div className={styles.tabs}>
        {TABS.map((tab) => (
          <button
            key={tab.key}
            className={`${styles.tab} ${activeTab === tab.key ? styles.tabActive : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content Panel */}
      <div className={styles.panel}>
        {renderTabContent()}
      </div>

      {/* Saving Indicator */}
      {savingKey && (
        <div className={styles.saving}>
          <div className={styles.spinner} />
          Saving...
        </div>
      )}
    </div>
  );
}
