/**
 * YNAB Export Utility
 * 
 * Converts parsed transactions to YNAB-compatible CSV format.
 * Supports both Inflow/Outflow and Amount formats.
 */

import type { Transaction } from './parsers/adcb';

export type YNABFormat = 'inflow-outflow' | 'amount';

function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatDate(isoDate: string): string {
  // YNAB accepts many date formats, we'll use MM/DD/YYYY which is common
  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate;
  const [yyyy, mm, dd] = parts;
  return `${mm}/${dd}/${yyyy}`;
}

export function toYNABCSV(
  transactions: Transaction[],
  format: YNABFormat = 'inflow-outflow'
): string {
  const lines: string[] = [];
  
  if (format === 'inflow-outflow') {
    lines.push('Date,Payee,Memo,Outflow,Inflow');
    
    for (const tx of transactions) {
      const date = formatDate(tx.date);
      const payee = escapeCSV(tx.payee);
      const memo = escapeCSV(tx.memo);
      const outflow = tx.amount < 0 ? Math.abs(tx.amount).toFixed(2) : '';
      const inflow = tx.amount > 0 ? tx.amount.toFixed(2) : '';
      
      lines.push(`${date},${payee},${memo},${outflow},${inflow}`);
    }
  } else {
    lines.push('Date,Payee,Memo,Amount');
    
    for (const tx of transactions) {
      const date = formatDate(tx.date);
      const payee = escapeCSV(tx.payee);
      const memo = escapeCSV(tx.memo);
      const amount = tx.amount.toFixed(2);
      
      lines.push(`${date},${payee},${memo},${amount}`);
    }
  }
  
  return lines.join('\n');
}

export function downloadCSV(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
