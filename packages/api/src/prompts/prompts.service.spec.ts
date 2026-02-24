import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { PromptChangeType } from '@prisma/client';
import { AgentSection } from '@alliance-risk/shared';
import { PromptsService } from './prompts.service';
import { PrismaService } from '../database/prisma.service';
import { CreatePromptDto } from './dto/create-prompt.dto';
import { UpdatePromptDto } from './dto/update-prompt.dto';
import { ListPromptsQueryDto } from './dto/list-prompts-query.dto';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockTx = {
  prompt: {
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  promptVersion: {
    create: jest.fn(),
    delete: jest.fn(),
  },
  promptChange: {
    create: jest.fn(),
  },
};

const mockPrisma = {
  prompt: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  promptVersion: {
    findUnique: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  },
  promptChange: {
    create: jest.fn(),
  },
  $transaction: jest.fn((fn: (tx: typeof mockTx) => unknown) => fn(mockTx)),
};

// ─── Fixtures ────────────────────────────────────────────────────────────────

const USER_ID = 'user-123';

const basePrompt = {
  id: 'prompt-1',
  name: 'Test Prompt',
  section: AgentSection.PARSER,
  subSection: null,
  route: '/test',
  categories: ['cat1'],
  tags: ['tag1'],
  version: 1,
  isActive: true,
  systemPrompt: 'System prompt text',
  userPromptTemplate: 'User prompt {{category_1}}',
  tone: 'Professional',
  outputFormat: 'Clear format',
  fewShot: null,
  context: null,
  commentsCount: 0,
  createdById: USER_ID,
  updatedById: USER_ID,
  createdAt: new Date(),
  updatedAt: new Date(),
  createdBy: { id: USER_ID, email: 'admin@test.com' },
  updatedBy: { id: USER_ID, email: 'admin@test.com' },
};

const createDto: CreatePromptDto = {
  name: 'Test Prompt',
  section: AgentSection.PARSER,
  route: '/test',
  categories: ['cat1'],
  tags: ['tag1'],
  systemPrompt: 'System prompt text',
  userPromptTemplate: 'User prompt {{category_1}}',
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('PromptsService', () => {
  let service: PromptsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PromptsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<PromptsService>(PromptsService);
  });

  // ─── create ─────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('should create a prompt with version 1 and record CREATE change', async () => {
      mockPrisma.prompt.findFirst.mockResolvedValueOnce(null); // no conflict
      mockTx.prompt.create.mockResolvedValueOnce(basePrompt);
      mockTx.promptChange.create.mockResolvedValueOnce({});

      const result = await service.create(createDto, USER_ID);

      expect(mockTx.prompt.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ version: 1, isActive: true }),
        }),
      );
      expect(mockTx.promptChange.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ changeType: PromptChangeType.CREATE }),
        }),
      );
      expect(result).toEqual(basePrompt);
    });

    it('should create a prompt with isActive=false when explicitly set', async () => {
      const dto = { ...createDto, isActive: false };
      mockTx.prompt.create.mockResolvedValueOnce({ ...basePrompt, isActive: false });
      mockTx.promptChange.create.mockResolvedValueOnce({});

      await service.create(dto, USER_ID);

      // No conflict check when isActive=false
      expect(mockPrisma.prompt.findFirst).not.toHaveBeenCalled();
      expect(mockTx.prompt.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isActive: false }),
        }),
      );
    });

    it('should throw ConflictException if an active prompt exists for same section+route+categories', async () => {
      mockPrisma.prompt.findFirst.mockResolvedValueOnce(basePrompt); // conflict found

      await expect(service.create(createDto, USER_ID)).rejects.toThrow(ConflictException);
    });
  });

  // ─── findOne ────────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('should return the latest version of a prompt', async () => {
      mockPrisma.prompt.findUnique.mockResolvedValueOnce(basePrompt);

      const result = await service.findOne('prompt-1');

      expect(mockPrisma.prompt.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'prompt-1' } }),
      );
      expect(result).toEqual(basePrompt);
    });

    it('should return a specific version from PromptVersion', async () => {
      const snapshot = { ...basePrompt, version: 1 };
      mockPrisma.promptVersion.findUnique.mockResolvedValueOnce(snapshot);
      mockPrisma.prompt.findUnique.mockResolvedValueOnce(basePrompt);

      const result = await service.findOne('prompt-1', 1);

      expect(mockPrisma.promptVersion.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { promptId_version: { promptId: 'prompt-1', version: 1 } },
        }),
      );
      expect(result).toMatchObject({ version: 1 });
    });

    it('should throw NotFoundException when prompt does not exist', async () => {
      mockPrisma.prompt.findUnique.mockResolvedValueOnce(null);

      await expect(service.findOne('nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when specific version does not exist', async () => {
      mockPrisma.promptVersion.findUnique.mockResolvedValueOnce(null);

      await expect(service.findOne('prompt-1', 99)).rejects.toThrow(NotFoundException);
    });
  });

  // ─── findAll ────────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('should return paginated prompts with total count', async () => {
      mockPrisma.prompt.findMany.mockResolvedValueOnce([basePrompt]);
      mockPrisma.prompt.count.mockResolvedValueOnce(1);

      const query: ListPromptsQueryDto = { page: 1, limit: 20 };
      const result = await service.findAll(query);

      expect(result.prompts).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.hasMore).toBe(false);
    });

    it('should filter by section', async () => {
      mockPrisma.prompt.findMany.mockResolvedValueOnce([basePrompt]);
      mockPrisma.prompt.count.mockResolvedValueOnce(1);

      await service.findAll({ section: AgentSection.PARSER, page: 1, limit: 20 });

      expect(mockPrisma.prompt.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ section: AgentSection.PARSER }),
        }),
      );
    });

    it('should filter by isActive', async () => {
      mockPrisma.prompt.findMany.mockResolvedValueOnce([basePrompt]);
      mockPrisma.prompt.count.mockResolvedValueOnce(1);

      await service.findAll({ isActive: true, page: 1, limit: 20 });

      expect(mockPrisma.prompt.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isActive: true }),
        }),
      );
    });

    it('should search by name', async () => {
      mockPrisma.prompt.findMany.mockResolvedValueOnce([basePrompt]);
      mockPrisma.prompt.count.mockResolvedValueOnce(1);

      await service.findAll({ search: 'Test', page: 1, limit: 20 });

      expect(mockPrisma.prompt.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ OR: expect.any(Array) }),
        }),
      );
    });

    it('should compute hasMore correctly for multi-page results', async () => {
      const prompts = Array(20).fill(basePrompt);
      mockPrisma.prompt.findMany.mockResolvedValueOnce(prompts);
      mockPrisma.prompt.count.mockResolvedValueOnce(50);

      const result = await service.findAll({ page: 1, limit: 20 });

      expect(result.hasMore).toBe(true);
    });
  });

  // ─── update ─────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('should snapshot to PromptVersion, update in place, and increment version', async () => {
      const updatedPrompt = { ...basePrompt, version: 2, name: 'Updated Name' };
      mockPrisma.prompt.findUnique.mockResolvedValueOnce(basePrompt);
      mockTx.promptVersion.create.mockResolvedValueOnce({});
      mockTx.prompt.update.mockResolvedValueOnce(updatedPrompt);
      mockTx.promptChange.create.mockResolvedValueOnce({});

      const dto: UpdatePromptDto = { name: 'Updated Name' };
      const result = await service.update('prompt-1', dto, USER_ID);

      expect(mockTx.promptVersion.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ version: 1, promptId: 'prompt-1' }),
        }),
      );
      expect(mockTx.prompt.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ version: 2, name: 'Updated Name' }),
        }),
      );
      expect(mockTx.promptChange.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ changeType: PromptChangeType.UPDATE }),
        }),
      );
      expect(result.version).toBe(2);
    });

    it('should compute diff with changed fields', async () => {
      const updatedPrompt = { ...basePrompt, version: 2, name: 'New Name' };
      mockPrisma.prompt.findUnique.mockResolvedValueOnce(basePrompt);
      mockTx.promptVersion.create.mockResolvedValueOnce({});
      mockTx.prompt.update.mockResolvedValueOnce(updatedPrompt);
      mockTx.promptChange.create.mockResolvedValueOnce({});

      await service.update('prompt-1', { name: 'New Name' }, USER_ID);

      const changeCall = mockTx.promptChange.create.mock.calls[0][0];
      expect(changeCall.data.changes).toHaveProperty('name');
      expect(changeCall.data.changes.name.old).toBe('Test Prompt');
      expect(changeCall.data.changes.name.new).toBe('New Name');
    });

    it('should throw NotFoundException when prompt does not exist', async () => {
      mockPrisma.prompt.findUnique.mockResolvedValueOnce(null);

      await expect(service.update('nonexistent', {}, USER_ID)).rejects.toThrow(NotFoundException);
    });

    it('should check for conflict when activating an inactive prompt', async () => {
      const inactivePrompt = { ...basePrompt, isActive: false };
      mockPrisma.prompt.findUnique.mockResolvedValueOnce(inactivePrompt);
      mockPrisma.prompt.findFirst.mockResolvedValueOnce(basePrompt); // conflict

      await expect(
        service.update('prompt-1', { isActive: true }, USER_ID),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ─── delete ─────────────────────────────────────────────────────────────────

  describe('delete', () => {
    it('should delete entire prompt with all cascades', async () => {
      mockPrisma.prompt.findUnique.mockResolvedValueOnce(basePrompt);
      mockTx.promptChange.create.mockResolvedValueOnce({});
      mockTx.prompt.delete.mockResolvedValueOnce({});

      await service.delete('prompt-1', USER_ID);

      expect(mockTx.prompt.delete).toHaveBeenCalledWith({ where: { id: 'prompt-1' } });
    });

    it('should delete only a specific version', async () => {
      const snapshot = { version: 1, promptId: 'prompt-1' };
      mockPrisma.prompt.findUnique.mockResolvedValueOnce(basePrompt);
      mockPrisma.promptVersion.findUnique.mockResolvedValueOnce(snapshot);
      mockTx.promptChange.create.mockResolvedValueOnce({});
      mockTx.promptVersion.delete.mockResolvedValueOnce({});

      await service.delete('prompt-1', USER_ID, 1);

      expect(mockTx.promptVersion.delete).toHaveBeenCalledWith({
        where: { promptId_version: { promptId: 'prompt-1', version: 1 } },
      });
    });

    it('should throw NotFoundException when prompt does not exist', async () => {
      mockPrisma.prompt.findUnique.mockResolvedValueOnce(null);

      await expect(service.delete('nonexistent', USER_ID)).rejects.toThrow(NotFoundException);
    });
  });

  // ─── toggleActive ────────────────────────────────────────────────────────────

  describe('toggleActive', () => {
    it('should toggle an active prompt to inactive', async () => {
      const updatedPrompt = { ...basePrompt, isActive: false, version: 2 };
      mockPrisma.prompt.findUnique.mockResolvedValueOnce(basePrompt);
      mockTx.prompt.update.mockResolvedValueOnce(updatedPrompt);
      mockTx.promptVersion.create.mockResolvedValueOnce({});
      mockTx.promptChange.create.mockResolvedValueOnce({});

      const result = await service.toggleActive('prompt-1', USER_ID);

      expect(mockTx.promptChange.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ changeType: PromptChangeType.DEACTIVATE }),
        }),
      );
      expect(result.isActive).toBe(false);
    });

    it('should check for conflict when activating', async () => {
      const inactivePrompt = { ...basePrompt, isActive: false };
      mockPrisma.prompt.findUnique.mockResolvedValueOnce(inactivePrompt);
      mockPrisma.prompt.findFirst.mockResolvedValueOnce(basePrompt); // conflict

      await expect(service.toggleActive('prompt-1', USER_ID)).rejects.toThrow(ConflictException);
    });

    it('should throw NotFoundException when prompt does not exist', async () => {
      mockPrisma.prompt.findUnique.mockResolvedValueOnce(null);

      await expect(service.toggleActive('nonexistent', USER_ID)).rejects.toThrow(NotFoundException);
    });
  });

  // ─── checkActiveConflict ────────────────────────────────────────────────────

  describe('checkActiveConflict', () => {
    it('should not throw when no conflict exists', async () => {
      mockPrisma.prompt.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.checkActiveConflict(AgentSection.PARSER, '/test', undefined, ['cat1']),
      ).resolves.not.toThrow();
    });

    it('should throw ConflictException when conflict exists', async () => {
      mockPrisma.prompt.findFirst.mockResolvedValueOnce(basePrompt);

      await expect(
        service.checkActiveConflict(AgentSection.PARSER, '/test', undefined, ['cat1']),
      ).rejects.toThrow(ConflictException);
    });

    it('should exclude the current prompt when checking for conflicts', async () => {
      mockPrisma.prompt.findFirst.mockResolvedValueOnce(null);

      await service.checkActiveConflict(
        AgentSection.PARSER,
        '/test',
        undefined,
        ['cat1'],
        'prompt-1',
      );

      expect(mockPrisma.prompt.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: { not: 'prompt-1' },
          }),
        }),
      );
    });
  });
});
