import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { ConfigService } from '@nestjs/config';
import type { StorageService } from '../storage/storage.service';
import { ProgrammaticExtractor } from './programmatic.extractor';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const FIXTURE_PATH = path.resolve(__dirname, '../../../test/fixtures/sample-business-plan.docx');
const PERF_ENABLED = process.env.RUN_DOCX_PERF === '1';
const maybeDescribe = PERF_ENABLED ? describe : describe.skip;

function createExtractor(buffer: Buffer, mode: 'text' | 'html') {
  const storage = {
    downloadObject: jest.fn().mockResolvedValue(buffer),
  } as unknown as jest.Mocked<StorageService>;

  const config = {
    get: jest.fn().mockReturnValue(mode),
  } as unknown as jest.Mocked<ConfigService>;

  return new ProgrammaticExtractor(storage, config);
}

maybeDescribe('ProgrammaticExtractor DOCX perf @jest.slow', () => {
  const fixtureBuffer = readFileSync(FIXTURE_PATH);

  it('extracts the synthetic fixture in text mode under 2000 ms', async () => {
    const extractor = createExtractor(fixtureBuffer, 'text');
    const startedAt = Date.now();

    const result = await extractor.extract('bucket', 'sample-business-plan.docx', DOCX_MIME, 'sample-business-plan.docx');

    const durationMs = Date.now() - startedAt;
    expect(durationMs).toBeLessThan(2000);
    expect(result.textContent.trim().length).toBeGreaterThan(500);
    expect(result.markdownContent.trim().length).toBeGreaterThan(500);
    expect(result.metadata.extractorModel).toBe('programmatic-docx-text');
  });

  it('extracts the synthetic fixture in html mode under 5000 ms', async () => {
    const extractor = createExtractor(fixtureBuffer, 'html');
    const startedAt = Date.now();

    const result = await extractor.extract('bucket', 'sample-business-plan.docx', DOCX_MIME, 'sample-business-plan.docx');

    const durationMs = Date.now() - startedAt;
    expect(durationMs).toBeLessThan(5000);
    expect(result.textContent.trim().length).toBeGreaterThan(500);
    expect(result.markdownContent.trim().length).toBeGreaterThan(500);
    expect(result.metadata.extractorModel).toBe('programmatic-docx-html');
  });
});
