import { Controller, Get, Param, Query, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { PromptsService } from './prompts.service';
import { VariableInjectionService } from './variable-injection.service';
import { AgentSection } from '@alliance-risk/shared';

@ApiTags('Prompts (Runtime)')
@Controller('prompts')
export class PromptsRuntimeController {
  constructor(
    private readonly promptsService: PromptsService,
    private readonly variableInjectionService: VariableInjectionService,
  ) {}

  // GET /api/prompts/section/:section  (public — used by Bedrock agents)
  @Public()
  @Get('section/:section')
  @ApiOperation({
    summary: 'Get active prompt by section',
    description: 'Returns the currently active prompt for a given agent section. This endpoint is public and used internally by AWS Bedrock agents. Optionally injects category variables ({{category_1}}, {{category_2}}, etc.) into the prompt template.',
  })
  @ApiParam({ name: 'section', description: 'Agent section identifier (must be a valid AgentSection enum value)', example: 'gap_detection' })
  @ApiQuery({ name: 'categories', required: false, type: String, description: 'Comma-separated list of risk category names to inject into the prompt template via variable substitution', example: 'Market Risk,Credit Risk,Operational Risk' })
  @ApiResponse({ status: 200, description: 'Active prompt returned with optional variable injection applied' })
  @ApiResponse({ status: 404, description: 'Unknown section name, or no active prompt found for this section' })
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
