/**
 * ENBD Statement Parsers
 * 
 * Parses Emirates NBD PDF statements (credit card + account).
 * Uses pdf.js for client-side PDF text extraction.
 */

import type { Transaction, ParseResult } from './adcb';

let pdfjsLib: any = null;

async function getPdfJs() {
  if (pdfjsLib) return pdfjsLib;
  pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.mjs',
    import.meta.url
  ).toString();
  return pdfjsLib;
}

async function extractTextFromPDF(file: File): Promise<string[]> {
  const pdfjs = await getPdfJs();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;

  const pages: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();

    const items = textContent.items as any[];
    const rawItems: { x: number; y: number; text: string }[] = [];

    for (const item of items) {
      if (!item.str || item.str.trim() === '') continue;
      rawItems.push({
        x: item.transform[4],
        y: Math.round(item.transform[5]),
        text: item.str,
      });
    }

    // Sort by y descending to process top-to-bottom
    rawItems.sort((a, b) => b.y - a.y);

    // Merge items within Y_TOLERANCE px into the same line
    const Y_TOLERANCE = 4;
    const mergedLines: { y: number; items: { x: number; text: string }[] }[] = [];

    for (const item of rawItems) {
      const existing = mergedLines.find(l => Math.abs(l.y - item.y) <= Y_TOLERANCE);
      if (existing) {
        existing.items.push({ x: item.x, text: item.text });
      } else {
        mergedLines.push({ y: item.y, items: [{ x: item.x, text: item.text }] });
      }
    }

    // Sort lines top-to-bottom (descending y)
    mergedLines.sort((a, b) => b.y - a.y);
    const pageLines: string[] = [];

    for (const line of mergedLines) {
      const lineItems = line.items.sort((a, b) => a.x - b.x);
      const lineText = lineItems.map(i => i.text).join(' ');
      pageLines.push(lineText);
    }

    pages.push(pageLines.join('\n'));
  }

  return pages;
}

export function detectENBDType(text: string): 'account' | 'creditcard' | null {
  if (text.includes('Credit Card Statement') || text.includes('كشف حساب بطاقة')) {
    return 'creditcard';
  }
  if (text.includes('Account Statement') || text.includes('STATEMENT OF ACCOUNT')) {
    return 'account';
  }
  return null;
}

// ─── Credit Card ────────────────────────────────────────────────

export async function parseENBDCreditCard(file: File): Promise<ParseResult> {
  const transactions: Transaction[] = [];
  const metadata: Record<string, string> = {};
  const errors: string[] = [];

  try {
    const pages = await extractTextFromPDF(file);
    const fullText = pages.join('\n');

    // Metadata
    const cardNumberMatch = fullText.match(/Card Number[:\s]*([\dX\s*]+)/);
    if (cardNumberMatch) metadata['cardNumber'] = cardNumberMatch[1].trim();

    const periodMatch = fullText.match(/Statement Period[:\s]*(.+?)(?:\n|$)/);
    if (periodMatch) metadata['period'] = periodMatch[1].trim();

    // Parse transactions — primary regex
    for (const pageText of pages) {
      const lines = pageText.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Pattern: DD/MM/YYYY  DD/MM/YYYY  Description  Amount[CR]
        const txMatch = line.match(
          /^(\d{2}\/\d{2}\/\d{4})\s+(\d{2}\/\d{2}\/\d{4})\s+(.+?)\s+([\d,]+\.\d{2})(CR)?\s*$/
        );

        if (txMatch) {
          const [, transDate, , description, amountStr, crFlag] = txMatch;

          if (description.includes('Transaction Date') ||
              description.includes('Posting Date') ||
              description.includes('Previous Statement')) continue;

          const cleanAmount = parseFloat(amountStr.replace(/,/g, ''));
          if (isNaN(cleanAmount) || cleanAmount === 0) continue;

          // CR = credit/inflow, otherwise debit/outflow
          const amount = crFlag === 'CR' ? cleanAmount : -cleanAmount;

          let memo = '';
          if (i + 1 < lines.length) {
            const next = lines[i + 1].trim();
            if (next.startsWith('(1 AED =') || next.startsWith('(1 USD =')) {
              memo = next;
            }
          }

          transactions.push({
            date: parseDDMMYYYY(transDate),
            payee: cleanENBDDescription(description),
            memo,
            amount,
            originalDate: transDate,
          });
        }
      }
    }

    // Fallback if primary regex found nothing
    if (transactions.length === 0) {
      parseENBDCreditCardFallback(pages, transactions);
    }

  } catch (err: any) {
    errors.push(`PDF parsing error: ${err.message}`);
  }

  return {
    bankName: 'Emirates NBD',
    statementType: 'Credit Card Statement',
    transactions,
    metadata,
    errors,
  };
}

