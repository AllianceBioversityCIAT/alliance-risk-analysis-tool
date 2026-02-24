'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { UploadDropzone, FilePreview, type SelectedFile } from './upload-dropzone';
import { useRequestUploadUrl, useTriggerParseDocument } from '@/hooks/use-assessments';

interface UploadBusinessPlanModalProps {
  assessmentId: string;
}

type UploadState = 'idle' | 'uploading' | 'processing' | 'done' | 'error';

export function UploadBusinessPlanModal({ assessmentId }: UploadBusinessPlanModalProps) {
  const router = useRouter();
  const [selectedFile, setSelectedFile] = useState<SelectedFile | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | undefined>(undefined);
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { mutateAsync: requestUploadUrl } = useRequestUploadUrl();
  const { mutateAsync: triggerParse } = useTriggerParseDocument();

  const handleFileSelected = useCallback((file: SelectedFile) => {
    setSelectedFile(file);
    setUploadProgress(undefined);
    setUploadState('idle');
    setErrorMessage(null);
  }, []);

  const handleRemoveFile = useCallback(() => {
    setSelectedFile(null);
    setUploadProgress(undefined);
    setUploadState('idle');
    setErrorMessage(null);
  }, []);

  const handleUpload = useCallback(async () => {
    if (!selectedFile) return;
    setUploadState('uploading');
    setErrorMessage(null);

    try {
      // Step 1: Get presigned URL + document record
      const { presignedUrl, documentId } = await requestUploadUrl({
        assessmentId,
        fileName: selectedFile.name,
        mimeType: selectedFile.mimeType,
        fileSize: selectedFile.size,
      });

      // Step 2: Upload file directly to S3 with progress tracking
      await uploadToS3(presignedUrl, selectedFile, (progress) => {
        setUploadProgress(progress);
      });

      setUploadProgress(100);
      setUploadState('processing');

      // Step 3: Trigger parse job
      await triggerParse({ assessmentId, documentId });

      setUploadState('done');

      // Navigate to gap detector after a short delay
      setTimeout(() => {
        router.push(`/assessments/${assessmentId}/gap-detector`);
      }, 1200);
    } catch (err) {
      setUploadState('error');
      setErrorMessage(
        err instanceof Error ? err.message : 'An error occurred during upload. Please try again.',
      );
    }
  }, [selectedFile, assessmentId, requestUploadUrl, triggerParse, router]);

  const isUploading = uploadState === 'uploading' || uploadState === 'processing';

  return (
    <div className="space-y-6">
      {/* Dropzone — hide once file is selected */}
      {!selectedFile && (
        <UploadDropzone onFileSelected={handleFileSelected} disabled={isUploading} />
      )}

      {/* File preview with progress */}
      {selectedFile && (
        <FilePreview
          file={selectedFile}
          progress={uploadProgress}
          onRemove={uploadState === 'idle' ? handleRemoveFile : undefined}
        />
      )}

      {/* Error message */}
      {errorMessage && (
        <p className="text-sm text-destructive">{errorMessage}</p>
      )}

      {/* Status messages */}
      {uploadState === 'processing' && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Triggering document analysis...
        </div>
      )}
      {uploadState === 'done' && (
        <p className="text-sm text-green-600 font-medium">
          Document uploaded. Redirecting to Gap Detector...
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-2 border-t border-border">
        <Button
          variant="outline"
          onClick={() => router.push('/dashboard')}
          disabled={isUploading}
        >
          Cancel
        </Button>
        <Button
          onClick={handleUpload}
          disabled={!selectedFile || isUploading || uploadState === 'done'}
        >
          {isUploading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Uploading...
            </>
          ) : (
            'Upload & Analyze'
          )}
        </Button>
      </div>
    </div>
  );
}

// Helper: upload file to S3 with XHR for progress
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
        onProgress(Math.min(pct, 99)); // reserve 100 for completion
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Upload failed with status ${xhr.status}`));
      }
    });

    xhr.addEventListener('error', () => reject(new Error('Network error during upload')));
    xhr.addEventListener('abort', () => reject(new Error('Upload aborted')));

    xhr.open('PUT', presignedUrl);
    xhr.setRequestHeader('Content-Type', selectedFile.mimeType);
    xhr.send(selectedFile.file);
  });
}

