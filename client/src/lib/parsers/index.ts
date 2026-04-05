/**
 * Parser Orchestrator
 * 
 * Auto-detects file type and routes to the appropriate parser.
 * Supports CSV (ADCB), PDF (ENBD), and XLSX (ENBD + Mashreq).
 */

import type { ParseResult } from './adcb';
import { detectADCBType, parseADCBAccount, parseADCBCreditCard } from './adcb';
import { detectENBDType, parseENBDCreditCard, parseENBDAccount, parseENBDCreditCardXLSX } from './enbd';
import { detectMashreqType, parseMashreqAccount, parseMashreqCreditCard } from './mashreq';

export type { Transaction, ParseResult } from './adcb';

export async function parseFile(file: File): Promise<ParseResult> {
  const fileName = file.name.toLowerCase();
  
  if (fileName.endsWith('.csv')) {
    return parseCSVFile(file);
  } else if (fileName.endsWith('.pdf')) {
    return parsePDFFile(file);
  } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
    return parseXLSXFile(file);
  } else {
    return {
      bankName: 'Unknown',
      statementType: 'Unknown',
      transactions: [],
      metadata: {},
      errors: [`Unsupported file type: ${fileName}. Please upload a CSV, PDF, or XLSX file.`],
    };
  }
}

async function parseCSVFile(file: File): Promise<ParseResult> {
  const content = await file.text();
  
  const type = detectADCBType(content);
  
  if (type === 'account') {
    return parseADCBAccount(content);
  } else if (type === 'creditcard') {
    return parseADCBCreditCard(content);
  } else {
    return {
      bankName: 'Unknown',
      statementType: 'Unknown',
      transactions: [],
      metadata: {},
      errors: ['Could not detect CSV statement type. Currently supports ADCB account and credit card statements.'],
    };
  }
}

async function parsePDFFile(file: File): Promise<ParseResult> {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.mjs',
    import.meta.url
  ).toString();
  
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  const firstPage = await pdf.getPage(1);
  const textContent = await firstPage.getTextContent();
  const firstPageText = textContent.items.map((item: any) => item.str).join(' ');
  
  const type = detectENBDType(firstPageText);
  
  if (type === 'creditcard') {
    return parseENBDCreditCard(file);
  } else if (type === 'account') {
    return parseENBDAccount(file);
  } else {
    return {
      bankName: 'Unknown',
      statementType: 'Unknown',
      transactions: [],
      metadata: {},
      errors: ['Could not detect PDF statement type. Currently supports Emirates NBD credit card and account statements.'],
    };
  }
}

async function parseXLSXFile(file: File): Promise<ParseResult> {
  const XLSX = await import('xlsx');
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  // Read first few rows to detect bank and statement type
  const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false });

  // Find header row to get column names
  let headerRow: string[] = [];
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const row = rows[i];
    if (!row) continue;
    const cells = row.map((c: any) => String(c || '').trim().toLowerCase());
    if (cells.includes('date') && cells.includes('description')) {
      headerRow = cells;
      break;
    }
  }

  // Try Mashreq detection first (by sheet name or header pattern)
  const mashreqType = detectMashreqType(sheetName, headerRow);
  if (mashreqType === 'account') {
    return parseMashreqAccount(file);
  }
  if (mashreqType === 'creditcard') {
    return parseMashreqCreditCard(file);
  }

  // Try ENBD detection (has "Details" and "Debit/Credit" columns)
  if (headerRow.includes('details') && headerRow.includes('debit/credit')) {
    return parseENBDCreditCardXLSX(file);
  }

  // Fallback: try ENBD XLSX parser
  return parseENBDCreditCardXLSX(file);
}
