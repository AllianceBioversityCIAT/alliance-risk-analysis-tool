import { ProgrammaticExtractor } from './programmatic.extractor';
import type { StorageService } from '../storage/storage.service';

const mockStorage = {
  downloadObject: jest.fn(),
} as unknown as jest.Mocked<StorageService>;

describe('ProgrammaticExtractor', () => {
  let extractor: ProgrammaticExtractor;

  beforeEach(() => {
    jest.clearAllMocks();
    extractor = new ProgrammaticExtractor(mockStorage as any);
  });

  it('should list supported MIME types without application/msword', () => {
    expect(extractor.supportedMimeTypes).not.toContain('application/msword');
    expect(extractor.supportedMimeTypes).toContain(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
  });

  describe('text/plain extraction', () => {
    it('should return plain text as-is', async () => {
      const content = 'Hello, World!\nLine 2.';
      (mockStorage.downloadObject as jest.Mock).mockResolvedValue(
        Buffer.from(content, 'utf-8'),
      );

      const result = await extractor.extract('bucket', 'key.txt', 'text/plain', 'file.txt');

      expect(result.markdownContent).toBe(content);
      expect(result.textContent).toBe(content);
      expect(result.metadata.extractorModel).toBe('programmatic');
      expect(result.pages).toBe(0);
      expect(result.tables).toEqual([]);
    });
  });

  describe('text/markdown extraction', () => {
    it('should return markdown as-is', async () => {
      const content = '# Title\n\nParagraph.';
      (mockStorage.downloadObject as jest.Mock).mockResolvedValue(
        Buffer.from(content, 'utf-8'),
      );

      const result = await extractor.extract('bucket', 'key.md', 'text/markdown', 'file.md');
      expect(result.markdownContent).toBe(content);
    });
  });

  describe('text/html extraction', () => {
    it('should convert HTML to Markdown', async () => {
      const html = '<h1>Title</h1><p>Paragraph text.</p>';
      (mockStorage.downloadObject as jest.Mock).mockResolvedValue(
        Buffer.from(html, 'utf-8'),
      );

      const result = await extractor.extract('bucket', 'key.html', 'text/html', 'file.html');
      expect(result.markdownContent).toContain('Title');
      expect(result.markdownContent).toContain('Paragraph text.');
    });
  });

  describe('text/csv extraction', () => {
    it('should convert CSV to Markdown table', async () => {
      const csv = 'Name,Age,City\nAlice,30,NYC\nBob,25,LA';
      (mockStorage.downloadObject as jest.Mock).mockResolvedValue(
        Buffer.from(csv, 'utf-8'),
      );

      const result = await extractor.extract('bucket', 'key.csv', 'text/csv', 'file.csv');
      expect(result.markdownContent).toContain('| Name | Age | City |');
      expect(result.markdownContent).toContain('| --- | --- | --- |');
      expect(result.markdownContent).toContain('| Alice | 30 | NYC |');
      expect(result.markdownContent).toContain('| Bob | 25 | LA |');
    });

    it('should escape pipe characters in cell values', async () => {
      const csv = 'Col1,Col2\n"a|b",c';
      (mockStorage.downloadObject as jest.Mock).mockResolvedValue(
        Buffer.from(csv, 'utf-8'),
      );

      const result = await extractor.extract('bucket', 'key.csv', 'text/csv', 'file.csv');
      expect(result.markdownContent).toContain('a\\|b');
    });

    it('should handle single-row CSV', async () => {
      const csv = 'Name,Age';
      (mockStorage.downloadObject as jest.Mock).mockResolvedValue(
        Buffer.from(csv, 'utf-8'),
      );

      const result = await extractor.extract('bucket', 'key.csv', 'text/csv', 'file.csv');
      expect(result.markdownContent).toContain('| Name | Age |');
      expect(result.markdownContent).toContain('| --- | --- |');
    });
  });

  describe('metadata', () => {
    it('should include processing time and ISO timestamp', async () => {
      (mockStorage.downloadObject as jest.Mock).mockResolvedValue(
        Buffer.from('test', 'utf-8'),
      );

      const result = await extractor.extract('bucket', 'key.txt', 'text/plain', 'file.txt');

      expect(result.metadata.s3Key).toBe('key.txt');
      expect(result.metadata.extractorModel).toBe('programmatic');
      expect(result.metadata.processingTimeMs).toBeGreaterThanOrEqual(0);
      expect(result.metadata.processedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });
});
