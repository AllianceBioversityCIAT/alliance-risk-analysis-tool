import { Test, TestingModule } from '@nestjs/testing';
import { PromptChangeType } from '@prisma/client';
import { ChangeHistoryService } from './change-history.service';
import { PrismaService } from '../database/prisma.service';

const USER_ID = 'user-123';
const PROMPT_ID = 'prompt-1';

const mockPrisma = {
  promptChange: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
};

describe('ChangeHistoryService', () => {
  let service: ChangeHistoryService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChangeHistoryService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ChangeHistoryService>(ChangeHistoryService);
  });

  describe('recordChange', () => {
    it('should create a PromptChange record', async () => {
      const changes = { name: { old: 'Old', new: 'New' } };
      mockPrisma.promptChange.create.mockResolvedValueOnce({ id: 'change-1' });

      await service.recordChange(PROMPT_ID, 2, PromptChangeType.UPDATE, changes, USER_ID);

      expect(mockPrisma.promptChange.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            promptId: PROMPT_ID,
            version: 2,
            changeType: PromptChangeType.UPDATE,
            changes,
            authorId: USER_ID,
          }),
        }),
      );
    });

    it('should include optional comment when provided', async () => {
      mockPrisma.promptChange.create.mockResolvedValueOnce({});

      await service.recordChange(
        PROMPT_ID,
        1,
        PromptChangeType.CREATE,
        {},
        USER_ID,
        'Initial creation',
      );

      expect(mockPrisma.promptChange.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ comment: 'Initial creation' }),
        }),
      );
    });
  });

  describe('getHistory', () => {
    it('should return changes in reverse chronological order', async () => {
      const changes = [
        { id: 'change-2', createdAt: new Date('2025-02-01'), version: 2 },
        { id: 'change-1', createdAt: new Date('2025-01-01'), version: 1 },
      ];
      mockPrisma.promptChange.findMany.mockResolvedValueOnce(changes);

      const result = await service.getHistory(PROMPT_ID);

      expect(mockPrisma.promptChange.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { promptId: PROMPT_ID },
          orderBy: { createdAt: 'desc' },
        }),
      );
      expect(result[0].id).toBe('change-2');
    });
  });

  describe('computeDiff', () => {
    it('should detect changed fields', () => {
      const oldData = { name: 'Old Name', systemPrompt: 'Old prompt', isActive: true };
      const newData = { name: 'New Name', systemPrompt: 'Old prompt', isActive: true };

      const diff = service.computeDiff(oldData, newData);

      expect(diff).toHaveProperty('name');
      expect(diff.name.old).toBe('Old Name');
      expect(diff.name.new).toBe('New Name');
      expect(diff).not.toHaveProperty('systemPrompt');
    });

    it('should return empty diff when nothing changed', () => {
      const data = { name: 'Same', systemPrompt: 'Same', isActive: true };
      const diff = service.computeDiff(data, { ...data });

      expect(Object.keys(diff)).toHaveLength(0);
    });

    it('should detect array changes (categories)', () => {
      const oldData = { categories: ['cat1'] };
      const newData = { categories: ['cat1', 'cat2'] };

      const diff = service.computeDiff(oldData, newData, ['categories']);

      expect(diff).toHaveProperty('categories');
      expect(diff.categories.old).toEqual(['cat1']);
      expect(diff.categories.new).toEqual(['cat1', 'cat2']);
    });

    it('should use custom fields list when provided', () => {
      const oldData = { name: 'Old', systemPrompt: 'Old prompt' };
      const newData = { name: 'New', systemPrompt: 'New prompt' };

      const diff = service.computeDiff(oldData, newData, ['name']);

      expect(diff).toHaveProperty('name');
      expect(diff).not.toHaveProperty('systemPrompt');
    });
  });
});
