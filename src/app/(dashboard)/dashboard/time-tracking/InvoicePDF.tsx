import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { format } from 'date-fns';
import type { InvoiceSettings } from '@/types/timeTracking';

// Create styles
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: '#333333',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  businessInfo: {
    maxWidth: '50%',
  },
  businessName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a1a2e',
    marginBottom: 4,
  },
  businessDetails: {
    color: '#666666',
    lineHeight: 1.5,
  },
  invoiceTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#3b82f6',
    textAlign: 'right',
  },
  invoiceNumber: {
    fontSize: 12,
    textAlign: 'right',
    marginTop: 4,
    color: '#666666',
  },
  divider: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginVertical: 20,
  },
  infoSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  infoColumn: {
    width: '48%',
  },
  infoLabel: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#888888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 11,
    lineHeight: 1.5,
  },
  table: {
    marginTop: 20,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f8f9fa',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#e0e0e0',
  },
  tableHeaderCell: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#666666',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderColor: '#f0f0f0',
  },
  tableCell: {
    fontSize: 10,
  },
  descriptionCell: {
    flex: 1,
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
    width: 80,
    textAlign: 'right',
  },
  totalsSection: {
    marginTop: 20,
    paddingTop: 10,
    borderTopWidth: 2,
    borderColor: '#e0e0e0',
  },
  totalsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 6,
  },
  totalsLabel: {
    width: 100,
    textAlign: 'right',
    marginRight: 20,
    color: '#666666',
  },
  totalsValue: {
    width: 80,
    textAlign: 'right',
  },
  totalsFinal: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderColor: '#e0e0e0',
  },
  totalsFinalLabel: {
    width: 100,
    textAlign: 'right',
    marginRight: 20,
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1a1a2e',
  },
  totalsFinalValue: {
    width: 80,
    textAlign: 'right',
    fontSize: 14,
    fontWeight: 'bold',
    color: '#3b82f6',
  },
  footer: {
    marginTop: 40,
  },
  footerSection: {
    marginBottom: 20,
  },
  footerLabel: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#888888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  footerText: {
    fontSize: 10,
    color: '#666666',
    lineHeight: 1.5,
  },
  thankYou: {
    marginTop: 40,
    textAlign: 'center',
    fontSize: 12,
    color: '#3b82f6',
    fontWeight: 'bold',
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
  const formatCurrency = (amount: number) => {
    return `$${amount.toFixed(2)}`;
  };

  const formatDate = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return format(d, 'MMMM d, yyyy');
  };

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.businessInfo}>
            <Text style={styles.businessName}>
              {settings?.businessName || 'Your Business Name'}
            </Text>
            <Text style={styles.businessDetails}>
              {settings?.businessEmail && `${settings.businessEmail}\n`}
              {settings?.businessPhone && `${settings.businessPhone}\n`}
              {settings?.businessAddress || ''}
            </Text>
          </View>
          <View>
            <Text style={styles.invoiceTitle}>INVOICE</Text>
            <Text style={styles.invoiceNumber}>{invoice.invoiceNumber}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Bill To & Invoice Info */}
        <View style={styles.infoSection}>
          <View style={styles.infoColumn}>
            <Text style={styles.infoLabel}>Bill To</Text>
            <Text style={styles.infoValue}>
              {invoice.clientName}
              {invoice.clientEmail && `\n${invoice.clientEmail}`}
              {invoice.clientAddress && `\n${invoice.clientAddress}`}
            </Text>
          </View>
          <View style={styles.infoColumn}>
            <Text style={styles.infoLabel}>Invoice Date</Text>
            <Text style={styles.infoValue}>{formatDate(invoice.issueDate)}</Text>
            {invoice.dueDate && (
              <>
                <Text style={{ ...styles.infoLabel, marginTop: 10 }}>Due Date</Text>
                <Text style={styles.infoValue}>{formatDate(invoice.dueDate)}</Text>
              </>
            )}
          </View>
        </View>

        {/* Line Items Table */}
        <View style={styles.table}>
          {/* Table Header */}
          <View style={styles.tableHeader}>
            <Text style={{ ...styles.tableHeaderCell, ...styles.descriptionCell }}>
              Description
            </Text>
            <Text style={{ ...styles.tableHeaderCell, ...styles.qtyCell }}>
              Qty
            </Text>
            <Text style={{ ...styles.tableHeaderCell, ...styles.rateCell }}>
              Rate
            </Text>
            <Text style={{ ...styles.tableHeaderCell, ...styles.amountCell }}>
              Amount
            </Text>
          </View>

          {/* Table Rows */}
          {invoice.lineItems.map((item, index) => (
            <View key={index} style={styles.tableRow}>
              <Text style={{ ...styles.tableCell, ...styles.descriptionCell }}>
                {item.description}
              </Text>
              <Text style={{ ...styles.tableCell, ...styles.qtyCell }}>
                {item.quantity.toFixed(2)}
              </Text>
              <Text style={{ ...styles.tableCell, ...styles.rateCell }}>
                {formatCurrency(item.rate)}
              </Text>
              <Text style={{ ...styles.tableCell, ...styles.amountCell }}>
                {formatCurrency(item.amount)}
              </Text>
            </View>
          ))}
        </View>

        {/* Totals */}
        <View style={styles.totalsSection}>
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
          <View style={styles.totalsFinal}>
            <Text style={styles.totalsFinalLabel}>Total Due</Text>
            <Text style={styles.totalsFinalValue}>{formatCurrency(invoice.total)}</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          {invoice.terms && (
            <View style={styles.footerSection}>
              <Text style={styles.footerLabel}>Payment Terms</Text>
              <Text style={styles.footerText}>{invoice.terms}</Text>
            </View>
          )}
          {invoice.notes && (
            <View style={styles.footerSection}>
              <Text style={styles.footerLabel}>Notes</Text>
              <Text style={styles.footerText}>{invoice.notes}</Text>
            </View>
          )}
        </View>

        <Text style={styles.thankYou}>Thank you for your business!</Text>
      </Page>
    </Document>
  );
}
