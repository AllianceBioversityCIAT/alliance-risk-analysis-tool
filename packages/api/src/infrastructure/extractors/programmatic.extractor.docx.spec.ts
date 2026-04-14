import mammoth from 'mammoth';
import TurndownService from 'turndown';
import * as XLSX from 'xlsx';
import type { ConfigService } from '@nestjs/config';
import type { StorageService } from '../storage/storage.service';
import { ProgrammaticExtractor } from './programmatic.extractor';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

describe('ProgrammaticExtractor DOCX regression', () => {
  function createExtractor(buffer: Buffer, mode?: 'text' | 'html') {
    const storage = {
      downloadObject: jest.fn().mockResolvedValue(buffer),
    } as unknown as jest.Mocked<StorageService>;

    const config = {
      get: jest.fn().mockReturnValue(mode),
    } as unknown as jest.Mocked<ConfigService>;

    return new ProgrammaticExtractor(storage, config);
  }

  it('extractDocxAsText returns non-empty text for a minimal DOCX fixture', async () => {
    const buffer = createMinimalDocxBuffer();
    const extractor = createExtractor(buffer);

    const result = await extractor.extract('bucket', 'fixture.docx', DOCX_MIME, 'fixture.docx');

    expect(result.textContent).toContain('Hello DOCX world.');
    expect(result.markdownContent).toBe(result.textContent);
    expect(result.metadata.extractorModel).toBe('programmatic-docx-text');
  });

  it('extractDocxAsHtml stays byte-identical to the legacy DOCX conversion path', async () => {
    const buffer = createMinimalDocxBuffer();
    const extractor = createExtractor(buffer, 'html');
    const legacyHtml = await mammoth.convertToHtml({ buffer });
    const legacyMarkdown = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
    }).turndown(legacyHtml.value);

    const result = await extractor.extract('bucket', 'fixture.docx', DOCX_MIME, 'fixture.docx');

    expect(result.markdownContent).toBe(legacyMarkdown);
    expect(result.textContent).toBe(legacyMarkdown);
    expect(result.metadata.extractorModel).toBe('programmatic-docx-html');
  });

  it('keeps non-DOCX extraction output unchanged for Excel, CSV, HTML, and Markdown', async () => {
    const cases = [
      {
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        fileName: 'sheet.xlsx',
        buffer: createWorkbookBuffer(),
        expected: buildLegacyExcelMarkdown(createWorkbookBuffer()),
      },
      {
        mimeType: 'text/csv',
        fileName: 'table.csv',
        buffer: Buffer.from('Name,Age\nAlice,30\nBob,25', 'utf-8'),
        expected: buildLegacyCsvMarkdown(Buffer.from('Name,Age\nAlice,30\nBob,25', 'utf-8')),
      },
      {
        mimeType: 'text/html',
        fileName: 'page.html',
        buffer: Buffer.from('<h1>Title</h1><p>Body copy.</p>', 'utf-8'),
        expected: buildLegacyHtmlMarkdown(Buffer.from('<h1>Title</h1><p>Body copy.</p>', 'utf-8')),
      },
      {
        mimeType: 'text/markdown',
        fileName: 'notes.md',
        buffer: Buffer.from('# Heading\n\nParagraph', 'utf-8'),
        expected: '# Heading\n\nParagraph',
      },
    ] as const;

    for (const testCase of cases) {
      const extractor = createExtractor(testCase.buffer);
      const result = await extractor.extract('bucket', testCase.fileName, testCase.mimeType, testCase.fileName);

      expect(result.markdownContent).toBe(testCase.expected);
      expect(result.textContent).toBe(testCase.expected);
    }
  });
});

function createMinimalDocxBuffer(): Buffer {
  return buildStoredZip([
    {
      name: '[Content_Types].xml',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`,
    },
    {
      name: '_rels/.rels',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`,
    },
    {
      name: 'word/document.xml',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>Hello DOCX world.</w:t></w:r></w:p>
    <w:p><w:r><w:t>Second paragraph.</w:t></w:r></w:p>
  </w:body>
</w:document>`,
    },
  ]);
}

function createWorkbookBuffer(): Buffer {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([
    ['Name', 'Age'],
    ['Alice', 30],
    ['Bob', 25],
  ]);
  XLSX.utils.book_append_sheet(workbook, sheet, 'Sheet1');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

function buildLegacyExcelMarkdown(buffer: Buffer): string {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sections: string[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const data: string[][] = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: '',
      raw: false,
    });

    if (data.length === 0) continue;

    const table = buildLegacyMarkdownTable(data);
    if (workbook.SheetNames.length > 1) {
      sections.push(`## ${sheetName}\n\n${table}`);
    } else {
      sections.push(table);
    }
  }

  return sections.join('\n\n');
}

function buildLegacyCsvMarkdown(buffer: Buffer): string {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data: string[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: '',
    raw: false,
  });
  return buildLegacyMarkdownTable(data);
}

function buildLegacyHtmlMarkdown(buffer: Buffer): string {
  const html = buffer.toString('utf-8');
  const turndown = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
  });
  return turndown.turndown(html);
}

function buildLegacyMarkdownTable(data: string[][]): string {
  const colCount = Math.max(...data.map((row) => row.length));
  const rows = data.map((row) => {
    const padded = [...row];
    while (padded.length < colCount) padded.push('');
    return padded.map((cell) => escapeLegacyCell(String(cell)));
  });

  const header = `| ${rows[0].join(' | ')} |`;
  const separator = `| ${rows[0].map(() => '---').join(' | ')} |`;
  const body = rows.slice(1).map((row) => `| ${row.join(' | ')} |`).join('\n');
  return [header, separator, body].filter(Boolean).join('\n');
}

function escapeLegacyCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\n/g, ' ').trim();
}

function buildStoredZip(entries: Array<{ name: string; content: string }>): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuffer = Buffer.from(entry.name, 'utf-8');
    const dataBuffer = Buffer.from(entry.content, 'utf-8');
    const crc = crc32(dataBuffer);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(dataBuffer.length, 18);
    localHeader.writeUInt32LE(dataBuffer.length, 22);
    localHeader.writeUInt16LE(nameBuffer.length, 26);
    localHeader.writeUInt16LE(0, 28);

    localParts.push(localHeader, nameBuffer, dataBuffer);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(dataBuffer.length, 20);
    centralHeader.writeUInt32LE(dataBuffer.length, 24);
    centralHeader.writeUInt16LE(nameBuffer.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);

    centralParts.push(centralHeader, nameBuffer);
    offset += localHeader.length + nameBuffer.length + dataBuffer.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const endRecord = Buffer.alloc(22);
  endRecord.writeUInt32LE(0x06054b50, 0);
  endRecord.writeUInt16LE(0, 4);
  endRecord.writeUInt16LE(0, 6);
  endRecord.writeUInt16LE(entries.length, 8);
  endRecord.writeUInt16LE(entries.length, 10);
  endRecord.writeUInt32LE(centralDirectory.length, 12);
  endRecord.writeUInt32LE(offset, 16);
  endRecord.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralDirectory, endRecord]);
}

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;

  for (const byte of buffer) {
    crc ^= byte;
    for (let index = 0; index < 8; index++) {
      crc = (crc & 1) === 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }

  return (crc ^ 0xffffffff) >>> 0;
}
