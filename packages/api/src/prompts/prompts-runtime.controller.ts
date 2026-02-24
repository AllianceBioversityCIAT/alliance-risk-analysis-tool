import { Controller, Get, Param, Query, NotFoundException } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { PromptsService } from './prompts.service';
import { VariableInjectionService } from './variable-injection.service';
import { AgentSection } from '@alliance-risk/shared';

@Controller('prompts')
export class PromptsRuntimeController {
  constructor(
    private readonly promptsService: PromptsService,
    private readonly variableInjectionService: VariableInjectionService,
  ) {}

  // GET /api/prompts/section/:section  (public — used by Bedrock agents)
  @Public()
  @Get('section/:section')
  async getActiveBySection(
    @Param('section') section: string,
    @Query('categories') categoriesParam?: string,
  ) {
    // Validate section is a valid AgentSection value
    const validSections = Object.values(AgentSection) as string[];
    if (!validSections.includes(section)) {
      throw new NotFoundException(`Unknown agent section: ${section}`);
    }

    // findAll with section + isActive=true, get first result
    const result = await this.promptsService.findAll({
      section: section as AgentSection,
      isActive: true,
      page: 1,
      limit: 1,
    });

    if (result.prompts.length === 0) {
      throw new NotFoundException(`No active prompt found for section: ${section}`);
    }

    const prompt = result.prompts[0];

    // Apply variable injection if categories provided
    if (categoriesParam) {
      const categories = categoriesParam
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean);

      const injected = this.variableInjectionService.injectAll(
        prompt as unknown as { systemPrompt: string; userPromptTemplate: string },
        categories,
      );

      return {
        data: {
          ...prompt,
          systemPrompt: injected.systemPrompt,
          userPromptTemplate: injected.userPromptTemplate,
        },
      };
    }

    return { data: prompt };
  }
}
