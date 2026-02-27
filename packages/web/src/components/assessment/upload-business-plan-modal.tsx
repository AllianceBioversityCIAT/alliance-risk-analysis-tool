'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { sileo } from 'sileo';
import { JobStatus } from '@alliance-risk/shared';
import { Button } from '@/components/ui/button';
import { UploadDropzone, type SelectedFile } from './upload-dropzone';
import { FileListItem, ProcessingQueue, type FileItemStatus } from './file-list-item';
import { useRequestUploadUrl, useTriggerParseDocument } from '@/hooks/use-assessments';
import { useDocumentStatus } from '@/hooks/use-document-status';

interface UploadBusinessPlanModalProps {
  assessmentId: string;
}

type UploadPhase =
  | 'idle'           // No file selected
  | 'uploading'      // S3 XHR in progress
  | 'triggering'     // POST /parse request
  | 'parsing'        // Polling job, waiting for COMPLETED/FAILED
  | 'done'           // Job COMPLETED, about to redirect
  | 'error';         // Unrecoverable error (allows retry)

export function UploadBusinessPlanModal({ assessmentId }: UploadBusinessPlanModalProps) {
  const router = useRouter();
  const [selectedFile, setSelectedFile] = useState<SelectedFile | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [phase, setPhase] = useState<UploadPhase>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { mutateAsync: requestUploadUrl } = useRequestUploadUrl();
  const { mutateAsync: triggerParse } = useTriggerParseDocument();
  const { jobStatus, errorMessage: jobError, isProcessing, startPolling, reset: resetPolling } =
    useDocumentStatus();

  // Keep a ref to the current phase for the beforeunload handler
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  // --- beforeunload warning -------------------------------------------
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      const activePhases: UploadPhase[] = ['uploading', 'triggering', 'parsing'];
      if (activePhases.includes(phaseRef.current)) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  // --- React to job completion / failure --------------------------------
  useEffect(() => {
    if (jobStatus === JobStatus.COMPLETED) {
      setPhase('done');
      sileo.success({
        title: 'Document analysed',
        description: 'Your PDF has been extracted. Redirecting to Gap Detector...',
      });
      setTimeout(() => {
        router.push(`/assessments/gap-detector?id=${assessmentId}`);
      }, 1500);
    } else if (jobStatus === JobStatus.FAILED) {
      const msg = jobError ?? 'Document analysis failed. Please try again.';
      setErrorMessage(msg);
      setPhase('error');
      sileo.error({ title: 'Analysis failed', description: msg });
    }
  }, [jobStatus, jobError, assessmentId, router]);

  // --- Handlers ----------------------------------------------------------
  const handleFileSelected = useCallback((file: SelectedFile) => {
    setSelectedFile(file);
    setUploadProgress(0);
    setPhase('idle');
    setErrorMessage(null);
    resetPolling();
  }, [resetPolling]);

  const handleRemoveFile = useCallback(() => {
    setSelectedFile(null);
    setUploadProgress(0);
    setPhase('idle');
    setErrorMessage(null);
    resetPolling();
  }, [resetPolling]);

  const handleUpload = useCallback(async () => {
    if (!selectedFile) return;
    setErrorMessage(null);

    try {
      // Step 1: Request presigned URL + document record
      setPhase('uploading');
      const { presignedUrl, documentId } = await requestUploadUrl({
        assessmentId,
        fileName: selectedFile.name,
        mimeType: selectedFile.mimeType,
        fileSize: selectedFile.size,
      });

      // Step 2: Upload file to S3 with XHR progress
      await uploadToS3(presignedUrl, selectedFile, (pct) => setUploadProgress(pct));
      setUploadProgress(100);

      // Step 3: Trigger parse job
      setPhase('triggering');
      const jobId = await triggerParse({ assessmentId, documentId });

      // Step 4: Start polling
      setPhase('parsing');
      startPolling(jobId as string);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'An error occurred. Please try again.';
      setErrorMessage(msg);
      setPhase('error');
      sileo.error({ title: 'Upload failed', description: msg });
    }
  }, [selectedFile, assessmentId, requestUploadUrl, triggerParse, startPolling]);

  // --- Derive FileListItem status from phase ----------------------------
  const fileItemStatus: FileItemStatus = (() => {
    if (phase === 'uploading') return 'uploading';
    if (phase === 'triggering' || phase === 'parsing' || isProcessing) return 'parsing';
    if (phase === 'done') return 'complete';
    if (phase === 'error') return 'failed';
    return 'idle';
  })();

  const isBusy = phase === 'uploading' || phase === 'triggering' || phase === 'parsing';

  return (
    <div className="space-y-6">
      {/* Dropzone — shown only when no file is selected yet */}
      {!selectedFile && (
        <UploadDropzone onFileSelected={handleFileSelected} disabled={isBusy} />
      )}

      {/* Processing queue */}
      {selectedFile && (
        <ProcessingQueue>
          <FileListItem
            fileName={selectedFile.name}
            fileSize={selectedFile.size}
            status={fileItemStatus}
            uploadProgress={phase === 'uploading' ? uploadProgress : undefined}
            errorMessage={phase === 'error' ? (errorMessage ?? undefined) : undefined}
            onRemove={!isBusy && phase !== 'done' ? handleRemoveFile : undefined}
            onRetry={phase === 'error' ? handleRemoveFile : undefined}
          />
        </ProcessingQueue>
      )}

      {/* Status messages */}
      {(phase === 'triggering' || (phase === 'parsing' && isProcessing)) && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {phase === 'triggering'
            ? 'Starting document analysis...'
            : 'Extracting data from your document...'}
        </div>
      )}
      {phase === 'done' && (
        <p className="text-sm text-[#16A34A] font-medium">
          Extraction complete. Redirecting to Gap Detector...
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-2 border-t border-border">
        <Button
          variant="outline"
          onClick={() => router.push('/dashboard')}
          disabled={isBusy}
        >
          Cancel
        </Button>
        <Button
          onClick={handleUpload}
          disabled={!selectedFile || isBusy || phase === 'done'}
          className="bg-[#4CAF50] hover:bg-[#43A047] text-white"
        >
          {isBusy ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {phase === 'uploading' ? `Uploading ${uploadProgress}%...` : 'Analysing...'}
            </>
          ) : (
            'Upload & Analyse'
          )}
        </Button>
      </div>
    </div>
  );
}

// ─── S3 XHR upload helper ────────────────────────────────────────────────────

async function uploadToS3(
  presignedUrl: string,
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
        resolve();
      } else {
        reject(new Error(`Upload failed with HTTP ${xhr.status}`));
      }
    });

    xhr.addEventListener('error', () => reject(new Error('Network error during upload')));
    xhr.addEventListener('abort', () => reject(new Error('Upload aborted')));

    xhr.open('PUT', presignedUrl);
    xhr.setRequestHeader('Content-Type', selectedFile.mimeType);
    xhr.send(selectedFile.file);
  });
}
