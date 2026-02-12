/**
 * TransactionTable
 * 
 * Monospaced, receipt-style transaction preview.
 * Green for inflows, red for outflows.
 */

import { motion } from 'framer-motion';
import type { Transaction } from '@/lib/parsers';

interface TransactionTableProps {
  transactions: Transaction[];
  bankName: string;
  statementType: string;
}

export default function TransactionTable({ transactions, bankName, statementType }: TransactionTableProps) {
  const totalInflow = transactions
    .filter(t => t.amount > 0)
    .reduce((sum, t) => sum + t.amount, 0);
  const totalOutflow = transactions
    .filter(t => t.amount < 0)
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="w-full"
    >
      {/* Header */}
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold">{bankName}</h3>
          <p className="text-xs text-muted-foreground">{statementType}</p>
        </div>
        <div className="text-right font-mono text-xs space-y-0.5">
          <p>
            <span className="text-muted-foreground mr-2">In</span>
            <span className="text-credit font-medium">
              {totalInflow.toLocaleString('en-AE', { minimumFractionDigits: 2 })}
            </span>
          </p>
          <p>
            <span className="text-muted-foreground mr-2">Out</span>
            <span className="text-debit font-medium">
              {totalOutflow.toLocaleString('en-AE', { minimumFractionDigits: 2 })}
            </span>
          </p>
        </div>
      </div>

      {/* Perforation line */}
      <div className="border-t border-dashed border-border mb-2" />

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs font-mono">
          <thead>
            <tr className="text-muted-foreground text-left">
              <th className="py-1.5 pr-3 font-medium w-24">Date</th>
              <th className="py-1.5 pr-3 font-medium">Payee</th>
              <th className="py-1.5 pr-3 font-medium w-16 hidden sm:table-cell">Memo</th>
              <th className="py-1.5 font-medium text-right w-28">Amount</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((tx, i) => (
              <motion.tr
                key={`${tx.date}-${tx.payee}-${tx.amount}-${i}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: Math.min(i * 0.01, 0.5), duration: 0.15 }}
                className="border-t border-border/40 hover:bg-muted/30 transition-colors"
              >
                <td className="py-1.5 pr-3 text-muted-foreground whitespace-nowrap">
                  {tx.date}
                </td>
                <td className="py-1.5 pr-3 truncate max-w-[200px] sm:max-w-[350px]" title={tx.payee}>
                  {tx.payee}
                </td>
                <td className="py-1.5 pr-3 text-muted-foreground truncate max-w-[100px] hidden sm:table-cell" title={tx.memo}>
                  {tx.memo}
                </td>
                <td className={`py-1.5 text-right whitespace-nowrap font-medium ${
                  tx.amount > 0 ? 'text-credit' : 'text-debit'
                }`}>
                  {tx.amount > 0 ? '+' : ''}{tx.amount.toLocaleString('en-AE', { minimumFractionDigits: 2 })}
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Perforation line */}
      <div className="border-t border-dashed border-border mt-2" />

      {/* Footer */}
      <p className="text-xs text-muted-foreground mt-2 font-mono">
        {transactions.length} transaction{transactions.length !== 1 ? 's' : ''}
      </p>
    </motion.div>
  );
}
