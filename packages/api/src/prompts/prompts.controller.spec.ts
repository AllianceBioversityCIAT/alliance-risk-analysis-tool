import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { AgentSection } from '@alliance-risk/shared';
import { PromptsController } from './prompts.controller';
import { PromptsRuntimeController } from './prompts-runtime.controller';
import { PromptsService } from './prompts.service';
import { CommentsService } from './comments.service';
import { ChangeHistoryService } from './change-history.service';
import { VariableInjectionService } from './variable-injection.service';
import { JobsService } from '../jobs/jobs.service';
import type { UserInfo } from '@alliance-risk/shared';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockPromptsService = {
  findAll: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  toggleActive: jest.fn(),
};

const mockCommentsService = {
  addComment: jest.fn(),
  getComments: jest.fn(),
};

const mockChangeHistoryService = {
  getHistory: jest.fn(),
};

const mockVariableInjectionService = {
  injectAll: jest.fn(),
};

const mockJobsService = {
  create: jest.fn(),
};

const mockAdminUser: UserInfo = {
  userId: 'user-123',
  email: 'admin@test.com',
  username: 'admin@test.com',
  role: 'admin',
  isAdmin: true,
};

const basePrompt = {
  id: 'prompt-1',
  name: 'Test Prompt',
  section: AgentSection.PARSER,
  version: 1,
  isActive: true,
  systemPrompt: 'System prompt',
  userPromptTemplate: 'User prompt',
  categories: ['cat1'],
  tags: [],
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('PromptsController', () => {
  let controller: PromptsController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PromptsController],
      providers: [
        { provide: PromptsService, useValue: mockPromptsService },
        { provide: CommentsService, useValue: mockCommentsService },
        { provide: ChangeHistoryService, useValue: mockChangeHistoryService },
        { provide: JobsService, useValue: mockJobsService },
      ],
    }).compile();

    controller = module.get<PromptsController>(PromptsController);
  });

  // ─── list ──────────────────────────────────────────────────────────────────

  describe('list', () => {
    it('should return paginated prompts', async () => {
      const paginatedResult = { prompts: [basePrompt], total: 1, page: 1, limit: 20, hasMore: false };
      mockPromptsService.findAll.mockResolvedValueOnce(paginatedResult);

      const result = await controller.list({ page: 1, limit: 20 });

      expect(result).toEqual({ data: paginatedResult });
      expect(mockPromptsService.findAll).toHaveBeenCalledWith({ page: 1, limit: 20 });
    });

    it('should pass filter parameters to findAll', async () => {
      mockPromptsService.findAll.mockResolvedValueOnce({ prompts: [], total: 0, page: 1, limit: 20, hasMore: false });

      await controller.list({ section: AgentSection.PARSER, isActive: true, page: 1, limit: 20 });

      expect(mockPromptsService.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ section: AgentSection.PARSER, isActive: true }),
      );
    });
  });

  // ─── create ────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('should create a prompt and return it', async () => {
      mockPromptsService.create.mockResolvedValueOnce(basePrompt);

      const dto = {
        name: 'Test Prompt',
        section: AgentSection.PARSER,
        systemPrompt: 'System prompt',
        userPromptTemplate: 'User prompt',
      };

      const result = await controller.create(dto, mockAdminUser);

      expect(mockPromptsService.create).toHaveBeenCalledWith(dto, mockAdminUser.userId);
      expect(result).toEqual({ data: basePrompt });
    });

    it('should propagate ConflictException from service', async () => {
      mockPromptsService.create.mockRejectedValueOnce(new ConflictException('Conflict'));

      await expect(
        controller.create(
          { name: 'X', section: AgentSection.PARSER, systemPrompt: 'S', userPromptTemplate: 'U' },
          mockAdminUser,
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ─── findOne ──────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('should return a prompt by id', async () => {
      mockPromptsService.findOne.mockResolvedValueOnce(basePrompt);

      const result = await controller.findOne('prompt-1', undefined);

      expect(mockPromptsService.findOne).toHaveBeenCalledWith('prompt-1', undefined);
      expect(result).toEqual({ data: basePrompt });
    });

    it('should return a specific version', async () => {
      mockPromptsService.findOne.mockResolvedValueOnce({ ...basePrompt, version: 1 });

      await controller.findOne('prompt-1', 1);

      expect(mockPromptsService.findOne).toHaveBeenCalledWith('prompt-1', 1);
    });

    it('should throw NotFoundException for missing prompt', async () => {
      mockPromptsService.findOne.mockRejectedValueOnce(new NotFoundException('Not found'));

      await expect(controller.findOne('nonexistent', undefined)).rejects.toThrow(NotFoundException);
    });
  });

  // ─── update ───────────────────────────────────────────────────────────────

  describe('update', () => {
    it('should update a prompt', async () => {
      const updated = { ...basePrompt, version: 2, name: 'Updated' };
      mockPromptsService.update.mockResolvedValueOnce(updated);

      const result = await controller.update('prompt-1', { name: 'Updated' }, mockAdminUser);

      expect(mockPromptsService.update).toHaveBeenCalledWith(
        'prompt-1',
        { name: 'Updated' },
        mockAdminUser.userId,
      );
      expect(result.data.version).toBe(2);
    });
  });

  // ─── delete ───────────────────────────────────────────────────────────────

  describe('delete', () => {
    it('should delete a prompt', async () => {
      mockPromptsService.delete.mockResolvedValueOnce(undefined);

      await controller.delete('prompt-1', mockAdminUser, undefined);

      expect(mockPromptsService.delete).toHaveBeenCalledWith('prompt-1', mockAdminUser.userId, undefined);
    });
  });

  // ─── toggleActive ──────────────────────────────────────────────────────────

  describe('toggleActive', () => {
    it('should toggle active status', async () => {
      const toggled = { ...basePrompt, isActive: false };
      mockPromptsService.toggleActive.mockResolvedValueOnce(toggled);

      const result = await controller.toggleActive('prompt-1', mockAdminUser);

      expect(mockPromptsService.toggleActive).toHaveBeenCalledWith('prompt-1', mockAdminUser.userId);
      expect(result.data.isActive).toBe(false);
    });
  });

  // ─── comments ──────────────────────────────────────────────────────────────

  describe('addComment', () => {
    it('should add a comment to a prompt', async () => {
      const comment = { id: 'comment-1', content: 'Great prompt', promptId: 'prompt-1' };
      mockCommentsService.addComment.mockResolvedValueOnce(comment);

      const result = await controller.addComment('prompt-1', { content: 'Great prompt' }, mockAdminUser);

      expect(mockCommentsService.addComment).toHaveBeenCalledWith(
        'prompt-1',
        { content: 'Great prompt' },
        mockAdminUser.userId,
      );
      expect(result).toEqual({ data: comment });
    });
  });

  describe('getComments', () => {
    it('should get threaded comments', async () => {
      const comments = [{ id: 'comment-1', content: 'Hello', replies: [] }];
      mockCommentsService.getComments.mockResolvedValueOnce(comments);

      const result = await controller.getComments('prompt-1');

      expect(result).toEqual({ data: comments });
    });
  });

  // ─── history ───────────────────────────────────────────────────────────────

  describe('getHistory', () => {
    it('should get change history', async () => {
      const history = [{ id: 'change-1', changeType: 'CREATE' }];
      mockChangeHistoryService.getHistory.mockResolvedValueOnce(history);

      const result = await controller.getHistory('prompt-1');

      expect(result).toEqual({ data: history });
    });
  });

   // ─── preview ────────────────────────────────────────────────────────────────

  describe('preview', () => {
    it('should create a job and return jobId + PROCESSING status', async () => {
      const dto = { systemPrompt: 'S', userPromptTemplate: 'U' };
      mockJobsService.create.mockResolvedValueOnce('job-uuid-preview');

      const result = await controller.preview(dto, mockAdminUser);

      expect(mockJobsService.create).toHaveBeenCalledWith(
        expect.any(String), // JobType.AI_PREVIEW
        dto,
        mockAdminUser.userId,
      );
      expect(result).toEqual({ data: { jobId: 'job-uuid-preview', status: 'PROCESSING' } });
    });
  });
});

