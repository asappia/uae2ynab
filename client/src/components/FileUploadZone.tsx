/**
 * FileUploadZone
 * 
 * Drag-and-drop + click file upload for CSV/PDF bank statements.
 * Dashed border mimics bank statement perforations.
 */

import { useCallback, useState } from 'react';
import { Upload, FileText, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface FileUploadZoneProps {
  onFilesSelected: (files: File[]) => void;
  isProcessing: boolean;
}

export default function FileUploadZone({ onFilesSelected, isProcessing }: FileUploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateFiles = (files: FileList | File[]): File[] => {
    const valid: File[] = [];
    for (const file of Array.from(files)) {
      const name = file.name.toLowerCase();
      if (name.endsWith('.csv') || name.endsWith('.pdf') || name.endsWith('.xlsx') || name.endsWith('.xls')) {
        valid.push(file);
      }
    }
    if (valid.length === 0) {
      setError('Only CSV, PDF, and XLSX files are supported.');
      return [];
    }
    setError(null);
    return valid;
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (isProcessing) return;
    const files = validateFiles(e.dataTransfer.files);
    if (files.length > 0) onFilesSelected(files);
  }, [isProcessing, onFilesSelected]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!isProcessing) setIsDragging(true);
  }, [isProcessing]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && !isProcessing) {
      const files = validateFiles(e.target.files);
      if (files.length > 0) onFilesSelected(files);
    }
  }, [isProcessing, onFilesSelected]);

  return (
    <div className="w-full">
      <motion.div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`
          relative border-2 border-dashed rounded-lg transition-colors duration-150
          ${isDragging
            ? 'border-amber bg-amber/5'
            : 'border-border hover:border-amber/50 hover:bg-muted/30'}
          ${isProcessing ? 'opacity-50 pointer-events-none' : ''}
        `}
        animate={isDragging ? { scale: 1.01 } : { scale: 1 }}
        transition={{ duration: 0.12 }}
      >
        <label className="flex flex-col items-center justify-center py-14 px-6 cursor-pointer">
          <input
            type="file"
            multiple
            accept=".csv,.pdf,.xlsx,.xls"
            onChange={handleFileInput}
            className="hidden"
            disabled={isProcessing}
          />

          <motion.div
            animate={isDragging ? { y: -3 } : { y: 0 }}
            transition={{ duration: 0.12 }}
            className="flex flex-col items-center"
          >
            <div className={`
              w-12 h-12 rounded-full flex items-center justify-center mb-4
              ${isDragging ? 'bg-amber/20 text-amber' : 'bg-muted text-muted-foreground'}
            `}>
              {isDragging ? <FileText className="w-5 h-5" /> : <Upload className="w-5 h-5" />}
            </div>

            <p className="text-sm font-medium">
              {isDragging ? 'Release to process' : 'Drop files here or click to browse'}
            </p>
            <p className="text-xs text-muted-foreground mt-1.5 font-mono tracking-tight">
              CSV (ADCB) &middot; PDF / XLSX (Emirates NBD)
            </p>
          </motion.div>
        </label>
      </motion.div>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="flex items-center gap-2 mt-3 text-sm text-destructive"
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
