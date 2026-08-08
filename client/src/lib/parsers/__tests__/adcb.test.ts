import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { detectADCBType, parseADCBAccount } from '../adcb';

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), '../__fixtures__');

describe('ADCB account e-statement CSV', () => {
  const content = readFileSync(
    join(fixturesDir, 'adcb-account-estatement.csv'),
    'utf-8',
  );

  it('detects the newer e-statement format with timed posting dates', () => {
    expect(detectADCBType(content)).toBe('account');
  });

  it('parses transactions when Posting Date includes a timestamp', () => {
    const result = parseADCBAccount(content);

    expect(result.errors).toEqual([]);
    expect(result.bankName).toBe('ADCB');
    expect(result.statementType).toBe('Account Statement');
    expect(result.metadata.accountNumber).toContain('XXXXXXXXXXXX0001');
    expect(result.transactions.length).toBeGreaterThan(0);

    const salary = result.transactions.find((tx) => tx.payee === 'SALARY');
    expect(salary).toMatchObject({
      date: '2026-05-22',
      amount: 41740.76,
      originalDate: '22/05/2026',
    });

    const transfer = result.transactions.find((tx) =>
      tx.payee.includes('TRF OUT TO Sample Holder'),
    );
    expect(transfer).toMatchObject({
      date: '2026-05-22',
      amount: -6500,
      originalDate: '22/05/2026',
    });
  });

  it('still parses date-only Posting Date values from older exports', () => {
    const legacy = [
      '"Account Number: 1234567890 AED",',
      'Posting Date,Value Date,Reference No,Description,Debit Amount,Credit Amount,Balance',
      '"15/01/2024","15/01/2024","1","GROCERIES","42.50","0.00","100.00",',
      '"16/01/2024","16/01/2024","2","REFUND","0.00","10.00","110.00",',
    ].join('\n');

    const result = parseADCBAccount(legacy);
    expect(result.errors).toEqual([]);
    expect(result.transactions).toHaveLength(2);
    expect(result.transactions[0]).toMatchObject({
      date: '2024-01-15',
      amount: -42.5,
      payee: 'GROCERIES',
    });
    expect(result.transactions[1]).toMatchObject({
      date: '2024-01-16',
      amount: 10,
      payee: 'REFUND',
    });
  });
});