// ─── PromptsRuntimeController ────────────────────────────────────────────────

describe('PromptsRuntimeController', () => {
  let controller: PromptsRuntimeController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PromptsRuntimeController],
      providers: [
        { provide: PromptsService, useValue: mockPromptsService },
        { provide: VariableInjectionService, useValue: mockVariableInjectionService },
      ],
    }).compile();

    controller = module.get<PromptsRuntimeController>(PromptsRuntimeController);
  });

  it('should return active prompt for a valid section', async () => {
    mockPromptsService.findAll.mockResolvedValueOnce({ prompts: [basePrompt], total: 1 });

    const result = await controller.getActiveBySection('parser');

    expect(result).toEqual({ data: basePrompt });
  });

  it('should inject variables when categories provided', async () => {
    const injectedPrompt = {
      ...basePrompt,
      systemPrompt: 'System Financial',
      userPromptTemplate: 'User Financial',
    };
    mockPromptsService.findAll.mockResolvedValueOnce({ prompts: [basePrompt], total: 1 });
    mockVariableInjectionService.injectAll.mockReturnValueOnce(injectedPrompt);

    const result = await controller.getActiveBySection('parser', 'Financial');

    expect(mockVariableInjectionService.injectAll).toHaveBeenCalledWith(
      expect.objectContaining({ systemPrompt: 'System prompt' }),
      ['Financial'],
    );
    expect(result.data.systemPrompt).toBe('System Financial');
  });

  it('should throw NotFoundException for invalid section', async () => {
    await expect(
      controller.getActiveBySection('invalid_section'),
    ).rejects.toThrow(NotFoundException);
  });

  it('should throw NotFoundException when no active prompt exists', async () => {
    mockPromptsService.findAll.mockResolvedValueOnce({ prompts: [], total: 0 });

    await expect(
      controller.getActiveBySection('parser'),
    ).rejects.toThrow(NotFoundException);
  });

  it('should handle comma-separated categories', async () => {
    const injectedPrompt = { ...basePrompt, systemPrompt: 'Injected', userPromptTemplate: 'Injected' };
    mockPromptsService.findAll.mockResolvedValueOnce({ prompts: [basePrompt], total: 1 });
    mockVariableInjectionService.injectAll.mockReturnValueOnce(injectedPrompt);

    await controller.getActiveBySection('parser', 'Financial, Operational, Reputational');

    expect(mockVariableInjectionService.injectAll).toHaveBeenCalledWith(
      expect.any(Object),
      ['Financial', 'Operational', 'Reputational'],
    );
  });
});
