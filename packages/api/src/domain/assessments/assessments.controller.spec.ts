import { Test, TestingModule } from '@nestjs/testing';
import { AssessmentsController } from './assessments.controller';
import { AssessmentsService } from './assessments.service';
import { IntakeMode, AssessmentStatus } from '@alliance-risk/shared';

const mockUser = { userId: 'user-1', cognitoId: 'cognito-1', email: 'test@example.com', username: 'testuser', isAdmin: false };

const mockAssessment = {
  id: 'assess-1',
  name: 'Test Assessment',
  companyName: 'Test Co',
  companyType: null,
  country: 'Kenya',
  status: 'DRAFT' as const,
  intakeMode: 'UPLOAD' as const,
  progress: 0,
  overallRiskScore: null,
  overallRiskLevel: null,
  userId: 'user-1',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockService = {
  create: jest.fn().mockResolvedValue(mockAssessment),
  findAll: jest.fn().mockResolvedValue({ data: [mockAssessment], nextCursor: null, total: 1 }),
  getStats: jest.fn().mockResolvedValue({ active: 0, drafts: 1, completed: 0, total: 1 }),
  findOne: jest.fn().mockResolvedValue(mockAssessment),
  update: jest.fn().mockResolvedValue(mockAssessment),
  delete: jest.fn().mockResolvedValue(undefined),
  requestUploadUrl: jest.fn().mockResolvedValue({ presignedUrl: 'https://s3.example.com/upload', documentId: 'doc-1' }),
  triggerParseDocument: jest.fn().mockResolvedValue('job-1'),
  addComment: jest.fn().mockResolvedValue({ id: 'comment-1', content: 'Test comment' }),
  getComments: jest.fn().mockResolvedValue([]),
};

describe('AssessmentsController', () => {
  let controller: AssessmentsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AssessmentsController],
      providers: [{ provide: AssessmentsService, useValue: mockService }],
    }).compile();

    controller = module.get<AssessmentsController>(AssessmentsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create an assessment', async () => {
      const dto = { name: 'Test', companyName: 'Test Co', intakeMode: IntakeMode.UPLOAD };
      const result = await controller.create(dto, mockUser);
      expect(result).toEqual(mockAssessment);
      expect(mockService.create).toHaveBeenCalledWith(dto, mockUser.userId);
    });
  });

  describe('findAll', () => {
    it('should return paginated assessments', async () => {
      const query = { limit: 10 };
      const result = await controller.findAll(query, mockUser);
      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  describe('getStats', () => {
    it('should return assessment stats', async () => {
      const result = await controller.getStats(mockUser);
      expect(result).toEqual({ active: 0, drafts: 1, completed: 0, total: 1 });
    });
  });

  describe('findOne', () => {
    it('should return a single assessment', async () => {
      const result = await controller.findOne('assess-1', mockUser);
      expect(result).toEqual(mockAssessment);
    });
  });

  describe('update', () => {
    it('should update an assessment', async () => {
      const dto = { status: AssessmentStatus.ANALYZING };
      const result = await controller.update('assess-1', dto, mockUser);
      expect(result).toEqual(mockAssessment);
    });
  });

  describe('delete', () => {
    it('should delete an assessment', async () => {
      await expect(controller.delete('assess-1', mockUser)).resolves.toBeUndefined();
    });
  });

  describe('requestUploadUrl', () => {
    it('should return a presigned upload URL', async () => {
      const dto = { fileName: 'plan.pdf', mimeType: 'application/pdf', fileSize: 1024 };
      const result = await controller.requestUploadUrl('assess-1', dto, mockUser);
      expect(result.presignedUrl).toBeTruthy();
      expect(result.documentId).toBeTruthy();
    });
  });

  describe('addComment', () => {
    it('should add a comment', async () => {
      const dto = { content: 'Test comment' };
      const result = await controller.addComment('assess-1', dto, mockUser);
      expect(result).toBeDefined();
    });
  });
});
