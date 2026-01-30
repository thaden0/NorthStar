import React from 'react';
/* eslint-disable jsx-a11y/alt-text */
import { Document, Page, Text, View, StyleSheet, Image, Link } from '@react-pdf/renderer';
import { format } from 'date-fns';
import type { InvoiceSettings } from '@/types/timeTracking';

// Professional invoice styles with modern design
const createStyles = (accentColor: string = '#3b82f6') => StyleSheet.create({
  page: {
    padding: 0,
    fontSize: 9,
    fontFamily: 'Helvetica',
    color: '#374151',
    backgroundColor: '#ffffff',
  },
  // Letterhead section (full width at top)
  letterhead: {
    width: '100%',
    height: 100,
    marginBottom: 0,
  },
  letterheadImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  // Main content with padding
  content: {
    padding: 40,
    paddingTop: 30,
  },
  // Header with logo and invoice title
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 30,
  },
  // Left side: Logo stacked above business info
  leftHeaderSection: {
    flexDirection: 'column',
    maxWidth: '50%',
  },
  logo: {
    width: 70,
    height: 70,
    marginBottom: 12,
    objectFit: 'contain',
  },
  businessInfo: {
    flexDirection: 'column',
  },
  businessName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 6,
  },
  businessAddressLine: {
    fontSize: 9,
    color: '#6b7280',
    marginBottom: 2,
  },
  businessContactRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
  },
  businessContact: {
    fontSize: 9,
    color: '#6b7280',
    marginRight: 12,
  },
  businessLink: {
    fontSize: 9,
    color: accentColor,
    textDecoration: 'none',
    marginTop: 2,
  },
  // Right side: Invoice title
  invoiceTitleSection: {
    flexDirection: 'column',
    alignItems: 'flex-end',
  },
  invoiceTitle: {
    fontSize: 36,
    fontWeight: 'bold',
    color: accentColor,
    letterSpacing: 3,
  },
  invoiceNumber: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 6,
  },
  invoiceStatus: {
    backgroundColor: accentColor,
    color: '#ffffff',
    paddingVertical: 4,
    paddingHorizontal: 14,
    borderRadius: 4,
    fontSize: 8,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    marginTop: 10,
  },
  // Accent bar
  accentBar: {
    height: 3,
    backgroundColor: accentColor,
    marginVertical: 25,
  },
  // Info section with bill to and invoice details
  infoSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  infoBox: {
    width: '48%',
  },
  infoBoxHighlight: {
    backgroundColor: '#f9fafb',
    padding: 15,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  infoLabel: {
    fontSize: 8,
    fontWeight: 'bold',
    color: accentColor,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  infoValue: {
    fontSize: 10,
    lineHeight: 1.6,
    color: '#374151',
  },
  infoValueBold: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 2,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  infoRowLabel: {
    fontSize: 9,
    color: '#6b7280',
  },
  infoRowValue: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#111827',
  },
  // Table
  table: {
    marginTop: 10,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: accentColor,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 4,
  },
  tableHeaderCell: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#ffffff',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderColor: '#e5e7eb',
  },
  tableRowAlt: {
    backgroundColor: '#f9fafb',
  },
  tableCell: {
    fontSize: 9,
    color: '#374151',
  },
  descriptionCell: {
    flex: 1,
    paddingRight: 10,
  },
  descriptionText: {
    fontSize: 10,
    color: '#111827',
    marginBottom: 2,
  },
  descriptionSubtext: {
    fontSize: 8,
    color: '#9ca3af',
  },
  qtyCell: {
    width: 60,
    textAlign: 'center',
  },
  rateCell: {
    width: 80,
    textAlign: 'right',
  },
  amountCell: {
    width: 90,
    textAlign: 'right',
  },
  // Totals section
  totalsWrapper: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 25,
  },
  totalsBox: {
    width: 250,
  },
  totalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  totalsLabel: {
    fontSize: 9,
    color: '#6b7280',
  },
  totalsValue: {
    fontSize: 9,
    color: '#374151',
    fontWeight: 'bold',
  },
  totalsFinalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: accentColor,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 4,
    marginTop: 6,
  },
  totalsFinalLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  totalsFinalValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  // Payment section
  paymentSection: {
    marginTop: 35,
    flexDirection: 'row',
    gap: 20,
  },
  paymentBox: {
    flex: 1,
    backgroundColor: '#f9fafb',
    padding: 15,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  paymentTitle: {
    fontSize: 9,
    fontWeight: 'bold',
    color: accentColor,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  paymentText: {
    fontSize: 9,
    color: '#374151',
    lineHeight: 1.5,
  },
  paymentRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  paymentLabel: {
    width: 80,
    fontSize: 8,
    color: '#6b7280',
  },
  paymentValue: {
    flex: 1,
    fontSize: 9,
    color: '#111827',
    fontWeight: 'bold',
  },
  paymentLink: {
    flex: 1,
    fontSize: 9,
    color: accentColor,
    fontWeight: 'bold',
    textDecoration: 'none',
  },
  // Notes and Terms
  notesSection: {
    marginTop: 25,
  },
  notesBox: {
    marginBottom: 15,
  },
  notesLabel: {
    fontSize: 9,
    fontWeight: 'bold',
    color: accentColor,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  notesText: {
    fontSize: 9,
    color: '#6b7280',
    lineHeight: 1.6,
  },
  // Footer
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: 'center',
    paddingTop: 15,
    borderTopWidth: 1,
    borderColor: '#e5e7eb',
  },
  footerText: {
    fontSize: 8,
    color: '#9ca3af',
  },
  footerBrand: {
    fontSize: 9,
    color: accentColor,
    fontWeight: 'bold',
    marginTop: 4,
  },
  // Thank you badge
  thankYouBadge: {
    marginTop: 30,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  thankYouText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#16a34a',
  },
  thankYouSubtext: {
    fontSize: 9,
    color: '#22c55e',
    marginTop: 4,
  },
});

