'use client';

import { useRef, useState, useCallback } from 'react';
import { UploadCloud, FileText, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { sileo } from 'sileo';

const ACCEPTED_TYPES = ['application/pdf'];
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

  const validateAndEmit = useCallback(
    (file: File) => {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        sileo.error({
          title: 'Invalid file type',
          description: 'Only PDF files (.pdf) are accepted.',
        });
        return;
      }
      if (file.size > MAX_SIZE_BYTES) {
        sileo.error({
          title: 'File too large',
          description: `Maximum size is 25 MB. Your file is ${formatBytes(file.size)}.`,
        });
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
    // reset so same file can be re-selected
    e.target.value = '';
  };

  return (
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
        'relative flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed p-10 cursor-pointer transition-colors',
        isDragging
          ? 'border-[#4CAF50] bg-[rgba(76,175,80,0.1)]'
          : 'border-[rgba(76,175,80,0.3)] bg-[rgba(76,175,80,0.05)] hover:border-[#4CAF50] hover:bg-[rgba(76,175,80,0.08)]',
        disabled && 'cursor-not-allowed opacity-60 pointer-events-none',
      )}
    >
      {/* Cloud icon in white circle */}
      <div className="flex items-center justify-center h-14 w-14 rounded-full bg-white shadow-md">
        <UploadCloud className={cn('h-7 w-7', isDragging ? 'text-[#4CAF50]' : 'text-[#4CAF50]')} />
      </div>

      <div className="text-center space-y-1">
        <p className="text-sm font-medium text-foreground">
          Drag &amp; drop your PDF here
        </p>
        <p className="text-xs text-muted-foreground">
          PDF only. Maximum file size 25MB.
        </p>
      </div>

      {/* Browse button */}
      <Button
        type="button"
        size="sm"
        className="bg-[#4CAF50] hover:bg-[#43A047] text-white rounded-lg px-5"
        onClick={(e) => {
          e.stopPropagation();
          if (!disabled) inputRef.current?.click();
        }}
        disabled={disabled}
      >
        Browse Files
      </Button>

      <input
        ref={inputRef}
        type="file"
        accept=".pdf"
        className="sr-only"
        onChange={handleInputChange}
        disabled={disabled}
      />
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
      <div className="h-9 w-9 rounded-lg bg-[#F4F9F9] border border-[#FEE2E2] flex items-center justify-center shrink-0">
        <FileText className="h-4 w-4 text-[#4CAF50]" />
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
                isDone ? 'bg-[#4CAF50]' : 'bg-[#E87722]',
              )}
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
        {isUploading && (
          <p className="text-xs text-muted-foreground mt-0.5">{progress}% uploaded...</p>
        )}
        {isDone && (
          <p className="text-xs text-[#16A34A] mt-0.5">Upload complete</p>
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
