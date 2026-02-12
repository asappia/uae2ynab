/**
 * ADCB Statement Parsers
 * 
 * Swiss Finance Design — Precision parsing for ADCB CSV statements.
 * Supports both Account Statements and Credit Card Statements.
 */

export interface Transaction {
  date: string;        // YYYY-MM-DD
  payee: string;
  memo: string;
  amount: number;      // negative = outflow, positive = inflow
  originalDate: string;
}

export interface ParseResult {
  bankName: string;
  statementType: string;
  transactions: Transaction[];
  metadata: Record<string, string>;
  errors: string[];
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function parseDDMMYYYY(dateStr: string): string {
  const parts = dateStr.split('/');
  if (parts.length !== 3) return dateStr;
  const [dd, mm, yyyy] = parts;
  return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
}

function parseAmount(str: string): number {
  if (!str || str === '0') return 0;
  return parseFloat(str.replace(/,/g, ''));
}

export function detectADCBType(content: string): 'account' | 'creditcard' | null {
  const lines = content.split('\n').map(l => l.trim()).filter(Boolean);
  
  // Account statement has "Account Number:" in first line
  if (lines[0]?.includes('Account Number:')) return 'account';
  
  // Credit card statement has "Statement Period" and "Credit Limit"
  if (lines[0]?.includes('Statement Period') && 
      lines.some(l => l.includes('Credit Limit'))) return 'creditcard';
  
  // Check for column headers
  for (const line of lines.slice(0, 10)) {
    if (line.includes('Posting Date') && line.includes('Value Date') && line.includes('Debit Amount')) {
      return 'account';
    }
    if (line.includes('Transaction Date') && line.includes('Cr/Dr') && line.includes('Amount in AED')) {
      return 'creditcard';
    }
  }
  
  return null;
}

export function parseADCBAccount(content: string): ParseResult {
  const lines = content.split('\n').map(l => l.trim()).filter(Boolean);
  const transactions: Transaction[] = [];
  const metadata: Record<string, string> = {};
  const errors: string[] = [];
  
  let headerIndex = -1;
  
  // Parse metadata and find header row
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (line.includes('Account Number:')) {
      const match = line.match(/Account Number:\s*([^"]+)/);
      if (match) metadata['accountNumber'] = match[1].trim().replace(/\s*,\s*$/, '');
    }
    if (line.includes('Statement Period:')) {
      const match = line.match(/Statement Period:\s*([^"]+)/);
      if (match) metadata['period'] = match[1].trim().replace(/\s*,\s*$/, '');
    }
    if (line.includes('Account Name')) {
      const match = line.match(/Account Name\(s\):\s*([^"]+)/);
      if (match) metadata['accountName'] = match[1].trim().replace(/\s*,\s*$/, '');
    }
    
    if (line.startsWith('Posting Date') || line.includes('Posting Date,Value Date')) {
      headerIndex = i;
      break;
    }
  }
  
  if (headerIndex === -1) {
    errors.push('Could not find header row in ADCB account statement');
    return { bankName: 'ADCB', statementType: 'Account Statement', transactions, metadata, errors };
  }
  
  // Parse transactions
  for (let i = headerIndex + 1; i < lines.length; i++) {
    const fields = parseCSVLine(lines[i]);
    if (fields.length < 6) continue;
    
    const [postingDate, _valueDate, _refNo, description, debitStr, creditStr] = fields;
    
    if (!postingDate || !postingDate.match(/^\d{2}\/\d{2}\/\d{4}$/)) continue;
    
    const debit = parseAmount(debitStr);
    const credit = parseAmount(creditStr);
    
    // Skip zero transactions
    if (debit === 0 && credit === 0) continue;
    
    const amount = credit > 0 ? credit : -debit;
    
    transactions.push({
      date: parseDDMMYYYY(postingDate),
      payee: cleanDescription(description),
      memo: '',
      amount,
      originalDate: postingDate,
    });
  }
  
  return {
    bankName: 'ADCB',
    statementType: 'Account Statement',
    transactions,
    metadata,
    errors,
  };
}

export function parseADCBCreditCard(content: string): ParseResult {
  const lines = content.split('\n').map(l => l.trim()).filter(Boolean);
  const transactions: Transaction[] = [];
  const metadata: Record<string, string> = {};
  const errors: string[] = [];
  
  let headerIndex = -1;
  
  // Parse metadata
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (line.includes('Statement Period')) {
      const match = line.match(/Statement Period\s*:\s*([^"]+)/);
      if (match) metadata['period'] = match[1].trim();
    }
    if (line.includes('Current Balance')) {
      const match = line.match(/Current Balance:\s*([^"]+)/);
      if (match) metadata['balance'] = match[1].trim();
    }
    if (line.includes('Credit Limit') && !line.includes('Available')) {
      const match = line.match(/Credit Limit:\s*([^"]+)/);
      if (match) metadata['creditLimit'] = match[1].trim();
    }
    
    if (line.includes('Transaction Date') && line.includes('Cr/Dr')) {
      headerIndex = i;
      break;
    }
  }
  
  if (headerIndex === -1) {
    errors.push('Could not find header row in ADCB credit card statement');
    return { bankName: 'ADCB', statementType: 'Credit Card Statement', transactions, metadata, errors };
  }
  
  // Parse transactions
  for (let i = headerIndex + 1; i < lines.length; i++) {
    const fields = parseCSVLine(lines[i]);
    if (fields.length < 4) continue;
    
    const [dateStr, description, crDr, amountStr] = fields;
    
    // Skip card info lines
    if (description?.includes('Primary Card Number') || description?.includes('Card Holder Name')) continue;
    
    if (!dateStr || !dateStr.match(/^\d{2}\/\d{2}\/\d{4}$/)) continue;
    
    const rawAmount = parseAmount(amountStr);
    if (rawAmount === 0) continue;
    
    // DR = debit (outflow, negative), CR = credit (inflow, positive)
    const amount = crDr === 'CR' ? rawAmount : -rawAmount;
    
    transactions.push({
      date: parseDDMMYYYY(dateStr),
      payee: cleanDescription(description),
      memo: '',
      amount,
      originalDate: dateStr,
    });
  }
  
  return {
    bankName: 'ADCB',
    statementType: 'Credit Card Statement',
    transactions,
    metadata,
    errors,
  };
}

function cleanDescription(desc: string): string {
  if (!desc) return '';
  // Remove excessive whitespace and clean up
  return desc
    .replace(/\s+/g, ' ')
    .replace(/^\s+|\s+$/g, '')
    .trim();
}
