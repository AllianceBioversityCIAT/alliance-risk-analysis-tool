import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { Prisma, PromptChangeType } from '@prisma/client';
import { AgentSection } from '@alliance-risk/shared';
import { PrismaService } from '../database/prisma.service';
import { CreatePromptDto } from './dto/create-prompt.dto';
import { UpdatePromptDto } from './dto/update-prompt.dto';
import { ListPromptsQueryDto } from './dto/list-prompts-query.dto';
import { BulkImportDto, ImportPromptItem } from './dto/bulk-import.dto';

// Full prompt include spec (latest version from Prompt table)
const PROMPT_INCLUDE = {
  createdBy: { select: { id: true, email: true } },
  updatedBy: { select: { id: true, email: true } },
} as const;

@Injectable()
export class PromptsService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Create ─────────────────────────────────────────────────────────────────

  async create(dto: CreatePromptDto, userId: string) {
    const isActive = dto.isActive ?? true;

    if (isActive) {
      await this.checkActiveConflict(
        dto.section,
        dto.route,
        dto.subSection,
        dto.categories ?? [],
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const prompt = await tx.prompt.create({
        data: {
          name: dto.name,
          section: dto.section,
          subSection: dto.subSection,
          route: dto.route,
          categories: dto.categories ?? [],
          tags: dto.tags ?? [],
          version: 1,
          isActive,
          systemPrompt: dto.systemPrompt,
          userPromptTemplate: dto.userPromptTemplate,
          tone: dto.tone ?? 'Professional and informative',
          outputFormat: dto.outputFormat ?? 'Clear and structured response',
          fewShot: dto.fewShot ? (dto.fewShot as unknown as Prisma.InputJsonValue) : undefined,
          context: dto.context ? (dto.context as unknown as Prisma.InputJsonValue) : undefined,
          createdById: userId,
          updatedById: userId,
        },
        include: PROMPT_INCLUDE,
      });

      await tx.promptChange.create({
        data: {
          promptId: prompt.id,
          version: 1,
          changeType: PromptChangeType.CREATE,
          changes: { created: true } as unknown as Prisma.InputJsonValue,
          authorId: userId,
        },
      });

      return prompt;
    });
  }

  // ─── Find One ───────────────────────────────────────────────────────────────

  async findOne(id: string, version?: number) {
    if (version !== undefined) {
      const snapshot = await this.prisma.promptVersion.findUnique({
        where: { promptId_version: { promptId: id, version } },
      });
      if (!snapshot) {
        throw new NotFoundException(`Prompt version ${version} not found`);
      }
      // Return snapshot shape with a few extra fields from latest
      const latest = await this.prisma.prompt.findUnique({
        where: { id },
        include: PROMPT_INCLUDE,
      });
      if (!latest) throw new NotFoundException(`Prompt not found`);
      return { ...snapshot, createdBy: latest.createdBy, updatedBy: latest.updatedBy };
    }

    const prompt = await this.prisma.prompt.findUnique({
      where: { id },
      include: PROMPT_INCLUDE,
    });

    if (!prompt) throw new NotFoundException(`Prompt not found`);
    return prompt;
  }

  // ─── Find All ───────────────────────────────────────────────────────────────

  async findAll(query: ListPromptsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.PromptWhereInput = {};

    if (query.section) where.section = query.section;
    if (query.route) where.route = query.route;
    if (query.isActive !== undefined) where.isActive = query.isActive;

    if (query.tag) {
      where.tags = { has: query.tag };
    }

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { route: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [prompts, total] = await Promise.all([
      this.prisma.prompt.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        include: PROMPT_INCLUDE,
      }),
      this.prisma.prompt.count({ where }),
    ]);

    return {
      prompts,
      total,
      page,
      limit,
      hasMore: skip + prompts.length < total,
    };
  }

  // ─── Update ─────────────────────────────────────────────────────────────────

  async update(id: string, dto: UpdatePromptDto, userId: string) {
    const current = await this.prisma.prompt.findUnique({
      where: { id },
      include: PROMPT_INCLUDE,
    });

    if (!current) throw new NotFoundException(`Prompt not found`);

    // If activating, check for conflicts
    if (dto.isActive === true && !current.isActive) {
      await this.checkActiveConflict(
        (dto.section ?? current.section) as AgentSection,
        dto.route ?? current.route ?? undefined,
        dto.subSection ?? current.subSection ?? undefined,
        dto.categories ?? current.categories,
        id,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // Step 1: Snapshot current state to PromptVersion
      await tx.promptVersion.create({
        data: {
          promptId: current.id,
          version: current.version,
          name: current.name,
          section: current.section,
          subSection: current.subSection,
          route: current.route,
          categories: current.categories,
          tags: current.tags,
          isActive: current.isActive,
          systemPrompt: current.systemPrompt,
          userPromptTemplate: current.userPromptTemplate,
          tone: current.tone,
          outputFormat: current.outputFormat,
          fewShot: current.fewShot ?? undefined,
          context: current.context ?? undefined,
        },
      });

      const newVersion = current.version + 1;

      // Step 2: Update Prompt in place + increment version
      const updated = await tx.prompt.update({
        where: { id },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.section !== undefined && { section: dto.section }),
          ...(dto.subSection !== undefined && { subSection: dto.subSection }),
          ...(dto.route !== undefined && { route: dto.route }),
          ...(dto.categories !== undefined && { categories: dto.categories }),
          ...(dto.tags !== undefined && { tags: dto.tags }),
          ...(dto.systemPrompt !== undefined && { systemPrompt: dto.systemPrompt }),
          ...(dto.userPromptTemplate !== undefined && {
            userPromptTemplate: dto.userPromptTemplate,
          }),
          ...(dto.tone !== undefined && { tone: dto.tone }),
          ...(dto.outputFormat !== undefined && { outputFormat: dto.outputFormat }),
          ...(dto.fewShot !== undefined && {
            fewShot: dto.fewShot as unknown as Prisma.InputJsonValue,
          }),
          ...(dto.context !== undefined && {
            context: dto.context as unknown as Prisma.InputJsonValue,
          }),
          ...(dto.isActive !== undefined && { isActive: dto.isActive }),
          version: newVersion,
          updatedById: userId,
        },
        include: PROMPT_INCLUDE,
      });

      // Step 3: Record change with diff
      const diff = this.computeDiff(current, updated);
      await tx.promptChange.create({
        data: {
          promptId: id,
          version: newVersion,
          changeType: PromptChangeType.UPDATE,
          changes: diff as unknown as Prisma.InputJsonValue,
          authorId: userId,
        },
      });

      return updated;
    });
  }

  // ─── Delete ─────────────────────────────────────────────────────────────────

  async delete(id: string, userId: string, version?: number) {
    const prompt = await this.prisma.prompt.findUnique({
      where: { id },
      include: PROMPT_INCLUDE,
    });

    if (!prompt) throw new NotFoundException(`Prompt not found`);

    if (version !== undefined) {
      // Delete only a specific historical version
      const snapshot = await this.prisma.promptVersion.findUnique({
        where: { promptId_version: { promptId: id, version } },
      });
      if (!snapshot) throw new NotFoundException(`Prompt version ${version} not found`);

      await this.prisma.$transaction(async (tx) => {
        await tx.promptChange.create({
          data: {
            promptId: id,
            version: prompt.version,
            changeType: PromptChangeType.DELETE,
            changes: { deletedVersion: version } as unknown as Prisma.InputJsonValue,
            authorId: userId,
          },
        });
        await tx.promptVersion.delete({
          where: { promptId_version: { promptId: id, version } },
        });
      });
    } else {
      // Delete entire prompt (cascades to versions, comments, changes)
      await this.prisma.$transaction(async (tx) => {
        await tx.promptChange.create({
          data: {
            promptId: id,
            version: prompt.version,
            changeType: PromptChangeType.DELETE,
            changes: { deletedAll: true, name: prompt.name } as unknown as Prisma.InputJsonValue,
            authorId: userId,
          },
        });
        await tx.prompt.delete({ where: { id } });
      });
    }
  }

  // ─── Toggle Active ───────────────────────────────────────────────────────────

  async toggleActive(id: string, userId: string) {
    const prompt = await this.prisma.prompt.findUnique({ where: { id } });
    if (!prompt) throw new NotFoundException(`Prompt not found`);

    const newActive = !prompt.isActive;

    // If activating, check for conflicts
    if (newActive) {
      await this.checkActiveConflict(
        prompt.section as unknown as AgentSection,
        prompt.route ?? undefined,
        prompt.subSection ?? undefined,
        prompt.categories,
        id,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.prompt.update({
        where: { id },
        data: {
          isActive: newActive,
          version: prompt.version + 1,
          updatedById: userId,
        },
        include: PROMPT_INCLUDE,
      });

      // Snapshot old state
      await tx.promptVersion.create({
        data: {
          promptId: prompt.id,
          version: prompt.version,
          name: prompt.name,
          section: prompt.section,
          subSection: prompt.subSection,
          route: prompt.route,
          categories: prompt.categories,
          tags: prompt.tags,
          isActive: prompt.isActive,
          systemPrompt: prompt.systemPrompt,
          userPromptTemplate: prompt.userPromptTemplate,
          tone: prompt.tone,
          outputFormat: prompt.outputFormat,
          fewShot: prompt.fewShot ?? undefined,
          context: prompt.context ?? undefined,
        },
      });

      await tx.promptChange.create({
        data: {
          promptId: id,
          version: updated.version,
          changeType: newActive ? PromptChangeType.ACTIVATE : PromptChangeType.DEACTIVATE,
          changes: {
            isActive: { old: prompt.isActive, new: newActive },
          } as unknown as Prisma.InputJsonValue,
          authorId: userId,
        },
      });

      return updated;
    });
  }

  // ─── Export ─────────────────────────────────────────────────────────────────

  async exportAll() {
    return this.prisma.prompt.findMany({
      orderBy: { updatedAt: 'desc' },
      include: PROMPT_INCLUDE,
    });
  }

  // ─── Import ─────────────────────────────────────────────────────────────────

  async importBulk(
    dto: BulkImportDto,
    userId: string,
  ): Promise<{ created: number; updated: number; errors: Array<{ index: number; name: string; error: string }> }> {
    let created = 0;
    let updated = 0;
    const errors: Array<{ index: number; name: string; error: string }> = [];

    await this.prisma.$transaction(async (tx) => {
      for (let i = 0; i < dto.prompts.length; i++) {
        const item = dto.prompts[i];
        try {
          if (dto.mode === 'upsert') {
            // Try to find existing prompt by name + section
            const existing = await tx.prompt.findFirst({
              where: { name: item.name, section: item.section },
            });

            if (existing) {
              await tx.prompt.update({
                where: { id: existing.id },
                data: {
                  subSection: item.subSection ?? existing.subSection,
                  route: item.route ?? existing.route,
                  categories: item.categories ?? existing.categories,
                  tags: item.tags ?? existing.tags,
                  systemPrompt: item.systemPrompt,
                  userPromptTemplate: item.userPromptTemplate,
                  tone: item.tone ?? existing.tone,
                  outputFormat: item.outputFormat ?? existing.outputFormat,
                  fewShot: item.fewShot
                    ? (item.fewShot as unknown as Prisma.InputJsonValue)
                    : existing.fewShot ?? undefined,
                  context: item.context
                    ? (item.context as unknown as Prisma.InputJsonValue)
                    : existing.context ?? undefined,
                  isActive: item.isActive ?? existing.isActive,
                  version: existing.version + 1,
                  updatedById: userId,
                },
              });
              updated++;
              continue;
            }
          }

          // Create new
          await tx.prompt.create({
            data: {
              name: item.name,
              section: item.section,
              subSection: item.subSection,
              route: item.route,
              categories: item.categories ?? [],
              tags: item.tags ?? [],
              version: 1,
              isActive: item.isActive ?? false,
              systemPrompt: item.systemPrompt,
              userPromptTemplate: item.userPromptTemplate,
              tone: item.tone ?? 'Professional and informative',
              outputFormat: item.outputFormat ?? 'Clear and structured response',
              fewShot: item.fewShot
                ? (item.fewShot as unknown as Prisma.InputJsonValue)
                : undefined,
              context: item.context
                ? (item.context as unknown as Prisma.InputJsonValue)
                : undefined,
              createdById: userId,
              updatedById: userId,
            },
          });
          created++;
        } catch (err) {
          errors.push({
            index: i,
            name: item.name,
            error: err instanceof Error ? err.message : 'Unknown error',
          });
        }
      }
    });

    return { created, updated, errors };
  }

  // ─── Conflict Detection ──────────────────────────────────────────────────────

  async checkActiveConflict(
    section: AgentSection,
    route?: string | null,
    subSection?: string | null,
    categories?: string[],
    excludeId?: string,
  ): Promise<void> {
    const where: Prisma.PromptWhereInput = {
      section,
      isActive: true,
    };

    if (route !== undefined && route !== null) where.route = route;
    if (subSection !== undefined && subSection !== null) where.subSection = subSection;
    if (excludeId) where.id = { not: excludeId };

    if (categories && categories.length > 0) {
      // Check for overlapping categories (any category in the new set is already covered)
      where.categories = { hasSome: categories };
    }

    const conflict = await this.prisma.prompt.findFirst({ where });

    if (conflict) {
      throw new ConflictException(
        `An active prompt for section "${section}" with the same route/categories already exists (id: ${conflict.id})`,
      );
    }
  }

  // ─── Internal: Compute Diff ─────────────────────────────────────────────────

  private computeDiff(
    oldData: Record<string, unknown>,
    newData: Record<string, unknown>,
  ): Record<string, { old: unknown; new: unknown }> {
    const diff: Record<string, { old: unknown; new: unknown }> = {};
    const fields = [
      'name',
      'section',
      'subSection',
      'route',
      'categories',
      'tags',
      'systemPrompt',
      'userPromptTemplate',
      'tone',
      'outputFormat',
      'fewShot',
      'context',
      'isActive',
    ];

    for (const field of fields) {
      const oldVal = oldData[field];
      const newVal = newData[field];
      if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
        diff[field] = { old: oldVal, new: newVal };
      }
    }

    return diff;
  }
}
