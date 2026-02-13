/**
 * Home Page — UAE Bank Statement to YNAB Converter
 * 
 * Swiss Finance design: clean, functional, data-forward.
 * Flow: Upload → Parse → Review → Export
 */

import { useState, useCallback } from 'react';
import { Loader2, FileText, X, Shield, ArrowRight, Bug, Github } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import FileUploadZone from '@/components/FileUploadZone';
import TransactionTable from '@/components/TransactionTable';
import ExportPanel from '@/components/ExportPanel';
import { parseFile, type ParseResult } from '@/lib/parsers';

interface FileResult {
  file: File;
  result: ParseResult | null;
  loading: boolean;
  error: string | null;
}

export default function Home() {
  const [fileResults, setFileResults] = useState<FileResult[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFilesSelected = useCallback(async (files: File[]) => {
    setIsProcessing(true);

    // Add files with loading state
    const newEntries: FileResult[] = files.map(f => ({
      file: f,
      result: null,
      loading: true,
      error: null,
    }));

    setFileResults(prev => [...prev, ...newEntries]);

    // Parse each file
    for (let i = 0; i < files.length; i++) {
      try {
        const result = await parseFile(files[i]);
        setFileResults(prev =>
          prev.map(fr =>
            fr.file === files[i]
              ? { ...fr, result, loading: false, error: result.errors.length > 0 ? result.errors.join('; ') : null }
              : fr
          )
        );
      } catch (err: any) {
        setFileResults(prev =>
          prev.map(fr =>
            fr.file === files[i]
              ? { ...fr, loading: false, error: err.message || 'Failed to parse file' }
              : fr
          )
        );
      }
    }

    setIsProcessing(false);
  }, []);

  const removeFile = useCallback((file: File) => {
    setFileResults(prev => prev.filter(fr => fr.file !== file));
  }, []);

  const clearAll = useCallback(() => {
    setFileResults([]);
  }, []);

  const allTransactions = fileResults
    .filter(fr => fr.result && fr.result.transactions.length > 0)
    .flatMap(fr => fr.result!.transactions);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-navy flex items-center justify-center">
              <ArrowRight className="w-4 h-4 text-parchment" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight leading-none">
                UAE2YNAB
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Bank Statement Converter
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Shield className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">All processing happens in your browser</span>
            <span className="sm:hidden">Client-side only</span>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 container py-8">
        <div className="max-w-3xl mx-auto space-y-8">

          {/* Upload section */}
          <section>
            <div className="mb-4">
              <h2 className="text-lg font-semibold">Upload Statements</h2>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
                {[
                  { bank: 'ADCB', types: 'Account & Credit Card', format: 'CSV' },
                  { bank: 'Emirates NBD', types: 'Account & Credit Card', format: 'PDF' },
                ].map(({ bank, types, format }) => (
                  <div key={bank} className="flex items-baseline gap-2 text-sm">
                    <span className="font-medium">{bank}</span>
                    <span className="text-muted-foreground text-xs">{types}</span>
                    <span className="ml-auto font-mono text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{format}</span>
                  </div>
                ))}
              </div>
            </div>
            <FileUploadZone
              onFilesSelected={handleFilesSelected}
              isProcessing={isProcessing}
            />
          </section>

          {/* File list */}
          <AnimatePresence>
            {fileResults.length > 0 && (
              <motion.section
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
              >
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold">
                    Files ({fileResults.length})
                  </h2>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearAll}
                    className="text-xs text-muted-foreground h-7"
                  >
                    Clear all
                  </Button>
                </div>

                <div className="space-y-2">
                  {fileResults.map((fr, i) => (
                    <motion.div
                      key={`${fr.file.name}-${i}`}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="flex items-center gap-3 bg-card border border-border rounded-md px-3 py-2.5"
                    >
                      <FileText className="w-4 h-4 text-muted-foreground shrink-0" />

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{fr.file.name}</p>
                        <p className="text-xs text-muted-foreground font-mono">
                          {fr.loading && 'Parsing...'}
                          {fr.result && !fr.error && (
                            <>
                              {fr.result.bankName} &middot; {fr.result.statementType} &middot;{' '}
                              {fr.result.transactions.length} transactions
                            </>
                          )}
                          {fr.error && !fr.result?.transactions.length && (
                            <span className="text-destructive">{fr.error}</span>
                          )}
                          {fr.error && fr.result && fr.result.transactions.length > 0 && (
                            <>
                              {fr.result.bankName} &middot; {fr.result.transactions.length} transactions
                              <span className="text-amber ml-1">(with warnings)</span>
                            </>
                          )}
                        </p>
                      </div>

                      {fr.loading ? (
                        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                      ) : (
                        <button
                          onClick={() => removeFile(fr.file)}
                          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </motion.div>
                  ))}
                </div>
              </motion.section>
            )}
          </AnimatePresence>

          {/* Transaction preview + export */}
          {fileResults.filter(fr => fr.result && fr.result.transactions.length > 0).map((fr, i) => (
            <motion.section
              key={`table-${fr.file.name}-${i}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-card border border-border rounded-lg p-4 sm:p-6 space-y-4"
            >
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1 min-w-0">
                  <TransactionTable
                    transactions={fr.result!.transactions}
                    bankName={fr.result!.bankName}
                    statementType={fr.result!.statementType}
                  />
                </div>
              </div>

              <div className="border-t border-dashed border-border pt-4">
                <ExportPanel
                  transactions={fr.result!.transactions}
                  fileName={fr.file.name}
                />
              </div>
            </motion.section>
          ))}

          {/* Export all button when multiple files have transactions */}
          {fileResults.filter(fr => fr.result && fr.result.transactions.length > 0).length > 1 && (
            <motion.section
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-navy text-parchment rounded-lg p-4 sm:p-6"
            >
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h3 className="text-sm font-semibold">Export All</h3>
                  <p className="text-xs opacity-70 font-mono mt-0.5">
                    {allTransactions.length} transactions from {fileResults.filter(fr => fr.result && fr.result.transactions.length > 0).length} files
                  </p>
                </div>
                <ExportPanel
                  transactions={allTransactions}
                  fileName="all_statements"
                />
              </div>
            </motion.section>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-4">
        <div className="container flex items-center justify-between">
          <p className="text-xs text-muted-foreground font-mono">
            Your data never leaves your browser. No server, no tracking, no storage.
          </p>
          <div className="flex items-center gap-3">
            <a
              href="https://github.com/asappia/ynab-uae-converter/issues/new"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Bug className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Report an issue</span>
            </a>
            <a
              href="https://github.com/asappia/ynab-uae-converter"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <Github className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
