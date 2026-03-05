import { Module } from '@nestjs/common';
import { TextractModule } from '../textract/textract.module';
import { StorageModule } from '../storage/storage.module';
import { TextractExtractor } from './textract.extractor';
import { ProgrammaticExtractor } from './programmatic.extractor';
import { ExtractorFactory } from './extractor-factory';

/**
 * Provides the extractor strategy pattern.
 * JobsModule imports this to give ParseDocumentHandler access to ExtractorFactory.
 */
@Module({
  imports: [TextractModule, StorageModule],
  providers: [TextractExtractor, ProgrammaticExtractor, ExtractorFactory],
  exports: [TextractExtractor, ProgrammaticExtractor, ExtractorFactory],
})
export class ExtractorsModule {}