function parseENBDCreditCardFallback(pages: string[], transactions: Transaction[]) {
  for (const pageText of pages) {
    const lines = pageText.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      const dateMatch = line.match(/^(\d{2}\/\d{2}\/\d{4})/);
      if (!dateMatch) continue;

      const amountMatch = line.match(/([\d,]+\.\d{2})(CR)?\s*$/);
      if (!amountMatch) continue;

      const dateStr = dateMatch[1];
      const amountStr = amountMatch[1];
      const isCredit = amountMatch[2] === 'CR';

      const restAfterFirstDate = line.substring(dateMatch[0].length).trim();
      const secondDateMatch = restAfterFirstDate.match(/^(\d{2}\/\d{2}\/\d{4})\s+/);

      let description = '';
      if (secondDateMatch) {
        description = restAfterFirstDate.substring(secondDateMatch[0].length);
      } else {
        description = restAfterFirstDate;
      }
      description = description.replace(/([\d,]+\.\d{2})(CR)?\s*$/, '').trim();

      if (!description ||
          description.includes('Transaction Date') ||
          description.includes('Posting Date')) continue;

      const cleanAmount = parseFloat(amountStr.replace(/,/g, ''));
      if (isNaN(cleanAmount) || cleanAmount === 0) continue;

      const amount = isCredit ? cleanAmount : -cleanAmount;

      let memo = '';
      if (i + 1 < lines.length) {
        const next = lines[i + 1].trim();
        if (next.startsWith('(1 AED =') || next.startsWith('(1 USD =')) {
          memo = next;
        }
      }

      transactions.push({
        date: parseDDMMYYYY(dateStr),
        payee: cleanENBDDescription(description),
        memo,
        amount,
        originalDate: dateStr,
      });
    }
  }
}

// ─── Account Statement ──────────────────────────────────────────

