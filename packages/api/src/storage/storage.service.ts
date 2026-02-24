import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';

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
   * Generate a presigned URL for uploading a file to S3.
   * Key convention: assessments/{assessmentId}/documents/{documentId}/{fileName}
   */
  async generatePresignedUploadUrl(
    key: string,
    contentType: string,
    expiresIn: number = 3600,
  ): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      ContentType: contentType,
    });

    return getSignedUrl(this.s3Client, command, { expiresIn });
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
