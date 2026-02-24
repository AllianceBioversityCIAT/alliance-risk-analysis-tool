import { Test, TestingModule } from '@nestjs/testing';
import { VariableInjectionService } from './variable-injection.service';

describe('VariableInjectionService', () => {
  let service: VariableInjectionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [VariableInjectionService],
    }).compile();

    service = module.get<VariableInjectionService>(VariableInjectionService);
  });

  describe('inject', () => {
    it('should replace {{category_1}} with the first category', () => {
      const result = service.inject('Analyze {{category_1}} risk', ['Financial']);
      expect(result).toBe('Analyze Financial risk');
    });

    it('should replace multiple category placeholders', () => {
      const result = service.inject(
        'For {{category_1}} and {{category_2}}',
        ['Financial', 'Operational'],
      );
      expect(result).toBe('For Financial and Operational');
    });

    it('should replace {{categories}} with a comma-separated list', () => {
      const result = service.inject('Categories: {{categories}}', [
        'Financial',
        'Operational',
        'Reputational',
      ]);
      expect(result).toBe('Categories: Financial, Operational, Reputational');
    });

    it('should leave placeholder unchanged when index is out of range', () => {
      const result = service.inject('{{category_3}}', ['Financial', 'Operational']);
      expect(result).toBe('{{category_3}}');
    });

    it('should handle empty categories array', () => {
      const result = service.inject('Categories: {{categories}}', []);
      expect(result).toBe('Categories: ');
    });

    it('should handle text with no placeholders', () => {
      const result = service.inject('No variables here.', ['Financial']);
      expect(result).toBe('No variables here.');
    });

    it('should handle empty text', () => {
      const result = service.inject('', ['Financial']);
      expect(result).toBe('');
    });

    it('should replace both {{category_N}} and {{categories}} in same text', () => {
      const result = service.inject(
        'Primary: {{category_1}}. All: {{categories}}.',
        ['Financial', 'Operational'],
      );
      expect(result).toBe('Primary: Financial. All: Financial, Operational.');
    });

    it('should handle single category for {{categories}}', () => {
      const result = service.inject('{{categories}}', ['Environmental']);
      expect(result).toBe('Environmental');
    });

    it('should not modify missing placeholders (e.g., {{country}}) that are not categories', () => {
      const result = service.inject('Country: {{country}}', ['Financial']);
      expect(result).toBe('Country: {{country}}');
    });
  });

  describe('injectAll', () => {
    it('should inject into both systemPrompt and userPromptTemplate', () => {
      const prompt = {
        systemPrompt: 'Analyze {{category_1}}',
        userPromptTemplate: 'Focus on {{categories}}',
        name: 'Test',
      };

      const result = service.injectAll(prompt, ['Financial', 'Operational']);

      expect(result.systemPrompt).toBe('Analyze Financial');
      expect(result.userPromptTemplate).toBe('Focus on Financial, Operational');
      expect(result.name).toBe('Test'); // other fields preserved
    });

    it('should not mutate the original prompt object', () => {
      const prompt = {
        systemPrompt: 'Analyze {{category_1}}',
        userPromptTemplate: 'Focus on {{categories}}',
      };

      service.injectAll(prompt, ['Financial']);

      expect(prompt.systemPrompt).toBe('Analyze {{category_1}}');
      expect(prompt.userPromptTemplate).toBe('Focus on {{categories}}');
    });
  });
});
