import { Test, TestingModule } from '@nestjs/testing';
import { RiskScoreController } from './risk-score.controller';
import { RiskAnalysisService } from './risk-analysis.service';

const mockUser = { userId: 'user-1', cognitoId: 'cognito-1', email: 'test@example.com', username: 'testuser', isAdmin: false };

const mockRiskScore = {
  id: 'score-1',
  assessmentId: 'assess-1',
  category: 'FINANCIAL',
  score: 65.5,
  level: 'HIGH',
  subcategories: [],
  evidence: 'Revenue data shows high risk',
  narrative: 'Financial risk is elevated',
  recommendations: [
    {
      id: 'rec-1',
      text: 'Diversify revenue streams',
      priority: 'HIGH',
      isEdited: false,
      editedText: null,
      order: 1,
      riskScoreId: 'score-1',
    },
  ],
};

const mockService = {
  findByAssessment: jest.fn().mockResolvedValue([mockRiskScore]),
  editRecommendation: jest.fn().mockResolvedValue({
    ...mockRiskScore.recommendations[0],
    isEdited: true,
    editedText: 'Updated recommendation',
  }),
};

describe('RiskScoreController', () => {
  let controller: RiskScoreController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RiskScoreController],
      providers: [{ provide: RiskAnalysisService, useValue: mockService }],
    }).compile();

    controller = module.get<RiskScoreController>(RiskScoreController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findByAssessment', () => {
    it('should return risk scores with recommendations', async () => {
      const result = await controller.findByAssessment('assess-1', mockUser);
      expect(result).toHaveLength(1);
      expect(result[0].recommendations).toHaveLength(1);
    });
  });

  describe('editRecommendation', () => {
    it('should update recommendation and set isEdited=true', async () => {
      const dto = { text: 'Updated recommendation' };
      const result = await controller.editRecommendation('assess-1', 'rec-1', dto, mockUser);
      expect(result.isEdited).toBe(true);
      expect(result.editedText).toBe('Updated recommendation');
    });
  });
});
