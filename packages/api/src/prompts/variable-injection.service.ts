import { Injectable } from '@nestjs/common';

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

  /**
   * Injects variables into both systemPrompt and userPromptTemplate of a prompt object.
   * Returns a new object with replaced values (does not mutate input).
   */
  injectAll<T extends { systemPrompt: string; userPromptTemplate: string }>(
    prompt: T,
    categories: string[],
  ): T {
    return {
      ...prompt,
      systemPrompt: this.inject(prompt.systemPrompt, categories),
      userPromptTemplate: this.inject(prompt.userPromptTemplate, categories),
    };
  }
}
