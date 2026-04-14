import { ProgrammaticExtractor } from './programmatic.extractor';
import type { StorageService } from '../storage/storage.service';
import type { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';

jest.mock('mammoth', () => ({
  __esModule: true,
  default: {
    extractRawText: jest.fn(),
    convertToHtml: jest.fn(),
  },
}));

import mammoth from 'mammoth';

const mockStorage = {
  downloadObject: jest.fn(),
} as unknown as jest.Mocked<StorageService>;

const mockConfig = {
  get: jest.fn(),
} as unknown as jest.Mocked<ConfigService>;

const mammothMock = mammoth as jest.Mocked<typeof mammoth>;

describe('ProgrammaticExtractor', () => {
  let extractor: ProgrammaticExtractor;
  let loggerLogSpy: jest.SpyInstance;
  let loggerWarnSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    mockConfig.get = jest.fn().mockReturnValue(undefined);
    extractor = new ProgrammaticExtractor(mockStorage as any, mockConfig as any);
    loggerLogSpy = jest.spyOn((extractor as any).logger, 'log').mockImplementation();
    loggerWarnSpy = jest.spyOn((extractor as any).logger, 'warn').mockImplementation();
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

  describe('docx extraction', () => {
    it('should use raw text mode by default', async () => {
      (mockStorage.downloadObject as jest.Mock).mockResolvedValue(Buffer.from('docx'));
      mammothMock.extractRawText.mockResolvedValue({ value: 'Raw DOCX text', messages: [] } as any);

      const result = await extractor.extract(
        'bucket',
        'key.docx',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'file.docx',
      );

      expect(mammothMock.extractRawText).toHaveBeenCalledWith({ buffer: expect.any(Buffer) });
      expect(mammothMock.convertToHtml).not.toHaveBeenCalled();
      expect(result.markdownContent).toBe('Raw DOCX text');
      expect(result.textContent).toBe('Raw DOCX text');
      expect(result.metadata.extractorModel).toBe('programmatic-docx-text');
    });

    it('should use html fallback mode when configured', async () => {
      mockConfig.get = jest.fn().mockReturnValue('html');
      extractor = new ProgrammaticExtractor(mockStorage as any, mockConfig as any);
      loggerLogSpy = jest.spyOn((extractor as any).logger, 'log').mockImplementation();
      loggerWarnSpy = jest.spyOn((extractor as any).logger, 'warn').mockImplementation();

      (mockStorage.downloadObject as jest.Mock).mockResolvedValue(
        Buffer.from('<h1>Ignored source</h1>'),
      );
      mammothMock.convertToHtml.mockResolvedValue({
        value: '<h1>Legacy Title</h1><p>Legacy body</p>',
        messages: [],
      } as any);

      const result = await extractor.extract(
        'bucket',
        'key.docx',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'file.docx',
      );

      expect(mammothMock.convertToHtml).toHaveBeenCalledWith({ buffer: expect.any(Buffer) });
      expect(mammothMock.extractRawText).not.toHaveBeenCalled();
      expect(result.markdownContent).toContain('Legacy Title');
      expect(result.markdownContent).toContain('Legacy body');
      expect(result.metadata.extractorModel).toBe('programmatic-docx-html');
    });

    it('should warn and default to text for unknown extraction mode', async () => {
      mockConfig.get = jest.fn().mockReturnValue('weird');
      const constructorWarnSpy = jest
        .spyOn(Logger.prototype, 'warn')
        .mockImplementation();
      extractor = new ProgrammaticExtractor(mockStorage as any, mockConfig as any);

      expect(constructorWarnSpy).toHaveBeenCalledWith(
        'Unknown DOCX_EXTRACTION_MODE="weird"; defaulting to "text"',
      );

      constructorWarnSpy.mockRestore();
    });

    it('should default to text for undefined and empty extraction mode values', async () => {
      const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();

      mockConfig.get = jest.fn().mockReturnValue(undefined);
      extractor = new ProgrammaticExtractor(mockStorage as any, mockConfig as any);
      expect((extractor as any).docxMode).toBe('text');

      mockConfig.get = jest.fn().mockReturnValue('');
      extractor = new ProgrammaticExtractor(mockStorage as any, mockConfig as any);
      expect((extractor as any).docxMode).toBe('text');

      expect(warnSpy).not.toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it.each(['TEXT', 'text', '  text  '])('should normalize %p to text mode', (rawMode) => {
      mockConfig.get = jest.fn().mockReturnValue(rawMode);
      extractor = new ProgrammaticExtractor(mockStorage as any, mockConfig as any);

      expect((extractor as any).docxMode).toBe('text');
    });

    it.each(['html', 'HTML', 'Html'])('should normalize %p to html mode', (rawMode) => {
      mockConfig.get = jest.fn().mockReturnValue(rawMode);
      extractor = new ProgrammaticExtractor(mockStorage as any, mockConfig as any);

      expect((extractor as any).docxMode).toBe('html');
    });

    it('should emit exactly one warning for an unknown extraction mode', () => {
      mockConfig.get = jest.fn().mockReturnValue('unsupported');
      const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();

      extractor = new ProgrammaticExtractor(mockStorage as any, mockConfig as any);

      expect((extractor as any).docxMode).toBe('text');
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy).toHaveBeenCalledWith(
        'Unknown DOCX_EXTRACTION_MODE="unsupported"; defaulting to "text"',
      );

      warnSpy.mockRestore();
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

    it('should emit structured timing logs', async () => {
      (mockStorage.downloadObject as jest.Mock).mockResolvedValue(Buffer.from('test', 'utf-8'));

      await extractor.extract('bucket', 'key.txt', 'text/plain', 'file.txt');

      const payload = loggerLogSpy.mock.calls
        .map(([message]) => message)
        .find((message) => typeof message === 'string' && message.includes('"event":"extraction_complete"'));

      expect(payload).toBeDefined();
      expect(JSON.parse(payload)).toEqual(
        expect.objectContaining({
          event: 'extraction_complete',
          mime: 'text/plain',
          fileName: 'file.txt',
          mode: null,
          download_ms: expect.any(Number),
          extract_ms: expect.any(Number),
          total_ms: expect.any(Number),
          content_length: 4,
        }),
      );

      const parsedPayload = JSON.parse(payload);
      expect(Math.abs(parsedPayload.total_ms - (parsedPayload.download_ms + parsedPayload.extract_ms))).toBeLessThanOrEqual(5);
      expect(payload).not.toContain('test');
    });

    it('should warn when extraction returns empty content', async () => {
      (mockStorage.downloadObject as jest.Mock).mockResolvedValue(Buffer.from('', 'utf-8'));

      await extractor.extract('bucket', 'key.txt', 'text/plain', 'file.txt');

      const payload = loggerWarnSpy.mock.calls
        .map(([message]) => message)
        .find((message) => typeof message === 'string' && message.includes('"event":"extraction_complete"'));

      expect(payload).toBeDefined();
      expect(JSON.parse(payload)).toEqual(
        expect.objectContaining({
          event: 'extraction_complete',
          mode: null,
          content_length: 0,
        }),
      );

      expect(loggerLogSpy.mock.calls.some(([message]) => typeof message === 'string' && message.includes('"event":"extraction_complete"'))).toBe(false);
    });

    it('should emit a structured info log for successful DOCX extraction', async () => {
      (mockStorage.downloadObject as jest.Mock).mockResolvedValue(Buffer.from('docx'));
      mammothMock.extractRawText.mockResolvedValue({ value: 'DOCX output', messages: [] } as any);

      await extractor.extract(
        'bucket',
        'key.docx',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'file.docx',
      );

      const payload = loggerLogSpy.mock.calls
        .map(([message]) => message)
        .find((message) => typeof message === 'string' && message.includes('"event":"extraction_complete"'));

      expect(payload).toBeDefined();
      expect(JSON.parse(payload)).toEqual(
        expect.objectContaining({
          event: 'extraction_complete',
          mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          fileName: 'file.docx',
          mode: 'text',
          download_ms: expect.any(Number),
          extract_ms: expect.any(Number),
          total_ms: expect.any(Number),
          content_length: 'DOCX output'.length,
        }),
      );
    });
  });
});
