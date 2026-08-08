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
    expect(result.metadata.accountNumber).toContain('10000000000001');
    expect(result.metadata.accountName).toBe('SAMPLE ACCOUNT HOLDER');
    expect(result.transactions).toHaveLength(8);

    const salary = result.transactions.find((tx) => tx.payee === 'SALARY');
    expect(salary).toMatchObject({
      date: '2024-01-02',
      amount: 5000,
      originalDate: '02/01/2024',
    });

    const transfer = result.transactions.find((tx) =>
      tx.payee.includes('TRF OUT TO Sample Holder'),
    );
    expect(transfer).toMatchObject({
      date: '2024-01-02',
      amount: -1500,
      originalDate: '02/01/2024',
    });
  });

  it('still parses date-only Posting Date values from older exports', () => {
    const legacy = [
      '"Account Number: 10000000000099 AED",',
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
