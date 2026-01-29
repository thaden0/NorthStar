'use client';

import { useState, useEffect, useRef } from 'react';
import { FiX, FiUpload, FiTrash2, FiImage } from 'react-icons/fi';
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
  const [activeTab, setActiveTab] = useState<'business' | 'invoice' | 'payment' | 'branding'>('business');
  const [settings, setSettings] = useState<Partial<InvoiceSettings>>({});
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [letterheadPreview, setLetterheadPreview] = useState<string | null>(null);
  
  const logoInputRef = useRef<HTMLInputElement>(null);
  const letterheadInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function loadSettings() {
      try {
        const result = await getInvoiceSettingsAction();
        if (result.success && result.data) {
          const data = result.data as InvoiceSettings;
          setSettings(data);
          if (data.logoUrl) setLogoPreview(data.logoUrl);
          if (data.letterheadUrl) setLetterheadPreview(data.letterheadUrl);
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

  const handleImageUpload = async (
    file: File,
    type: 'logo' | 'letterhead'
  ) => {
    if (!file) return;

    // Check file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB');
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      if (type === 'logo') {
        setLogoPreview(dataUrl);
        setSettings({ ...settings, logoUrl: dataUrl });
      } else {
        setLetterheadPreview(dataUrl);
        setSettings({ ...settings, letterheadUrl: dataUrl });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const formData = new FormData();
      
      // Business Info
      if (settings.businessName) formData.set('businessName', settings.businessName);
      if (settings.businessEmail) formData.set('businessEmail', settings.businessEmail);
      if (settings.businessPhone) formData.set('businessPhone', settings.businessPhone);
      if (settings.businessAddress) formData.set('businessAddress', settings.businessAddress);
      if (settings.businessWebsite) formData.set('businessWebsite', settings.businessWebsite);
      
      // Invoice Settings
      if (settings.defaultTaxRate !== undefined) formData.set('defaultTaxRate', settings.defaultTaxRate.toString());
      if (settings.defaultPaymentTerms) formData.set('defaultPaymentTerms', settings.defaultPaymentTerms);
      if (settings.defaultNotes) formData.set('defaultNotes', settings.defaultNotes);
      if (settings.invoicePrefix) formData.set('invoicePrefix', settings.invoicePrefix);
      if (settings.nextInvoiceNumber !== undefined) formData.set('nextInvoiceNumber', settings.nextInvoiceNumber.toString());
      if (settings.footerText) formData.set('footerText', settings.footerText);
      
      // Payment Info
      if (settings.bankName) formData.set('bankName', settings.bankName);
      if (settings.bankAccountNumber) formData.set('bankAccountNumber', settings.bankAccountNumber);
      if (settings.bankRoutingNumber) formData.set('bankRoutingNumber', settings.bankRoutingNumber);
      if (settings.paypalEmail) formData.set('paypalEmail', settings.paypalEmail);
      if (settings.venmoHandle) formData.set('venmoHandle', settings.venmoHandle);
      
      // Branding
      if (settings.accentColor) formData.set('accentColor', settings.accentColor);
      if (settings.logoUrl) formData.set('logoUrl', settings.logoUrl);
      if (settings.letterheadUrl) formData.set('letterheadUrl', settings.letterheadUrl);

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

  const tabs = [
    { id: 'business' as const, label: 'Business Info' },
    { id: 'invoice' as const, label: 'Invoice Settings' },
    { id: 'payment' as const, label: 'Payment Info' },
    { id: 'branding' as const, label: 'Branding' },
  ];

  if (loading) {
    return (
      <div className={styles.modal}>
        <div className={styles.modalOverlay} onClick={onClose} />
        <div className={styles.modalContent} style={{ maxWidth: '700px' }}>
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
      <div className={styles.modalContent} style={{ maxWidth: '700px', maxHeight: '90vh', overflow: 'hidden' }}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Invoice Settings</h2>
          <button className={styles.modalCloseBtn} onClick={onClose}>
            <FiX size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div style={{ 
          display: 'flex', 
          gap: '0.5rem', 
          padding: '0 1.5rem',
          borderBottom: '1px solid var(--border-subtle)',
          marginBottom: '1rem'
        }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '0.75rem 1rem',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: activeTab === tab.id ? 'var(--accent-primary)' : 'var(--text-muted)',
                borderBottom: activeTab === tab.id ? '2px solid var(--accent-primary)' : '2px solid transparent',
                fontWeight: activeTab === tab.id ? '600' : '400',
                fontSize: '0.875rem',
                transition: 'all 0.2s',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} style={{ overflow: 'auto', maxHeight: 'calc(90vh - 180px)', padding: '0 1.5rem 1.5rem' }}>
          {/* Business Info Tab */}
          {activeTab === 'business' && (
            <div>
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
                <label className={styles.label}>Business Website</label>
                <input
                  type="url"
                  className={styles.input}
                  value={settings.businessWebsite || ''}
                  onChange={(e) => setSettings({ ...settings, businessWebsite: e.target.value })}
                  placeholder="https://example.com"
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
            </div>
          )}

          {/* Invoice Settings Tab */}
          {activeTab === 'invoice' && (
            <div>
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

              <div className={styles.formGroup}>
                <label className={styles.label}>Invoice Footer Text</label>
                <textarea
                  className={styles.textarea}
                  value={settings.footerText || ''}
                  onChange={(e) => setSettings({ ...settings, footerText: e.target.value })}
                  placeholder="Custom footer text for your invoices..."
                  rows={2}
                />
                <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                  Appears at the bottom of every invoice
                </small>
              </div>
            </div>
          )}

          {/* Payment Info Tab */}
          {activeTab === 'payment' && (
            <div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
                Add your payment details to display on invoices. Only fill in the methods you want to accept.
              </p>

              <div style={{ 
                background: 'var(--glass-bg)', 
                padding: '1rem', 
                borderRadius: '8px', 
                marginBottom: '1.5rem',
                border: '1px solid var(--border-subtle)'
              }}>
                <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.875rem', fontWeight: '600' }}>
                  Bank Transfer
                </h4>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Bank Name</label>
                  <input
                    type="text"
                    className={styles.input}
                    value={settings.bankName || ''}
                    onChange={(e) => setSettings({ ...settings, bankName: e.target.value })}
                    placeholder="e.g., Chase Bank"
                  />
                </div>
                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Account Number</label>
                    <input
                      type="text"
                      className={styles.input}
                      value={settings.bankAccountNumber || ''}
                      onChange={(e) => setSettings({ ...settings, bankAccountNumber: e.target.value })}
                      placeholder="XXXX-XXXX-XXXX"
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Routing Number</label>
                    <input
                      type="text"
                      className={styles.input}
                      value={settings.bankRoutingNumber || ''}
                      onChange={(e) => setSettings({ ...settings, bankRoutingNumber: e.target.value })}
                      placeholder="XXXXXXXXX"
                    />
                  </div>
                </div>
              </div>

              <div style={{ 
                background: 'var(--glass-bg)', 
                padding: '1rem', 
                borderRadius: '8px',
                border: '1px solid var(--border-subtle)'
              }}>
                <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.875rem', fontWeight: '600' }}>
                  Online Payments
                </h4>
                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>PayPal Email</label>
                    <input
                      type="email"
                      className={styles.input}
                      value={settings.paypalEmail || ''}
                      onChange={(e) => setSettings({ ...settings, paypalEmail: e.target.value })}
                      placeholder="your@paypal.com"
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Venmo Handle</label>
                    <input
                      type="text"
                      className={styles.input}
                      value={settings.venmoHandle || ''}
                      onChange={(e) => setSettings({ ...settings, venmoHandle: e.target.value })}
                      placeholder="yourhandle"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Branding Tab */}
          {activeTab === 'branding' && (
            <div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Accent Color</label>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  <input
                    type="color"
                    value={settings.accentColor || '#3b82f6'}
                    onChange={(e) => setSettings({ ...settings, accentColor: e.target.value })}
                    style={{
                      width: '60px',
                      height: '40px',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                    }}
                  />
                  <input
                    type="text"
                    className={styles.input}
                    value={settings.accentColor || '#3b82f6'}
                    onChange={(e) => setSettings({ ...settings, accentColor: e.target.value })}
                    placeholder="#3b82f6"
                    style={{ flex: 1 }}
                  />
                </div>
                <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                  Used for invoice header color and highlights
                </small>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Business Logo</label>
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImageUpload(file, 'logo');
                  }}
                  style={{ display: 'none' }}
                />
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                  <div 
                    onClick={() => logoInputRef.current?.click()}
                    style={{
                      width: '100px',
                      height: '100px',
                      border: '2px dashed var(--border-subtle)',
                      borderRadius: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      background: logoPreview ? `url(${logoPreview}) center/contain no-repeat` : 'var(--glass-bg)',
                      transition: 'all 0.2s',
                    }}
                  >
                    {!logoPreview && <FiImage size={24} style={{ color: 'var(--text-muted)' }} />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: '0 0 0.5rem 0' }}>
                      Upload a square logo (recommended: 200x200px)
                    </p>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        type="button"
                        onClick={() => logoInputRef.current?.click()}
                        className={styles.btnSecondary}
                        style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
                      >
                        <FiUpload size={14} /> Upload
                      </button>
                      {logoPreview && (
                        <button
                          type="button"
                          onClick={() => {
                            setLogoPreview(null);
                            setSettings({ ...settings, logoUrl: null });
                          }}
                          style={{ 
                            padding: '0.5rem 1rem', 
                            fontSize: '0.875rem',
                            background: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            borderRadius: '8px',
                            color: '#ef4444',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                          }}
                        >
                          <FiTrash2 size={14} /> Remove
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Letterhead Image</label>
                <input
                  ref={letterheadInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImageUpload(file, 'letterhead');
                  }}
                  style={{ display: 'none' }}
                />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div 
                    onClick={() => letterheadInputRef.current?.click()}
                    style={{
                      width: '100%',
                      height: '120px',
                      border: '2px dashed var(--border-subtle)',
                      borderRadius: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      background: letterheadPreview ? `url(${letterheadPreview}) center/cover no-repeat` : 'var(--glass-bg)',
                      transition: 'all 0.2s',
                    }}
                  >
                    {!letterheadPreview && (
                      <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                        <FiImage size={32} />
                        <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.875rem' }}>Click to upload letterhead</p>
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                      Full-width header image (recommended: 2100x300px)
                    </small>
                    {letterheadPreview && (
                      <button
                        type="button"
                        onClick={() => {
                          setLetterheadPreview(null);
                          setSettings({ ...settings, letterheadUrl: null });
                        }}
                        style={{ 
                          padding: '0.5rem 1rem', 
                          fontSize: '0.875rem',
                          background: 'rgba(239, 68, 68, 0.1)',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          borderRadius: '8px',
                          color: '#ef4444',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                        }}
                      >
                        <FiTrash2 size={14} /> Remove
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className={styles.modalActions} style={{ marginTop: '1.5rem' }}>
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
