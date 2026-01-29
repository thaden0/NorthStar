'use client';

import { useState, useEffect } from 'react';
import { FiX } from 'react-icons/fi';
import { toast } from 'sonner';
import { getInvoiceSettingsAction, updateInvoiceSettingsAction } from '@/server/timeTracking/actions';
import type { InvoiceSettings } from '@/types/timeTracking';
import styles from './clients.module.css';

interface InvoiceSettingsModalProps {
  onClose: () => void;
}

export default function InvoiceSettingsModal({ onClose }: InvoiceSettingsModalProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<Partial<InvoiceSettings>>({});

  useEffect(() => {
    async function loadSettings() {
      try {
        const result = await getInvoiceSettingsAction();
        if (result.success && result.data) {
          setSettings(result.data as InvoiceSettings);
        }
      } catch (error) {
        console.error('Failed to load settings:', error);
        toast.error('Failed to load settings');
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const formData = new FormData();
      if (settings.businessName) formData.set('businessName', settings.businessName);
      if (settings.businessEmail) formData.set('businessEmail', settings.businessEmail);
      if (settings.businessPhone) formData.set('businessPhone', settings.businessPhone);
      if (settings.businessAddress) formData.set('businessAddress', settings.businessAddress);
      if (settings.defaultTaxRate !== undefined) formData.set('defaultTaxRate', settings.defaultTaxRate.toString());
      if (settings.defaultPaymentTerms) formData.set('defaultPaymentTerms', settings.defaultPaymentTerms);
      if (settings.defaultNotes) formData.set('defaultNotes', settings.defaultNotes);
      if (settings.invoicePrefix) formData.set('invoicePrefix', settings.invoicePrefix);
      if (settings.nextInvoiceNumber !== undefined) formData.set('nextInvoiceNumber', settings.nextInvoiceNumber.toString());

      const result = await updateInvoiceSettingsAction(formData);
      if (result.success) {
        toast.success('Invoice settings updated');
        onClose();
      } else {
        toast.error(result.error || 'Failed to update settings');
      }
    } catch (error) {
      console.error('Failed to update settings:', error);
      toast.error('Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.modal}>
        <div className={styles.modalOverlay} onClick={onClose} />
        <div className={styles.modalContent}>
          <div className={styles.modalHeader}>
            <h2 className={styles.modalTitle}>Invoice Settings</h2>
            <button className={styles.modalCloseBtn} onClick={onClose}>
              <FiX size={20} />
            </button>
          </div>
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.modal}>
      <div className={styles.modalOverlay} onClick={onClose} />
      <div className={styles.modalContent}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Invoice Settings</h2>
          <button className={styles.modalCloseBtn} onClick={onClose}>
            <FiX size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className={styles.formGroup}>
            <label className={styles.label}>Business Name *</label>
            <input
              type="text"
              className={styles.input}
              value={settings.businessName || ''}
              onChange={(e) => setSettings({ ...settings, businessName: e.target.value })}
              placeholder="Your Business Name"
            />
            <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
              This appears at the top of your invoices
            </small>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Business Email</label>
            <input
              type="email"
              className={styles.input}
              value={settings.businessEmail || ''}
              onChange={(e) => setSettings({ ...settings, businessEmail: e.target.value })}
              placeholder="billing@example.com"
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Business Phone</label>
            <input
              type="tel"
              className={styles.input}
              value={settings.businessPhone || ''}
              onChange={(e) => setSettings({ ...settings, businessPhone: e.target.value })}
              placeholder="+1 (555) 123-4567"
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Business Address</label>
            <textarea
              className={styles.textarea}
              value={settings.businessAddress || ''}
              onChange={(e) => setSettings({ ...settings, businessAddress: e.target.value })}
              placeholder="123 Main St&#10;City, State 12345"
              rows={3}
            />
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label className={styles.label}>Invoice Prefix</label>
              <input
                type="text"
                className={styles.input}
                value={settings.invoicePrefix || 'INV-'}
                onChange={(e) => setSettings({ ...settings, invoicePrefix: e.target.value })}
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>Next Invoice #</label>
              <input
                type="number"
                className={styles.input}
                value={settings.nextInvoiceNumber || 1}
                onChange={(e) => setSettings({ ...settings, nextInvoiceNumber: parseInt(e.target.value) || 1 })}
                min="1"
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>Default Tax Rate (%)</label>
              <input
                type="number"
                className={styles.input}
                value={settings.defaultTaxRate || 0}
                onChange={(e) => setSettings({ ...settings, defaultTaxRate: parseFloat(e.target.value) || 0 })}
                step="0.1"
                min="0"
              />
            </div>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Default Payment Terms</label>
            <textarea
              className={styles.textarea}
              value={settings.defaultPaymentTerms || ''}
              onChange={(e) => setSettings({ ...settings, defaultPaymentTerms: e.target.value })}
              placeholder="Net 30. Payment is due within 30 days of invoice date."
              rows={2}
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Default Notes</label>
            <textarea
              className={styles.textarea}
              value={settings.defaultNotes || ''}
              onChange={(e) => setSettings({ ...settings, defaultNotes: e.target.value })}
              placeholder="Thank you for your business!"
              rows={2}
            />
          </div>

          <div className={styles.modalActions}>
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={styles.btnPrimary}
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
