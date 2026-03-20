'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { sileo } from 'sileo';
import { Button } from '@/components/ui/button';
import { UploadDropzone, type SelectedFile } from './upload-dropzone';
import { FileListItem, ProcessingQueue, type FileItemStatus } from './file-list-item';
import { useRequestUploadUrl } from '@/hooks/use-assessments';
import {
  useMultiDocumentStatus,
  useTriggerParseAll,
  useDeleteDocument,
} from '@/hooks/use-multi-document-status';

interface UploadBusinessPlanModalProps {
  assessmentId: string;
}

/** Per-file upload/parse phase */
type FilePhase = 'idle' | 'uploading' | 'uploaded' | 'parsing' | 'parsed' | 'failed';

interface TrackedFile {
  selectedFile: SelectedFile;
  /** Document ID returned by the API after requesting a presigned URL */
  documentId: string | null;
  phase: FilePhase;
  uploadProgress: number;
  errorMessage: string | null;
}

/** Overall modal phase */
type ModalPhase =
  | 'selecting'   // User is adding/removing files
  | 'uploading'   // S3 uploads in progress
  | 'parsing'     // Waiting for all documents to be parsed
  | 'done'        // All parsed, redirecting
  | 'error';      // Unrecoverable error (user can retry)

export function UploadBusinessPlanModal({ assessmentId }: UploadBusinessPlanModalProps) {
  const router = useRouter();
  const [files, setFiles] = useState<TrackedFile[]>([]);
  const [modalPhase, setModalPhase] = useState<ModalPhase>('selecting');
  const [existingDocsLoaded, setExistingDocsLoaded] = useState(false);

  const { mutateAsync: requestUploadUrl } = useRequestUploadUrl();
  const { mutateAsync: triggerParseAll } = useTriggerParseAll();
  const { mutateAsync: deleteDocumentApi } = useDeleteDocument();

  // Poll documents list once parsing has started OR on initial load to fetch existing docs
  const pollingEnabled = modalPhase === 'parsing';
  const { allParsed, anyFailed, documents } =
    useMultiDocumentStatus(assessmentId, pollingEnabled);

  // --- Load existing documents on mount ------------------------------------
  // Fetch once to show already-uploaded docs in the file list.
  // Disabled once upload starts to prevent overwriting local state mid-upload.
  const existingDocsEnabled = !existingDocsLoaded && modalPhase === 'selecting';
  const { documents: existingDocs } = useMultiDocumentStatus(assessmentId, existingDocsEnabled);

  useEffect(() => {
    if (existingDocsLoaded || existingDocs.length === 0) return;

    const existingTracked: TrackedFile[] = existingDocs.map((doc) => ({
      selectedFile: {
        name: doc.fileName,
        size: doc.fileSize ?? 0,
        mimeType: doc.mimeType ?? 'application/octet-stream',
        file: null as unknown as File, // Existing file — no File object available
      },
      documentId: doc.id,
      phase: doc.status === 'PARSED' ? 'parsed' as const
        : doc.status === 'FAILED' ? 'failed' as const
        : doc.status === 'PARSING' ? 'parsing' as const
        : 'uploaded' as const,
      uploadProgress: 100,
      errorMessage: doc.status === 'FAILED' ? 'Parsing failed on server' : null,
    }));

    setFiles(existingTracked);
    setExistingDocsLoaded(true);

    // If any docs are still parsing, switch to parsing phase
    if (existingDocs.some((d) => d.status === 'PARSING')) {
      setModalPhase('parsing');
    }
  }, [existingDocs, existingDocsLoaded]);

  // Keep phase ref for beforeunload handler
  const phaseRef = useRef(modalPhase);
  phaseRef.current = modalPhase;

  // --- beforeunload warning -------------------------------------------
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (phaseRef.current === 'uploading' || phaseRef.current === 'parsing') {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  // --- React to all-parsed / any-failed from polling -------------------
  useEffect(() => {
    if (modalPhase !== 'parsing') return;

    if (allParsed) {
      setModalPhase('done');
      sileo.success({
        title: 'Documents analysed',
        description: 'All documents extracted. Redirecting to Gap Detector...',
      });
      setTimeout(() => {
        router.push(`/assessments/gap-detector?id=${assessmentId}`);
      }, 1500);
    } else if (anyFailed) {
      // Sync individual file statuses with polling results
      setFiles((prev) =>
        prev.map((tf) => {
          if (!tf.documentId) return tf;
          const polledDoc = documents.find((d) => d.id === tf.documentId);
          if (!polledDoc) return tf;
          if (polledDoc.status === 'FAILED') {
            return { ...tf, phase: 'failed', errorMessage: 'Parsing failed on server' };
          }
          if (polledDoc.status === 'PARSED') {
            return { ...tf, phase: 'parsed' };
          }
          return tf;
        }),
      );
    }
  }, [allParsed, anyFailed, modalPhase, assessmentId, router, documents]);

  // --- Sync per-file parsing state from polling results ---------------
  useEffect(() => {
    if (modalPhase !== 'parsing' || documents.length === 0) return;
    setFiles((prev) =>
      prev.map((tf) => {
        if (!tf.documentId) return tf;
        const polledDoc = documents.find((d) => d.id === tf.documentId);
        if (!polledDoc) return tf;
        if (polledDoc.status === 'PARSED' && tf.phase !== 'parsed') {
          return { ...tf, phase: 'parsed' };
        }
        if (polledDoc.status === 'FAILED' && tf.phase !== 'failed') {
          return { ...tf, phase: 'failed', errorMessage: 'Parsing failed on server' };
        }
        if (polledDoc.status === 'PARSING' && tf.phase !== 'parsing') {
          return { ...tf, phase: 'parsing' };
        }
        return tf;
      }),
    );
  }, [documents, modalPhase]);

  // --- Handlers ----------------------------------------------------------
  const handleFilesSelected = useCallback((newFiles: SelectedFile[]) => {
    setFiles((prev) => {
      // Deduplicate by name + size
      const existingKeys = new Set(prev.map((f) => `${f.selectedFile.name}-${f.selectedFile.size}`));
      const unique = newFiles.filter(
        (f) => !existingKeys.has(`${f.name}-${f.size}`),
      );
      const additions: TrackedFile[] = unique.map((sf) => ({
        selectedFile: sf,
        documentId: null,
        phase: 'idle',
        uploadProgress: 0,
        errorMessage: null,
      }));
      return [...prev, ...additions];
    });
  }, []);

  const handleRemoveFile = useCallback(
    async (index: number) => {
      const tf = files[index];
      if (!tf) return;

      // If document was already registered with the API, delete it
      if (tf.documentId) {
        try {
          await deleteDocumentApi({ assessmentId, documentId: tf.documentId });
        } catch {
          // Ignore — might not exist yet
        }
      }

      setFiles((prev) => prev.filter((_, i) => i !== index));
    },
    [files, assessmentId, deleteDocumentApi],
  );

  const updateFile = useCallback(
    (index: number, updates: Partial<TrackedFile>) => {
      setFiles((prev) =>
        prev.map((f, i) => (i === index ? { ...f, ...updates } : f)),
      );
    },
    [],
  );

  const handleUpload = useCallback(async () => {
    if (files.length === 0) return;

    setModalPhase('uploading');
    setExistingDocsLoaded(true); // Stop existing-docs polling to prevent overwriting local state

    // Step 1: Upload all files to S3 sequentially
    const uploadedFiles: TrackedFile[] = [...files];
    let hasError = false;

    for (let i = 0; i < uploadedFiles.length; i++) {
      const tf = uploadedFiles[i];
      if (tf.phase !== 'idle') continue; // Skip already processed

      try {
        updateFile(i, { phase: 'uploading', uploadProgress: 0, errorMessage: null });

        const { presignedUrl, fields, documentId } = await requestUploadUrl({
          assessmentId,
          fileName: tf.selectedFile.name,
          mimeType: tf.selectedFile.mimeType,
          fileSize: tf.selectedFile.size,
        });

        await uploadToS3(presignedUrl, fields, tf.selectedFile, (pct) => {
          updateFile(i, { uploadProgress: pct });
        });

        uploadedFiles[i] = { ...tf, documentId, phase: 'uploaded', uploadProgress: 100 };
        updateFile(i, { documentId, phase: 'uploaded', uploadProgress: 100 });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Upload failed';
        uploadedFiles[i] = { ...tf, phase: 'failed', errorMessage: msg };
        updateFile(i, { phase: 'failed', errorMessage: msg });
        hasError = true;
        sileo.error({ title: `Failed to upload ${tf.selectedFile.name}`, description: msg });
      }
    }

    if (hasError && uploadedFiles.every((f) => f.phase === 'failed')) {
      setModalPhase('error');
      return;
    }

    // Step 2: Trigger parse-all for all uploaded documents
    try {
      await triggerParseAll(assessmentId);

      // Mark all successfully uploaded files as parsing
      setFiles((prev) =>
        prev.map((f) =>
          f.phase === 'uploaded' ? { ...f, phase: 'parsing' } : f,
        ),
      );

      setModalPhase('parsing');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to start parsing';
      sileo.error({ title: 'Parse failed', description: msg });
      setModalPhase('error');
    }
  }, [files, assessmentId, requestUploadUrl, triggerParseAll, updateFile]);

  // --- Map per-file phase to FileListItem status -----------------------
  function toItemStatus(phase: FilePhase): FileItemStatus {
    switch (phase) {
      case 'uploading': return 'uploading';
      case 'uploaded':  return 'uploading'; // Show 100% briefly
      case 'parsing':   return 'parsing';
      case 'parsed':    return 'complete';
      case 'failed':    return 'failed';
      default:          return 'idle';
    }
  }

  const isBusy = modalPhase === 'uploading' || modalPhase === 'parsing';
  const newFiles = files.filter((f) => f.phase === 'idle');
  const existingParsed = files.filter((f) => f.phase === 'parsed');
  const canUpload = newFiles.length > 0 && !isBusy && modalPhase !== 'done';
  const canContinue = newFiles.length === 0 && existingParsed.length > 0 && !isBusy && modalPhase !== 'done';

  return (
    <div className="space-y-6">
      {/* Dropzone — always shown while selecting or after error */}
      {(modalPhase === 'selecting' || modalPhase === 'error') && (
        <UploadDropzone onFilesSelected={handleFilesSelected} disabled={isBusy} />
      )}

      {/* File list */}
      {files.length > 0 && (
        <ProcessingQueue label={existingDocsLoaded && files.some((f) => f.phase === 'parsed') ? 'Current Documents' : undefined}>
          {files.map((tf, i) => (
            <FileListItem
              key={`${tf.selectedFile.name}-${tf.selectedFile.size}-${i}`}
              fileName={tf.selectedFile.name}
              fileSize={tf.selectedFile.size}
              status={toItemStatus(tf.phase)}
              uploadProgress={
                tf.phase === 'uploading' || tf.phase === 'uploaded'
                  ? tf.uploadProgress
                  : undefined
              }
              errorMessage={tf.phase === 'failed' ? (tf.errorMessage ?? undefined) : undefined}
              onRemove={
                !isBusy && (tf.phase === 'idle' || tf.phase === 'parsed')
                  ? () => handleRemoveFile(i)
                  : undefined
              }
              onRetry={
                tf.phase === 'failed'
                  ? () => handleRemoveFile(i)
                  : undefined
              }
            />
          ))}
        </ProcessingQueue>
      )}

      {/* Status messages */}
      {modalPhase === 'uploading' && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Uploading documents...
        </div>
      )}
      {modalPhase === 'parsing' && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Extracting data from your documents...
        </div>
      )}
      {modalPhase === 'done' && (
        <p className="text-sm text-[#16A34A] font-medium">
          Extraction complete. Redirecting to Gap Detector...
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-2 border-t border-border">
        <Button
          variant="outline"
          onClick={() => router.back()}
          disabled={isBusy}
        >
          {existingDocsLoaded && files.some((f) => f.phase === 'parsed') ? 'Back' : 'Cancel'}
        </Button>
        {canContinue ? (
          <Button
            onClick={() => router.push(`/assessments/gap-detector?id=${assessmentId}`)}
            className="bg-[#4CAF50] hover:bg-[#43A047] text-white"
          >
            Continue to Gap Detector
          </Button>
        ) : (
          <Button
            onClick={handleUpload}
            disabled={!canUpload}
            className="bg-[#4CAF50] hover:bg-[#43A047] text-white"
          >
            {isBusy ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {modalPhase === 'uploading' ? 'Uploading...' : 'Analysing...'}
              </>
            ) : (
              `Upload & Analyse${newFiles.length > 1 ? ` (${newFiles.length} files)` : newFiles.length === 1 ? ' (1 file)' : ''}`
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── S3 XHR upload helper ────────────────────────────────────────────────────

async function uploadToS3(
  presignedUrl: string,
  fields: Record<string, string>,
  selectedFile: SelectedFile,
  onProgress: (pct: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        const pct = Math.round((e.loaded / e.total) * 100);
        onProgress(Math.min(pct, 99));
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100);
        resolve();
      } else {
        reject(new Error(`Upload failed with HTTP ${xhr.status}`));
      }
    });

    xhr.addEventListener('error', () => reject(new Error('Network error during upload')));
    xhr.addEventListener('abort', () => reject(new Error('Upload aborted')));

    xhr.open('POST', presignedUrl);

    const formData = new FormData();
    Object.entries(fields).forEach(([key, value]) => {
      formData.append(key, value);
    });
    formData.append('file', selectedFile.file);

    xhr.send(formData);
  });
}