interface InvoicePDFProps {
  invoice: {
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
    status?: 'draft' | 'sent' | 'paid' | 'overdue';
    lineItems: Array<{
      description: string;
      quantity: number;
      rate: number;
      amount: number;
    }>;
  };
  settings: InvoiceSettings | null;
}

export default function InvoicePDF({ invoice, settings }: InvoicePDFProps) {
  const accentColor = settings?.accentColor || '#3b82f6';
  const styles = createStyles(accentColor);

  const formatCurrency = (amount: number) => {
    return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return format(d, 'MMMM d, yyyy');
  };

  const hasPaymentInfo = settings?.bankName || settings?.paypalEmail || settings?.venmoHandle;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Letterhead Image (if provided) */}
        {settings?.letterheadUrl && (
          <View style={styles.letterhead}>
            <Image src={settings.letterheadUrl} style={styles.letterheadImage} />
          </View>
        )}

        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            {/* Left side: Logo stacked above business info */}
            <View style={styles.leftHeaderSection}>
              {settings?.logoUrl && (
                <Image src={settings.logoUrl} style={styles.logo} />
              )}
              <View style={styles.businessInfo}>
                <Text style={styles.businessName}>
                  {settings?.businessName || 'Your Business'}
                </Text>
                {settings?.businessAddress && settings.businessAddress.split('\n').map((line, idx) => (
                  <Text key={idx} style={styles.businessAddressLine}>{line}</Text>
                ))}
                {(settings?.businessEmail || settings?.businessPhone) && (
                  <View style={styles.businessContactRow}>
                    {settings?.businessEmail && (
                      <Text style={styles.businessContact}>{settings.businessEmail}</Text>
                    )}
                    {settings?.businessPhone && (
                      <Text style={styles.businessContact}>{settings.businessPhone}</Text>
                    )}
                  </View>
                )}
                {settings?.businessWebsite && (
                  <Link src={settings.businessWebsite} style={styles.businessLink}>
                    {settings.businessWebsite.replace(/^https?:\/\//, '')}
                  </Link>
                )}
              </View>
            </View>
            {/* Right side: Invoice title */}
            <View style={styles.invoiceTitleSection}>
              <Text style={styles.invoiceTitle}>INVOICE</Text>
              <Text style={styles.invoiceNumber}>{invoice.invoiceNumber}</Text>
              {invoice.status && (
                <Text style={styles.invoiceStatus}>
                  {invoice.status.toUpperCase()}
                </Text>
              )}
            </View>
          </View>

          {/* Accent Bar */}
          <View style={styles.accentBar} />

          {/* Bill To & Invoice Details */}
          <View style={styles.infoSection}>
            <View style={[styles.infoBox, styles.infoBoxHighlight]}>
              <Text style={styles.infoLabel}>Bill To</Text>
              <Text style={styles.infoValueBold}>{invoice.clientName}</Text>
              <Text style={styles.infoValue}>
                {invoice.clientEmail && `${invoice.clientEmail}\n`}
                {invoice.clientAddress || ''}
              </Text>
            </View>
            <View style={styles.infoBox}>
              <View style={styles.infoRow}>
                <Text style={styles.infoRowLabel}>Invoice Date</Text>
                <Text style={styles.infoRowValue}>{formatDate(invoice.issueDate)}</Text>
              </View>
              {invoice.dueDate && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoRowLabel}>Due Date</Text>
                  <Text style={styles.infoRowValue}>{formatDate(invoice.dueDate)}</Text>
                </View>
              )}
              <View style={styles.infoRow}>
                <Text style={styles.infoRowLabel}>Invoice Number</Text>
                <Text style={styles.infoRowValue}>{invoice.invoiceNumber}</Text>
              </View>
              <View style={[styles.infoRow, { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderColor: '#e5e7eb' }]}>
                <Text style={[styles.infoRowLabel, { fontWeight: 'bold' }]}>Amount Due</Text>
                <Text style={[styles.infoRowValue, { fontSize: 12, color: accentColor }]}>
                  {formatCurrency(invoice.total)}
                </Text>
              </View>
            </View>
          </View>

          {/* Line Items Table */}
          <View style={styles.table}>
            {/* Table Header */}
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderCell, styles.descriptionCell]}>Description</Text>
              <Text style={[styles.tableHeaderCell, styles.qtyCell]}>Qty</Text>
              <Text style={[styles.tableHeaderCell, styles.rateCell]}>Rate</Text>
              <Text style={[styles.tableHeaderCell, styles.amountCell]}>Amount</Text>
            </View>

            {/* Table Rows */}
            {invoice.lineItems.map((item, index) => (
              <View 
                key={index} 
                style={[styles.tableRow, index % 2 === 1 ? styles.tableRowAlt : {}]}
              >
                <View style={styles.descriptionCell}>
                  <Text style={styles.descriptionText}>{item.description}</Text>
                </View>
                <Text style={[styles.tableCell, styles.qtyCell]}>
                  {item.quantity.toFixed(2)}
                </Text>
                <Text style={[styles.tableCell, styles.rateCell]}>
                  {formatCurrency(item.rate)}
                </Text>
                <Text style={[styles.tableCell, styles.amountCell, { fontWeight: 'bold' }]}>
                  {formatCurrency(item.amount)}
                </Text>
              </View>
            ))}
          </View>

          {/* Totals */}
          <View style={styles.totalsWrapper}>
            <View style={styles.totalsBox}>
              <View style={styles.totalsRow}>
                <Text style={styles.totalsLabel}>Subtotal</Text>
                <Text style={styles.totalsValue}>{formatCurrency(invoice.subtotal)}</Text>
              </View>
              {invoice.taxRate > 0 && (
                <View style={styles.totalsRow}>
                  <Text style={styles.totalsLabel}>Tax ({invoice.taxRate}%)</Text>
                  <Text style={styles.totalsValue}>{formatCurrency(invoice.taxAmount)}</Text>
                </View>
              )}
              <View style={styles.totalsFinalRow}>
                <Text style={styles.totalsFinalLabel}>Total Due</Text>
                <Text style={styles.totalsFinalValue}>{formatCurrency(invoice.total)}</Text>
              </View>
            </View>
          </View>

          {/* Payment Information */}
          {hasPaymentInfo && (
            <View style={styles.paymentSection}>
              {settings?.bankName && (
                <View style={styles.paymentBox}>
                  <Text style={styles.paymentTitle}>Bank Transfer</Text>
                  <View style={styles.paymentRow}>
                    <Text style={styles.paymentLabel}>Bank</Text>
                    <Text style={styles.paymentValue}>{settings.bankName}</Text>
                  </View>
                  {settings.bankAccountNumber && (
                    <View style={styles.paymentRow}>
                      <Text style={styles.paymentLabel}>Account</Text>
                      <Text style={styles.paymentValue}>{settings.bankAccountNumber}</Text>
                    </View>
                  )}
                  {settings.bankRoutingNumber && (
                    <View style={styles.paymentRow}>
                      <Text style={styles.paymentLabel}>Routing</Text>
                      <Text style={styles.paymentValue}>{settings.bankRoutingNumber}</Text>
                    </View>
                  )}
                </View>
              )}
              {(settings?.paypalEmail || settings?.venmoHandle) && (
                <View style={styles.paymentBox}>
                  <Text style={styles.paymentTitle}>Online Payment</Text>
                  {settings?.paypalEmail && (
                    <View style={styles.paymentRow}>
                      <Text style={styles.paymentLabel}>PayPal</Text>
                      <Link src={settings.paypalEmail.startsWith('http') ? settings.paypalEmail : `https://${settings.paypalEmail}`} style={styles.paymentLink}>
                        {settings.paypalEmail.replace(/^https?:\/\//, '')}
                      </Link>
                    </View>
                  )}
                  {settings?.venmoHandle && (
                    <View style={styles.paymentRow}>
                      <Text style={styles.paymentLabel}>Venmo</Text>
                      <Text style={styles.paymentValue}>@{settings.venmoHandle}</Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          )}

          {/* Notes & Terms */}
          {(invoice.terms || invoice.notes) && (
            <View style={styles.notesSection}>
              {invoice.terms && (
                <View style={styles.notesBox}>
                  <Text style={styles.notesLabel}>Payment Terms</Text>
                  <Text style={styles.notesText}>{invoice.terms}</Text>
                </View>
              )}
              {invoice.notes && (
                <View style={styles.notesBox}>
                  <Text style={styles.notesLabel}>Notes</Text>
                  <Text style={styles.notesText}>{invoice.notes}</Text>
                </View>
              )}
            </View>
          )}

          {/* Thank You Badge */}
          <View style={styles.thankYouBadge}>
            <Text style={styles.thankYouText}>Thank You for Your Business!</Text>
            <Text style={styles.thankYouSubtext}>We appreciate your trust and look forward to working with you again.</Text>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              {settings?.footerText || `${settings?.businessName || 'Your Business'} • ${invoice.invoiceNumber}`}
            </Text>
            {settings?.businessWebsite && (
              <Text style={styles.footerBrand}>{settings.businessWebsite.replace(/^https?:\/\//, '')}</Text>
            )}
          </View>
        </View>
      </Page>
    </Document>
  );
}
