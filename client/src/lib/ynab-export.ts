/**
 * YNAB Export Utility
 * 
 * Converts parsed transactions to YNAB-compatible CSV format.
 * All fields are double-quoted. Dates use DD/MM/YYYY.
 * Inflow/Outflow use "0" for the empty side (not blank).
 */

import type { Transaction } from './parsers/adcb';

export type YNABFormat = 'inflow-outflow' | 'amount';

function q(value: string): string {
  // Always quote, escape inner quotes by doubling
  return `"${value.replace(/"/g, '""')}"`;
}

function formatDate(isoDate: string): string {
  // DD/MM/YYYY to match the reference YNAB file
  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate;
  const [yyyy, mm, dd] = parts;
  return `${dd}/${mm}/${yyyy}`;
}

function formatAmount(n: number): string {
  // Positive number string, no trailing decimals if .00
  const abs = Math.abs(n);
  const fixed = abs.toFixed(2);
  // Remove trailing .00 only if it's a whole number, but keep .10 etc.
  // Actually the reference file keeps decimals like "1.78", "0.11" but also "152250" (no decimals)
  // So: strip trailing zeros after decimal, then strip trailing dot
  return fixed.replace(/\.?0+$/, '') || '0';
}

export function toYNABCSV(
  transactions: Transaction[],
  format: YNABFormat = 'inflow-outflow'
): string {
  const lines: string[] = [];
  
  if (format === 'inflow-outflow') {
    lines.push(`${q('Date')},${q('Payee')},${q('Memo')},${q('Outflow')},${q('Inflow')}`);
    
    for (const tx of transactions) {
      const date = formatDate(tx.date);
      const outflow = tx.amount < 0 ? formatAmount(tx.amount) : '0';
      const inflow = tx.amount > 0 ? formatAmount(tx.amount) : '0';
      
      lines.push(`${q(date)},${q(tx.payee)},${q(tx.memo)},${q(outflow)},${q(inflow)}`);
    }
  } else {
    lines.push(`${q('Date')},${q('Payee')},${q('Memo')},${q('Amount')}`);
    
    for (const tx of transactions) {
      const date = formatDate(tx.date);
      const sign = tx.amount < 0 ? '-' : '';
      const amount = sign + formatAmount(tx.amount);
      
      lines.push(`${q(date)},${q(tx.payee)},${q(tx.memo)},${q(amount)}`);
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