export async function parseENBDAccount(file: File): Promise<ParseResult> {
  const transactions: Transaction[] = [];
  const metadata: Record<string, string> = {};
  const errors: string[] = [];

  try {
    const pages = await extractTextFromPDF(file);
    const fullText = pages.join('\n');

    // Metadata
    const accountMatch = fullText.match(/Account No\.\s*([\d]+)/);
    if (accountMatch) metadata['accountNumber'] = accountMatch[1].trim();

    const ibanMatch = fullText.match(/IBAN\s*(AE[\d]+)/);
    if (ibanMatch) metadata['iban'] = ibanMatch[1].trim();

    const periodMatch = fullText.match(
      /STATEMENT OF ACCOUNT FOR THE PERIOD OF\s+(.+?)\s+to\s+(.+?)(?:\n|$)/i
    );
    if (periodMatch) metadata['period'] = `${periodMatch[1].trim()} to ${periodMatch[2].trim()}`;

    const currencyMatch = fullText.match(/Currency\s+(AED|USD|EUR|GBP)/);
    if (currencyMatch) metadata['currency'] = currencyMatch[1].trim();

    // Parse transactions
    // ENBD account statement format (from pdftotext):
    //   24 Jan 2026        CC NO.-4033********7337 RMA REF NO.-                 -38564.24                                     3341.06 Cr
    //                      EBID2F82568DA9 4
    //   24 Jan 2026        IPP 20260124ADC6B98110847600515                                            2939.21                 41905.30 Cr
    //                      602774815 AED 2939 .21 ALESSANDRO
    //                      SAPPIA OWN ACCOUNT TRANSFERTO ENBD
    //
    // Columns: Date | Description | Debits (negative) | Credits (positive) | Balance [Cr/Dr]
    // Continuation lines have no date and are indented.

    for (const pageText of pages) {
      const lines = pageText.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Match date at start: "24 Jan 2026"
        const dateMatch = line.match(
          /^\s*(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4})\s+/i
        );
        if (!dateMatch) continue;

        const dateStr = dateMatch[1].trim();
        const rest = line.substring(dateMatch[0].length);

        // Extract all numbers that look like amounts from the rest of the line
        // We need to separate description from the numeric columns
        // The amounts are right-aligned and may be negative
        const amountRegex = /-?[\d,]+\.\d{2}/g;
        const amounts: { value: number; index: number; length: number }[] = [];
        let match;
        while ((match = amountRegex.exec(rest)) !== null) {
          amounts.push({
            value: parseFloat(match[0].replace(/,/g, '')),
            index: match.index,
            length: match[0].length,
          });
        }

        if (amounts.length === 0) continue;

        // Description is everything before the first amount
        const firstAmountIndex = amounts[0].index;
        const description = rest.substring(0, firstAmountIndex).trim();

        if (!description ||
            description === 'Description' ||
            description.includes('Date')) continue;

        // Gather continuation lines (no date, indented)
        let fullDescription = description;
        let j = i + 1;
        while (j < lines.length) {
          const nextLine = lines[j];
          // Continuation line: no date, but has text
          if (nextLine.match(/^\s*\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}/i)) break;
          const trimmed = nextLine.trim();
          if (!trimmed ||
              trimmed.includes('STATEMENT OF ACCOUNT') ||
              trimmed.includes('electronically generated') ||
              trimmed.includes('Need help') ||
              trimmed.includes('Emirates NBD') ||
              trimmed.match(/^\d+\s*\/\s*\d+$/)) break;
          // Check it's not a page number or footer
          if (trimmed.match(/^This is an/)) break;
          fullDescription += ' ' + trimmed;
          j++;
        }

        // Determine debit/credit from the amounts
        // Pattern: Debits column | Credits column | Balance column
        // Debits are negative, Credits are positive, Balance has Cr/Dr suffix
        // We look at the amounts array:
        // - If there are 2+ amounts, the last one is the balance
        // - The first non-balance amount is either debit or credit

        let amount: number;

        if (amounts.length >= 2) {
          // First amount is debit or credit, last is balance
          amount = amounts[0].value;
        } else {
          // Only one amount — could be debit, credit, or balance
          // Check if line ends with "Cr" or "Dr" (balance indicator)
          const balanceCheck = rest.match(/([\d,]+\.\d{2})\s*(?:Cr|Dr)\s*$/i);
          if (balanceCheck && amounts.length === 1) {
            // This single amount is just the balance, skip
            continue;
          }
          amount = amounts[0].value;
        }

        if (isNaN(amount) || amount === 0) continue;

        transactions.push({
          date: parseMonthDate(dateStr),
          payee: cleanENBDDescription(fullDescription),
          memo: '',
          amount,
          originalDate: dateStr,
        });
      }
    }

  } catch (err: any) {
    errors.push(`PDF parsing error: ${err.message}`);
  }

  return {
    bankName: 'Emirates NBD',
    statementType: 'Account Statement',
    transactions,
    metadata,
    errors,
  };
}

// ─── Helpers ────────────────────────────────────────────────────

function parseDDMMYYYY(dateStr: string): string {
  const parts = dateStr.split('/');
  if (parts.length !== 3) return dateStr;
  const [dd, mm, yyyy] = parts;
  return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
}

function parseMonthDate(dateStr: string): string {
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

function cleanENBDDescription(desc: string): string {
  if (!desc) return '';
  return desc
    .replace(/\s+/g, ' ')
    .replace(/\bARE\s*$/, '')
    .replace(/\bABUDHABI\b/gi, 'ABU DHABI')
    .trim();
}
