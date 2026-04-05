/**
 * Mashreq Statement Parsers
 * 
 * Parses Mashreq XLSX statements (account + credit card).
 * Uses SheetJS (xlsx) for client-side XLSX parsing.
 * 
 * Account Statement format:
 *   Sheet: "Account transactions Statement"
 *   Rows 1-10: metadata (holder name, account number, type, currency, period)
 *   Row 11: empty
 *   Row 12: headers — Date | Value Date | Reference Number | Description | Credit | Debit | Balance
 *   Row 13+: transaction data
 *   Dates: strings "DD Mon YYYY" (e.g., "09 Jan 2026")
 *   Credit: "+0.41", "+35,000.00" (positive with + prefix)
 *   Debit: "-120.00", "-5,000.00" (negative with - prefix)
 * 
 * Credit Card Statement format:
 *   Sheet: "Card transactions Statement"
 *   Rows 1-10: metadata (holder name, card number, type, currency, period)
 *   Row 11: empty
 *   Row 12: headers — Date | Description | Currency | Amount | Local Currency
 *   Row 13+: transaction data
 *   Dates: strings "DD Mon YYYY" (e.g., "01 Jan 2026")
 *   Local Currency: negative = debit, positive = credit
 */

import type { Transaction, ParseResult } from './adcb';

type MashreqType = 'account' | 'creditcard' | null;

export function detectMashreqType(sheetName: string, headers: string[]): MashreqType {
  const name = sheetName.toLowerCase();
  const joined = headers.map(h => h.toLowerCase()).join(' ');

  if (name.includes('card transactions') || joined.includes('local currency')) {
    return 'creditcard';
  }
  if (name.includes('account transactions') || (joined.includes('credit') && joined.includes('debit') && joined.includes('balance'))) {
    return 'account';
  }
  return null;
}

// ─── Account Statement ──────────────────────────────────────────

export async function parseMashreqAccount(file: File): Promise<ParseResult> {
  const transactions: Transaction[] = [];
  const metadata: Record<string, string> = {};
  const errors: string[] = [];

  try {
    const XLSX = await import('xlsx');
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false });

    // Extract metadata from header rows
    for (let i = 0; i < Math.min(rows.length, 12); i++) {
      const row = rows[i];
      if (!row || !row[0]) continue;
      const key = String(row[0]).trim();
      const val = row[1] ? String(row[1]).trim() : '';
      if (key === 'Account Holder Name') metadata['accountHolder'] = val;
      if (key === 'Account Number') metadata['accountNumber'] = val;
      if (key === 'Account Currency') metadata['currency'] = val;
      if (key === 'Account Type') metadata['accountType'] = val;
    }

    // Find header row
    let headerIndex = -1;
    for (let i = 0; i < Math.min(rows.length, 15); i++) {
      const row = rows[i];
      if (!row) continue;
      const cells = row.map((c: any) => String(c || '').trim().toLowerCase());
      if (cells.includes('date') && cells.includes('description') && cells.includes('balance')) {
        headerIndex = i;
        break;
      }
    }

    if (headerIndex === -1) {
      errors.push('Could not find header row in Mashreq account statement.');
      return { bankName: 'Mashreq', statementType: 'Account Statement', transactions, metadata, errors };
    }

    const headers = rows[headerIndex].map((h: any) => String(h || '').trim().toLowerCase());
    const dateCol = headers.indexOf('date');
    const descCol = headers.indexOf('description');
    const creditCol = headers.indexOf('credit');
    const debitCol = headers.indexOf('debit');

    if (dateCol === -1 || descCol === -1) {
      errors.push('Missing required columns (Date, Description) in Mashreq account statement.');
      return { bankName: 'Mashreq', statementType: 'Account Statement', transactions, metadata, errors };
    }

    // Parse data rows
    for (let i = headerIndex + 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || !row[dateCol]) continue;

      const dateStr = String(row[dateCol]).trim();
      if (!dateStr || dateStr.toLowerCase() === 'date') continue;

      const description = String(row[descCol] || '').trim();
      if (!description) continue;

      // Parse credit and debit amounts
      let amount = 0;
      const creditStr = creditCol !== -1 && row[creditCol] ? String(row[creditCol]).replace(/[,+]/g, '').trim() : '';
      const debitStr = debitCol !== -1 && row[debitCol] ? String(row[debitCol]).replace(/[,+]/g, '').trim() : '';

      if (creditStr && creditStr !== '0') {
        amount = Math.abs(parseFloat(creditStr));
      } else if (debitStr && debitStr !== '0') {
        amount = -Math.abs(parseFloat(debitStr));
      } else {
        continue;
      }

      if (isNaN(amount) || amount === 0) continue;

      const date = parseMashreqDate(dateStr);

      transactions.push({
        date,
        payee: cleanMashreqDescription(description),
        memo: '',
        amount,
        originalDate: dateStr,
      });
    }
  } catch (err: any) {
    errors.push(`XLSX parsing error: ${err.message}`);
  }

  return {
    bankName: 'Mashreq',
    statementType: 'Account Statement',
    transactions,
    metadata,
    errors,
  };
}

