'use client';

import { useRef, useState, useCallback } from 'react';
import { UploadCloud } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { sileo } from 'sileo';
import {
  ALLOWED_DOCUMENT_MIME_TYPES,
  ALLOWED_DOCUMENT_EXTENSIONS,
  MAX_FILE_SIZE_PDF,
  MAX_FILE_SIZE_OTHER,
} from '@alliance-risk/shared';

export interface SelectedFile {
  file: File;
  name: string;
  size: number;
  mimeType: string;
}

interface UploadDropzoneProps {
  onFilesSelected: (files: SelectedFile[]) => void;
  disabled?: boolean;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Map file extensions to MIME types for fallback when browser reports empty/wrong type */
const EXT_TO_MIME: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.xls': 'application/vnd.ms-excel',
  '.csv': 'text/csv',
  '.html': 'text/html',
  '.htm': 'text/html',
  '.md': 'text/markdown',
  '.txt': 'text/plain',
};

function resolveFileMime(file: File): string {
  // Trust browser MIME if it's in our allowed list
  if ((ALLOWED_DOCUMENT_MIME_TYPES as readonly string[]).includes(file.type)) {
    return file.type;
  }
  // Fallback: derive MIME from extension
  const ext = file.name.toLowerCase().match(/\.[^.]+$/)?.[0] ?? '';
  return EXT_TO_MIME[ext] ?? file.type;
}

function validateFile(file: File): { error: string | null; mime: string } {
  const mime = resolveFileMime(file);
  if (!(ALLOWED_DOCUMENT_MIME_TYPES as readonly string[]).includes(mime)) {
    return {
      error: `"${file.name}" has an unsupported type (${file.type || 'unknown'}). Accepted: PDF, Word, Excel, CSV, HTML, MD, TXT.`,
      mime,
    };
  }
  const maxSize = mime === 'application/pdf' ? MAX_FILE_SIZE_PDF : MAX_FILE_SIZE_OTHER;
  if (file.size > maxSize) {
    const limitMB = Math.round(maxSize / (1024 * 1024));
    return {
      error: `"${file.name}" is too large (${formatBytes(file.size)}). Maximum is ${limitMB} MB.`,
      mime,
    };
  }
  return { error: null, mime };
}

export function UploadDropzone({ onFilesSelected, disabled = false }: UploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const validateAndEmit = useCallback(
    (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0) return;

      const valid: SelectedFile[] = [];
      for (const file of Array.from(fileList)) {
        const { error, mime } = validateFile(file);
        if (error) {
          sileo.error({ title: 'Invalid file', description: error });
        } else {
          valid.push({ file, name: file.name, size: file.size, mimeType: mime });
        }
      }

      if (valid.length > 0) {
        onFilesSelected(valid);
      }
    },
    [onFilesSelected],
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
    validateAndEmit(e.dataTransfer.files);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    validateAndEmit(e.target.files);
    // Reset so same files can be re-selected
    e.target.value = '';
  };

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label="Upload files drop zone"
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
      {/* Cloud icon */}
      <div className="flex items-center justify-center h-14 w-14 rounded-full bg-white shadow-md">
        <UploadCloud className="h-7 w-7 text-[#4CAF50]" />
      </div>

      <div className="text-center space-y-1">
        <p className="text-sm font-medium text-foreground">
          Drag &amp; drop your files here
        </p>
        <p className="text-xs text-muted-foreground">
          PDF, Word, Excel, CSV, and more. Max 25MB per file.
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
        multiple
        accept={ALLOWED_DOCUMENT_EXTENSIONS}
        className="sr-only"
        onChange={handleInputChange}
        disabled={disabled}
      />
    </div>
  );
}
