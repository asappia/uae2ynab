/**
 * ExportPanel
 * 
 * Controls for choosing YNAB format and downloading.
 * Single file → CSV download.
 * Multiple files → ZIP with one CSV per file.
 */

import { useState } from 'react';
import { Download, Check, Archive } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toYNABCSV, downloadCSV, downloadZip, type YNABFormat, type FileExportEntry } from '@/lib/ynab-export';
import type { Transaction } from '@/lib/parsers';

interface SingleFileExportProps {
  mode: 'single';
  transactions: Transaction[];
  fileName: string;
}

interface MultiFileExportProps {
  mode: 'multi';
  entries: FileExportEntry[];
}

type ExportPanelProps = SingleFileExportProps | MultiFileExportProps;

export default function ExportPanel(props: ExportPanelProps) {
  const [format, setFormat] = useState<YNABFormat>('inflow-outflow');
  const [downloaded, setDownloaded] = useState(false);
  const [exporting, setExporting] = useState(false);

  const totalTransactions = props.mode === 'single'
    ? props.transactions.length
    : props.entries.reduce((sum, e) => sum + e.transactions.length, 0);

  const handleExport = async () => {
    setExporting(true);
    try {
      if (props.mode === 'single') {
        const csv = toYNABCSV(props.transactions, format);
        const baseName = props.fileName.replace(/\.(csv|pdf|xlsx?)$/i, '');
        downloadCSV(csv, `${baseName}_ynab.csv`);
      } else {
        await downloadZip(props.entries, format);
      }
      setDownloaded(true);
      setTimeout(() => setDownloaded(false), 2500);
    } finally {
      setExporting(false);
    }
  };

  const isZip = props.mode === 'multi';
  const IconComponent = isZip ? Archive : Download;

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
        disabled={totalTransactions === 0 || exporting}
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
            <IconComponent className="w-3.5 h-3.5" />
            {isZip ? 'Export ZIP' : 'Export for YNAB'}
          </>
        )}
      </Button>
    </div>
  );
}
