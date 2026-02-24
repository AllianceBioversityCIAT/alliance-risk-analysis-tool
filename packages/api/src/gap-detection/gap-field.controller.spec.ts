import { Test, TestingModule } from '@nestjs/testing';
import { GapFieldController } from './gap-field.controller';
import { GapDetectionService } from './gap-detection.service';

const mockUser = { id: 'user-1', email: 'test@example.com', isAdmin: false };

const mockGapField = {
  id: 'gap-1',
  assessmentId: 'assess-1',
  category: 'FINANCIAL',
  field: 'revenue',
  label: 'Annual Revenue',
  extractedValue: '1000000',
  correctedValue: null,
  status: 'PARTIAL',
  isMandatory: true,
  order: 1,
};

const mockService = {
  findByAssessment: jest.fn().mockResolvedValue([mockGapField]),
  updateBatch: jest.fn().mockResolvedValue([{ ...mockGapField, status: 'VERIFIED', correctedValue: '1200000' }]),
  triggerRiskAnalysis: jest.fn().mockResolvedValue('job-1'),
};

describe('GapFieldController', () => {
  let controller: GapFieldController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GapFieldController],
      providers: [{ provide: GapDetectionService, useValue: mockService }],
    }).compile();

    controller = module.get<GapFieldController>(GapFieldController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findByAssessment', () => {
    it('should return gap fields for an assessment', async () => {
      const result = await controller.findByAssessment('assess-1', mockUser);
      expect(result).toHaveLength(1);
    });
  });

  describe('updateBatch', () => {
    it('should batch update gap fields', async () => {
      const dto = { updates: [{ id: 'gap-1', correctedValue: '1200000' }] };
      const result = await controller.updateBatch('assess-1', dto, mockUser);
      expect(result[0].status).toBe('VERIFIED');
    });
  });

  describe('triggerRiskAnalysis', () => {
    it('should trigger risk analysis job', async () => {
      const result = await controller.triggerRiskAnalysis('assess-1', mockUser);
      expect(result).toBe('job-1');
    });
  });
});
