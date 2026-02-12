/**
 * ExportPanel
 * 
 * Controls for choosing YNAB format and downloading the CSV.
 */

import { useState } from 'react';
import { Download, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toYNABCSV, downloadCSV, type YNABFormat } from '@/lib/ynab-export';
import type { Transaction } from '@/lib/parsers';

interface ExportPanelProps {
  transactions: Transaction[];
  fileName: string;
}

export default function ExportPanel({ transactions, fileName }: ExportPanelProps) {
  const [format, setFormat] = useState<YNABFormat>('inflow-outflow');
  const [downloaded, setDownloaded] = useState(false);

  const handleExport = () => {
    const csv = toYNABCSV(transactions, format);
    const baseName = fileName.replace(/\.(csv|pdf)$/i, '');
    downloadCSV(csv, `${baseName}_ynab.csv`);
    setDownloaded(true);
    setTimeout(() => setDownloaded(false), 2500);
  };

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
      {/* Format selector */}
      <div className="flex items-center gap-1.5 bg-muted rounded-md p-0.5">
        <button
          onClick={() => setFormat('inflow-outflow')}
          className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
            format === 'inflow-outflow'
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Inflow / Outflow
        </button>
        <button
          onClick={() => setFormat('amount')}
          className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
            format === 'amount'
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Single Amount
        </button>
      </div>

      {/* Download button */}
      <Button
        onClick={handleExport}
        disabled={transactions.length === 0}
        size="sm"
        className="gap-2 bg-navy text-parchment hover:bg-navy-light"
      >
        {downloaded ? (
          <>
            <Check className="w-3.5 h-3.5" />
            Downloaded
          </>
        ) : (
          <>
            <Download className="w-3.5 h-3.5" />
            Export for YNAB
          </>
        )}
      </Button>
    </div>
  );
}
