import { Injectable } from '@nestjs/common';
import { PromptChangeType } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

export interface DiffResult {
  [field: string]: { old: unknown; new: unknown };
}

@Injectable()
export class ChangeHistoryService {
  constructor(private readonly prisma: PrismaService) {}

  async recordChange(
    promptId: string,
    version: number,
    type: PromptChangeType,
    changes: DiffResult,
    userId: string,
    comment?: string,
  ) {
    return this.prisma.promptChange.create({
      data: {
        promptId,
        version,
        changeType: type,
        changes: changes as object,
        comment,
        authorId: userId,
      },
      include: {
        author: { select: { id: true, email: true } },
      },
    });
  }

  async getHistory(promptId: string) {
    return this.prisma.promptChange.findMany({
      where: { promptId },
      include: {
        author: { select: { id: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  computeDiff(
    oldData: Record<string, unknown>,
    newData: Record<string, unknown>,
    fields?: string[],
  ): DiffResult {
    const trackedFields = fields ?? [
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

    const diff: DiffResult = {};
    for (const field of trackedFields) {
      const oldVal = oldData[field];
      const newVal = newData[field];
      if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
        diff[field] = { old: oldVal, new: newVal };
      }
    }
    return diff;
  }
}