// ─── Credit Card Statement ──────────────────────────────────────

export async function parseMashreqCreditCard(file: File): Promise<ParseResult> {
  const transactions: Transaction[] = [];
  const metadata: Record<string, string> = {};
  const errors: string[] = [];

  try {
    const XLSX = await import('xlsx');
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false });

    // Extract metadata from header rows
    for (let i = 0; i < Math.min(rows.length, 12); i++) {
      const row = rows[i];
      if (!row || !row[0]) continue;
      const key = String(row[0]).trim();
      const val = row[1] ? String(row[1]).trim() : '';
      if (key === 'Card Holder Name') metadata['cardHolder'] = val;
      if (key === 'Card Number') metadata['cardNumber'] = val;
      if (key === 'Account Currency') metadata['currency'] = val;
      if (key === 'Card Type') metadata['cardType'] = val;
    }

    // Find header row
    let headerIndex = -1;
    for (let i = 0; i < Math.min(rows.length, 15); i++) {
      const row = rows[i];
      if (!row) continue;
      const cells = row.map((c: any) => String(c || '').trim().toLowerCase());
      if (cells.includes('date') && cells.includes('description') && cells.includes('amount')) {
        headerIndex = i;
        break;
      }
    }

    if (headerIndex === -1) {
      errors.push('Could not find header row in Mashreq credit card statement.');
      return { bankName: 'Mashreq', statementType: 'Credit Card Statement', transactions, metadata, errors };
    }

    const headers = rows[headerIndex].map((h: any) => String(h || '').trim().toLowerCase());
    const dateCol = headers.indexOf('date');
    const descCol = headers.indexOf('description');
    const localCurrencyCol = headers.indexOf('local currency');
    const amountCol = headers.indexOf('amount');

    if (dateCol === -1 || descCol === -1) {
      errors.push('Missing required columns (Date, Description) in Mashreq credit card statement.');
      return { bankName: 'Mashreq', statementType: 'Credit Card Statement', transactions, metadata, errors };
    }

    // Parse data rows
    for (let i = headerIndex + 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || !row[dateCol]) continue;

      const dateStr = String(row[dateCol]).trim();
      if (!dateStr || dateStr.toLowerCase() === 'date') continue;

      const description = String(row[descCol] || '').trim();
      if (!description) continue;

      // Use Local Currency column for signed amount (negative = debit, positive = credit)
      // Fall back to Amount column if Local Currency is not available
      let amount: number;
      if (localCurrencyCol !== -1 && row[localCurrencyCol] != null) {
        const lcStr = String(row[localCurrencyCol]).replace(/,/g, '').trim();
        amount = parseFloat(lcStr);
      } else if (amountCol !== -1 && row[amountCol] != null) {
        const amtStr = String(row[amountCol]).replace(/,/g, '').trim();
        amount = parseFloat(amtStr);
      } else {
        continue;
      }

      if (isNaN(amount) || amount === 0) continue;

      const date = parseMashreqDate(dateStr);

      transactions.push({
        date,
        payee: cleanMashreqCCDescription(description),
        memo: '',
        amount,
        originalDate: dateStr,
      });
    }
  } catch (err: any) {
    errors.push(`XLSX parsing error: ${err.message}`);
  }

  return {
    bankName: 'Mashreq',
    statementType: 'Credit Card Statement',
    transactions,
    metadata,
    errors,
  };
}

// ─── Helpers ────────────────────────────────────────────────────

function parseMashreqDate(dateStr: string): string {
  // "09 Jan 2026" → "2026-01-09"
  const months: Record<string, string> = {
    jan: '01', feb: '02', mar: '03', apr: '04',
    may: '05', jun: '06', jul: '07', aug: '08',
    sep: '09', oct: '10', nov: '11', dec: '12',
  };

  const match = dateStr.match(/(\d{1,2})\s+(\w{3})\s+(\d{4})/i);
  if (!match) return dateStr;

  const [, day, month, year] = match;
  const mm = months[month.toLowerCase()];
  if (!mm) return dateStr;

  return `${year}-${mm}-${day.padStart(2, '0')}`;
}

function cleanMashreqDescription(desc: string): string {
  if (!desc) return '';
  // Remove multi-line noise: SRN references, IBAN numbers, internal codes
  return desc
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s*SRN:\s*\S+/gi, '')
    .replace(/\/AE\d{20,}/g, '')
    .replace(/TOC-MAE-\S+/g, '')
    .replace(/\s*\/REF\/\s*/g, ' ')
    .trim();
}

function cleanMashreqCCDescription(desc: string): string {
  if (!desc) return '';
  // Card descriptions: "AL JALILA CHILDRENS      DUBAI        784 1405698562"
  // Remove trailing location code pattern: "   784 1234567890"
  return desc
    .replace(/\s+\d{3}\s+\d{7,}$/, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
