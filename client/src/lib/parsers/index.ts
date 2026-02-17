/**
 * Parser Orchestrator
 * 
 * Auto-detects file type and routes to the appropriate parser.
 * Supports CSV (ADCB), PDF (ENBD), and XLSX (ENBD).
 */

import type { ParseResult } from './adcb';
import { detectADCBType, parseADCBAccount, parseADCBCreditCard } from './adcb';
import { detectENBDType, parseENBDCreditCard, parseENBDAccount, parseENBDCreditCardXLSX } from './enbd';

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
  // Currently only ENBD Credit Card XLSX is supported
  // Auto-detect by checking for ENBD-specific headers
  return parseENBDCreditCardXLSX(file);
}
