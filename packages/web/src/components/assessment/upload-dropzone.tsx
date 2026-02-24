'use client';

import { useRef, useState, useCallback } from 'react';
import { UploadCloud, FileText, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const ACCEPTED_TYPES = ['application/pdf', 'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
const MAX_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB

export interface SelectedFile {
  file: File;
  name: string;
  size: number;
  mimeType: string;
}

interface UploadDropzoneProps {
  onFileSelected: (file: SelectedFile) => void;
  disabled?: boolean;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function UploadDropzone({ onFileSelected, disabled = false }: UploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateAndEmit = useCallback(
    (file: File) => {
      setError(null);
      if (!ACCEPTED_TYPES.includes(file.type)) {
        setError('Only PDF and Word documents (.pdf, .doc, .docx) are accepted.');
        return;
      }
      if (file.size > MAX_SIZE_BYTES) {
        setError(`File is too large. Maximum size is 25 MB (your file: ${formatBytes(file.size)}).`);
        return;
      }
      onFileSelected({ file, name: file.name, size: file.size, mimeType: file.type });
    },
    [onFileSelected],
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;
    const file = e.dataTransfer.files[0];
    if (file) validateAndEmit(file);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) validateAndEmit(file);
    // reset input so same file can be re-selected
    e.target.value = '';
  };

  return (
    <div className="space-y-2">
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label="Upload file drop zone"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(e) => e.key === 'Enter' && !disabled && inputRef.current?.click()}
        className={cn(
          'relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 cursor-pointer transition-colors',
          isDragging
            ? 'border-primary bg-primary/5'
            : 'border-border hover:border-primary/50 hover:bg-muted/30',
          disabled && 'cursor-not-allowed opacity-60 pointer-events-none',
        )}
      >
        <UploadCloud className={cn('h-8 w-8', isDragging ? 'text-primary' : 'text-muted-foreground')} />
        <div className="text-center">
          <p className="text-sm font-medium text-foreground">
            Drag &amp; drop your file here
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            or{' '}
            <span className="text-primary underline underline-offset-2">browse files</span>
          </p>
        </div>
        <p className="text-xs text-muted-foreground">PDF or Word document · Max 25 MB</p>

        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.doc,.docx"
          className="sr-only"
          onChange={handleInputChange}
          disabled={disabled}
        />
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <X className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}

interface FilePreviewProps {
  file: SelectedFile;
  progress?: number;
  onRemove?: () => void;
}

export function FilePreview({ file, progress, onRemove }: FilePreviewProps) {
  const isUploading = progress !== undefined && progress < 100;
  const isDone = progress === 100;

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
      <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
        <FileText className="h-4 w-4 text-primary" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{file.name}</p>
        <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>

        {/* Progress bar */}
        {progress !== undefined && (
          <div className="mt-1.5 h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-300',
                isDone ? 'bg-green-500' : 'bg-primary',
              )}
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
        {isUploading && (
          <p className="text-xs text-muted-foreground mt-0.5">{progress}% uploaded...</p>
        )}
        {isDone && (
          <p className="text-xs text-green-600 mt-0.5">Upload complete</p>
        )}
      </div>

      {onRemove && !isUploading && !isDone && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
          onClick={onRemove}
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Remove file</span>
        </Button>
      )}
    </div>
  );
}
