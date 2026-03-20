import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import type { Readable } from 'stream';

export interface PresignedPostData {
  url: string;
  fields: Record<string, string>;
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly s3Client: S3Client;
  private readonly bucketName: string;

  constructor(private readonly configService: ConfigService) {
    const region = this.configService.get<string>('AWS_REGION', 'us-east-1');
    this.s3Client = new S3Client({ region });
    this.bucketName = this.configService.get<string>('S3_BUCKET_NAME', 'alliance-risk-files');
  }

  /**
   * Generate a presigned POST for uploading a file to S3.
   * Key convention: assessments/{assessmentId}/documents/{documentId}/{fileName}
   * Limits upload size directly on S3 to prevent Denial of Wallet attacks.
   */
  async generatePresignedUploadUrl(
    key: string,
    contentType: string,
    expiresIn: number = 3600,
  ): Promise<PresignedPostData> {
    const { url, fields } = await createPresignedPost(this.s3Client, {
      Bucket: this.bucketName,
      Key: key,
      Conditions: [
        ['content-length-range', 0, 26214400], // max 25MB
        ['eq', '$Content-Type', contentType]
      ],
      Fields: {
        'Content-Type': contentType,
      },
      Expires: expiresIn,
    });

    return { url, fields };
  }

  /**
   * Generate a presigned URL for downloading a file from S3.
   */
  async generatePresignedDownloadUrl(
    key: string,
    expiresIn: number = 3600,
  ): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    return getSignedUrl(this.s3Client, command, { expiresIn });
  }

  /**
   * Download an object from S3 and return its contents as a Buffer.
   * Used by ProgrammaticExtractor to process non-PDF documents in-memory.
   */
  async downloadObject(key: string): Promise<Buffer> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    const response = await this.s3Client.send(command);

    if (!response.Body) {
      throw new Error(`S3 object ${key} has no body`);
    }

    // Collect stream chunks into a single Buffer
    const chunks: Uint8Array[] = [];
    for await (const chunk of response.Body as Readable) {
      chunks.push(chunk as Uint8Array);
    }
    return Buffer.concat(chunks);
  }

  /**
   * Delete an object from S3.
   */
  async deleteObject(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    await this.s3Client.send(command);
    this.logger.log(`Deleted S3 object: ${key}`);
  }

  /**
   * Upload a Buffer directly to S3.
   * Used for generated PDFs and other server-created content.
   */
  async uploadBuffer(key: string, buffer: Buffer, contentType: string): Promise<void> {
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    });

    await this.s3Client.send(command);
    this.logger.log(`Uploaded buffer to S3: ${key} (${buffer.length} bytes)`);
  }

  /**
   * Build the S3 key for an assessment document.
   * Convention: assessments/{assessmentId}/documents/{documentId}/{fileName}
   */
  buildDocumentKey(assessmentId: string, documentId: string, fileName: string): string {
    return `assessments/${assessmentId}/documents/${documentId}/${fileName}`;
  }

  /**
   * Build the S3 key for a generated report PDF.
   * Convention: assessments/{assessmentId}/reports/{reportId}.pdf
   */
  buildReportKey(assessmentId: string, reportId: string): string {
    return `assessments/${assessmentId}/reports/${reportId}.pdf`;
  }
}
