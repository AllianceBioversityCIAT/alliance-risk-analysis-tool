import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { CommentsService, CreateCommentDto } from './comments.service';
import { PrismaService } from '../database/prisma.service';

const USER_ID = 'user-123';
const PROMPT_ID = 'prompt-1';

const mockTx = {
  promptComment: { create: jest.fn() },
  prompt: { update: jest.fn() },
};

const mockPrisma = {
  prompt: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  promptComment: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  $transaction: jest.fn((fn: (tx: typeof mockTx) => unknown) => fn(mockTx)),
};

const baseComment = {
  id: 'comment-1',
  promptId: PROMPT_ID,
  parentId: null,
  content: 'Test comment',
  authorId: USER_ID,
  createdAt: new Date(),
  updatedAt: new Date(),
  author: { id: USER_ID, email: 'admin@test.com' },
};

const basePrompt = { id: PROMPT_ID, commentsCount: 0 };

describe('CommentsService', () => {
  let service: CommentsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommentsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<CommentsService>(CommentsService);
  });

  describe('addComment', () => {
    it('should create a comment and increment count', async () => {
      mockPrisma.prompt.findUnique.mockResolvedValueOnce(basePrompt);
      mockTx.promptComment.create.mockResolvedValueOnce(baseComment);
      mockTx.prompt.update.mockResolvedValueOnce({});

      const dto: CreateCommentDto = { content: 'Test comment' };
      const result = await service.addComment(PROMPT_ID, dto, USER_ID);

      expect(mockTx.promptComment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            promptId: PROMPT_ID,
            content: 'Test comment',
            authorId: USER_ID,
          }),
        }),
      );
      expect(mockTx.prompt.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { commentsCount: { increment: 1 } },
        }),
      );
      expect(result).toEqual(baseComment);
    });

    it('should create a reply with parentId', async () => {
      const parentComment = { ...baseComment, promptId: PROMPT_ID };
      mockPrisma.prompt.findUnique.mockResolvedValueOnce(basePrompt);
      mockPrisma.promptComment.findUnique.mockResolvedValueOnce(parentComment);
      mockTx.promptComment.create.mockResolvedValueOnce({ ...baseComment, parentId: 'comment-1' });
      mockTx.prompt.update.mockResolvedValueOnce({});

      const dto: CreateCommentDto = { content: 'Reply', parentId: 'comment-1' };
      await service.addComment(PROMPT_ID, dto, USER_ID);

      expect(mockTx.promptComment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ parentId: 'comment-1' }),
        }),
      );
    });

    it('should throw NotFoundException when prompt does not exist', async () => {
      mockPrisma.prompt.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.addComment(PROMPT_ID, { content: 'Test' }, USER_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when parent comment does not exist', async () => {
      mockPrisma.prompt.findUnique.mockResolvedValueOnce(basePrompt);
      mockPrisma.promptComment.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.addComment(PROMPT_ID, { content: 'Reply', parentId: 'nonexistent' }, USER_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when parent belongs to a different prompt', async () => {
      mockPrisma.prompt.findUnique.mockResolvedValueOnce(basePrompt);
      mockPrisma.promptComment.findUnique.mockResolvedValueOnce({
        ...baseComment,
        promptId: 'other-prompt',
      });

      await expect(
        service.addComment(PROMPT_ID, { content: 'Reply', parentId: 'comment-1' }, USER_ID),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getComments', () => {
    it('should return threaded comments (parent + replies)', async () => {
      const reply = { ...baseComment, id: 'comment-2', parentId: 'comment-1' };
      mockPrisma.prompt.findUnique.mockResolvedValueOnce(basePrompt);
      mockPrisma.promptComment.findMany.mockResolvedValueOnce([baseComment, reply]);

      const result = await service.getComments(PROMPT_ID);

      expect(result).toHaveLength(1); // 1 top-level comment
      expect(result[0].replies).toHaveLength(1); // 1 reply
      expect(result[0].id).toBe('comment-1');
      expect(result[0].replies[0].id).toBe('comment-2');
    });

    it('should return empty array when no comments exist', async () => {
      mockPrisma.prompt.findUnique.mockResolvedValueOnce(basePrompt);
      mockPrisma.promptComment.findMany.mockResolvedValueOnce([]);

      const result = await service.getComments(PROMPT_ID);

      expect(result).toHaveLength(0);
    });

    it('should throw NotFoundException when prompt does not exist', async () => {
      mockPrisma.prompt.findUnique.mockResolvedValueOnce(null);

      await expect(service.getComments(PROMPT_ID)).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateCommentsCount', () => {
    it('should recalculate and update the comments count', async () => {
      mockPrisma.promptComment.count.mockResolvedValueOnce(5);
      mockPrisma.prompt.update.mockResolvedValueOnce({});

      const count = await service.updateCommentsCount(PROMPT_ID);

      expect(mockPrisma.promptComment.count).toHaveBeenCalledWith({ where: { promptId: PROMPT_ID } });
      expect(mockPrisma.prompt.update).toHaveBeenCalledWith({
        where: { id: PROMPT_ID },
        data: { commentsCount: 5 },
      });
      expect(count).toBe(5);
    });
  });
});
