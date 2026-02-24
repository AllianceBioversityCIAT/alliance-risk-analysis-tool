import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { IsString, IsOptional, MaxLength } from 'class-validator';
import { PrismaService } from '../database/prisma.service';

export class CreateCommentDto {
  @IsString()
  @MaxLength(1000)
  content!: string;

  @IsOptional()
  @IsString()
  parentId?: string;
}

@Injectable()
export class CommentsService {
  constructor(private readonly prisma: PrismaService) {}

  async addComment(promptId: string, dto: CreateCommentDto, userId: string) {
    // Verify prompt exists
    const prompt = await this.prisma.prompt.findUnique({ where: { id: promptId } });
    if (!prompt) throw new NotFoundException(`Prompt not found`);

    // Verify parent comment exists if parentId provided
    if (dto.parentId) {
      const parent = await this.prisma.promptComment.findUnique({
        where: { id: dto.parentId },
      });
      if (!parent) throw new NotFoundException(`Parent comment not found`);
      if (parent.promptId !== promptId) {
        throw new ForbiddenException(`Parent comment does not belong to this prompt`);
      }
    }

    const comment = await this.prisma.$transaction(async (tx) => {
      const created = await tx.promptComment.create({
        data: {
          promptId,
          parentId: dto.parentId,
          content: dto.content,
          authorId: userId,
        },
        include: {
          author: { select: { id: true, email: true } },
        },
      });

      // Update denormalized count
      await tx.prompt.update({
        where: { id: promptId },
        data: { commentsCount: { increment: 1 } },
      });

      return created;
    });

    return comment;
  }

  async getComments(promptId: string) {
    // Verify prompt exists
    const prompt = await this.prisma.prompt.findUnique({ where: { id: promptId } });
    if (!prompt) throw new NotFoundException(`Prompt not found`);

    // Fetch all comments for the prompt
    const all = await this.prisma.promptComment.findMany({
      where: { promptId },
      include: {
        author: { select: { id: true, email: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Build threaded structure: top-level comments + their replies
    const topLevel = all.filter((c) => !c.parentId);
    return topLevel.map((parent) => ({
      ...parent,
      replies: all.filter((c) => c.parentId === parent.id),
    }));
  }

  async updateCommentsCount(promptId: string) {
    const count = await this.prisma.promptComment.count({ where: { promptId } });
    await this.prisma.prompt.update({
      where: { id: promptId },
      data: { commentsCount: count },
    });
    return count;
  }
}
