import { Injectable, Logger } from '@nestjs/common';

/** @akili-spec enhancements/multi-country-enablement */
export function injectCountry(text: string, country: string): string {
  if (!text) return text;
  return text.replace(/\{\{country\}\}/g, country);
}

export function warnIfHardcodedKenyaWithoutPlaceholder(
  logger: Pick<Logger, 'warn'>,
  country: string,
  ...texts: string[]
): void {
  if (country === 'Kenya') return;
  for (const text of texts) {
    if (text.includes('Kenya') && !text.includes('{{country}}')) {
      logger.warn(
        `Prompt contains hardcoded "Kenya" but assessment country is "${country}" and {{country}} placeholder is absent`,
      );
      return;
    }
  }
}

@Injectable()
export class VariableInjectionService {
  /**
   * Injects category variables into a text template.
   *
   * Replacements:
   * - `{{category_N}}` → categories[N-1] (1-indexed)
   * - `{{categories}}` → comma-separated list of all categories
   *
   * If a placeholder index is out of range, it remains unchanged.
   */
  inject(text: string, categories: string[]): string {
    if (!text) return text;

    let result = text;

    // Replace {{category_N}} with individual values
    result = result.replace(/\{\{category_(\d+)\}\}/g, (_match, indexStr: string) => {
      const idx = parseInt(indexStr, 10) - 1; // 1-indexed → 0-indexed
      if (idx >= 0 && idx < categories.length) {
        return categories[idx];
      }
      return _match; // Leave unchanged if out of range
    });

    // Replace {{categories}} with comma-separated list
    result = result.replace(/\{\{categories\}\}/g, categories.join(', '));

    return result;
  }

  injectCountry(text: string, country: string): string {
    return injectCountry(text, country);
  }

  /**
   * Injects variables into both systemPrompt and userPromptTemplate of a prompt object.
   * Returns a new object with replaced values (does not mutate input).
   * When country is provided, also replaces {{country}} in both prompts.
   */
  injectAll<T extends { systemPrompt: string; userPromptTemplate: string }>(
    prompt: T,
    categories: string[],
    country?: string,
  ): T {
    const withCategories = {
      ...prompt,
      systemPrompt: this.inject(prompt.systemPrompt, categories),
      userPromptTemplate: this.inject(prompt.userPromptTemplate, categories),
    };

    if (!country) {
      return withCategories;
    }

    return {
      ...withCategories,
      systemPrompt: injectCountry(withCategories.systemPrompt, country),
      userPromptTemplate: injectCountry(withCategories.userPromptTemplate, country),
    };
  }
}
