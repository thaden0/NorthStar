'use client';

import { useState, useEffect } from 'react';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { FiX, FiPlus, FiDownload, FiTrash2 } from 'react-icons/fi';
import { toast } from 'sonner';
import { pdf } from '@react-pdf/renderer';
import { createInvoiceAction, getInvoiceSettingsAction } from '@/server/timeTracking/actions';
import type { Client, InvoiceSettings } from '@/types/timeTracking';
import InvoicePDF from './InvoicePDF';
import styles from './timeTracking.module.css';

interface InvoiceModalProps {
  clients: Client[];
  onClose: () => void;
}

interface AdditionalLineItem {
  id: string;
  description: string;
  quantity: number;
  rate: number;
}

export default function InvoiceModal({ clients, onClose }: InvoiceModalProps) {
  const [clientId, setClientId] = useState('');
  const [startDate, setStartDate] = useState(format(startOfMonth(subMonths(new Date(), 0)), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [notes, setNotes] = useState('');
  const [terms, setTerms] = useState('');
  const [taxRate, setTaxRate] = useState(0);
  const [additionalLineItems, setAdditionalLineItems] = useState<AdditionalLineItem[]>([]);
  const [invoiceSettings, setInvoiceSettings] = useState<InvoiceSettings | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Load invoice settings
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const result = await getInvoiceSettingsAction();
        if (result.success && result.data) {
          const settings = result.data as InvoiceSettings;
          setInvoiceSettings(settings);
          setTaxRate(settings.defaultTaxRate || 0);
          setNotes(settings.defaultNotes || '');
          setTerms(settings.defaultPaymentTerms || '');
        }
      } catch (error) {
        console.error('Failed to load invoice settings:', error);
      }
    };
    loadSettings();
  }, []);

  // Add line item
  const addLineItem = () => {
    setAdditionalLineItems([
      ...additionalLineItems,
      {
        id: `item-${Date.now()}`,
        description: '',
        quantity: 1,
        rate: 0,
      },
    ]);
  };

  // Update line item
  const updateLineItem = (id: string, field: keyof AdditionalLineItem, value: string | number) => {
    setAdditionalLineItems(
      additionalLineItems.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      )
    );
  };

  // Remove line item
  const removeLineItem = (id: string) => {
    setAdditionalLineItems(additionalLineItems.filter((item) => item.id !== id));
  };

  // Generate and download invoice
  const handleGenerate = async () => {
    if (!clientId) {
      toast.error('Please select a client');
      return;
    }

    setIsGenerating(true);
    try {
      // Create invoice in database
      const result = await createInvoiceAction({
        clientId,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        notes: notes || undefined,
        terms: terms || undefined,
        taxRate,
        additionalLineItems: additionalLineItems.filter(
          (item) => item.description && item.rate > 0
        ),
      });

      if (!result.success) {
        toast.error(result.error || 'Failed to create invoice');
        setIsGenerating(false);
        return;
      }

      const invoice = result.data as {
        id: string;
        invoiceNumber: string;
        clientName: string;
        clientEmail: string | null;
        clientAddress: string | null;
        issueDate: Date;
        dueDate: Date | null;
        subtotal: number;
        taxRate: number;
        taxAmount: number;
        total: number;
        notes: string | null;
        terms: string | null;
        lineItems: Array<{
          description: string;
          quantity: number;
          rate: number;
          amount: number;
        }>;
      };

      // Generate PDF
      const blob = await pdf(
        <InvoicePDF
          invoice={invoice}
          settings={invoiceSettings}
        />
      ).toBlob();

      // Download
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${invoice.invoiceNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Invoice created and downloaded');
      onClose();
    } catch (error) {
      console.error('Failed to generate invoice:', error);
      toast.error('Failed to generate invoice');
    }
    setIsGenerating(false);
  };

  // Quick date range presets
  const setDatePreset = (preset: 'thisMonth' | 'lastMonth' | 'thisWeek' | 'lastWeek') => {
    const now = new Date();
    switch (preset) {
      case 'thisMonth':
        setStartDate(format(startOfMonth(now), 'yyyy-MM-dd'));
        setEndDate(format(endOfMonth(now), 'yyyy-MM-dd'));
        break;
      case 'lastMonth':
        const lastMonth = subMonths(now, 1);
        setStartDate(format(startOfMonth(lastMonth), 'yyyy-MM-dd'));
        setEndDate(format(endOfMonth(lastMonth), 'yyyy-MM-dd'));
        break;
      // Add more presets as needed
    }
  };

  return (
    <div className={styles.modal}>
      <div className={styles.modalOverlay} onClick={onClose} />
      <div className={`${styles.modalContent} ${styles.invoiceModal}`}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Create Invoice</h2>
          <button className={styles.modalCloseBtn} onClick={onClose}>
            <FiX size={20} />
          </button>
        </div>

        {/* Client Selection */}
        <div className={styles.formGroup}>
          <label className={styles.label}>Client *</label>
          <select
            className={styles.select}
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
          >
            <option value="">Select a client</option>
            {clients.filter(c => c.isActive).map((client) => (
              <option key={client.id} value={client.id}>
                {client.name} (${client.hourlyRate}/hr)
              </option>
            ))}
          </select>
        </div>

        {/* Date Range */}
        <div className={styles.formGroup}>
          <label className={styles.label}>Time Period</label>
          <div className={styles.dateRangeRow}>
            <input
              type="date"
              className={styles.input}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <input
              type="date"
              className={styles.input}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
            <button
              type="button"
              className={styles.todayBtn}
              onClick={() => setDatePreset('thisMonth')}
            >
              This Month
            </button>
            <button
              type="button"
              className={styles.todayBtn}
              onClick={() => setDatePreset('lastMonth')}
            >
              Last Month
            </button>
          </div>
        </div>

        {/* Tax Rate */}
        <div className={styles.formGroup}>
          <label className={styles.label}>Tax Rate (%)</label>
          <input
            type="number"
            className={styles.input}
            value={taxRate}
            onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
            min="0"
            max="100"
            step="0.1"
          />
        </div>

        {/* Additional Line Items */}
        <div className={styles.formGroup}>
          <label className={styles.label}>Additional Line Items</label>
          {additionalLineItems.length > 0 && (
            <div className={styles.invoiceLineItems}>
              <div className={styles.invoiceLineItem}>
                <span>Description</span>
                <span>Qty</span>
                <span>Rate</span>
                <span></span>
              </div>
              {additionalLineItems.map((item) => (
                <div key={item.id} className={styles.invoiceLineItem}>
                  <input
                    type="text"
                    className={styles.input}
                    value={item.description}
                    onChange={(e) => updateLineItem(item.id, 'description', e.target.value)}
                    placeholder="Description"
                  />
                  <input
                    type="number"
                    className={styles.input}
                    value={item.quantity}
                    onChange={(e) => updateLineItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                    min="0"
                    step="0.25"
                    style={{ width: '80px' }}
                  />
                  <input
                    type="number"
                    className={styles.input}
                    value={item.rate}
                    onChange={(e) => updateLineItem(item.id, 'rate', parseFloat(e.target.value) || 0)}
                    min="0"
                    step="0.01"
                    style={{ width: '100px' }}
                  />
                  <button
                    type="button"
                    className={styles.modalCloseBtn}
                    onClick={() => removeLineItem(item.id)}
                    style={{ width: '32px', height: '32px' }}
                  >
                    <FiTrash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <button type="button" className={styles.addLineItemBtn} onClick={addLineItem}>
            <FiPlus size={14} />
            Add Line Item
          </button>
        </div>

        {/* Notes */}
        <div className={styles.formGroup}>
          <label className={styles.label}>Notes</label>
          <textarea
            className={styles.textarea}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Thank you for your business!"
          />
        </div>

        {/* Payment Terms */}
        <div className={styles.formGroup}>
          <label className={styles.label}>Payment Terms</label>
          <textarea
            className={styles.textarea}
            value={terms}
            onChange={(e) => setTerms(e.target.value)}
            placeholder="Payment due within 30 days..."
          />
        </div>

        <div className={styles.modalActions}>
          <button
            className={styles.btnSecondary}
            onClick={onClose}
            disabled={isGenerating}
          >
            Cancel
          </button>
          <button
            className={styles.btnPrimary}
            onClick={handleGenerate}
            disabled={isGenerating || !clientId}
          >
            <FiDownload size={16} />
            {isGenerating ? 'Generating...' : 'Generate Invoice'}
          </button>
        </div>
      </div>
    </div>
  );
}
