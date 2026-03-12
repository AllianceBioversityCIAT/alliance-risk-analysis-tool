import { RISK_ANALYSIS_CONFIG } from './risk-analysis.config';

describe('RISK_ANALYSIS_CONFIG', () => {
  it('should define exactly 7 risk categories', () => {
    expect(RISK_ANALYSIS_CONFIG.categories).toHaveLength(7);
  });

  it('should define exactly 5 subcategories per category (35 total)', () => {
    let totalSubcategories = 0;
    for (const category of RISK_ANALYSIS_CONFIG.categories) {
      expect(category.subcategories).toHaveLength(5);
      totalSubcategories += category.subcategories.length;
    }
    expect(totalSubcategories).toBe(35);
  });

  it('should have unique category names', () => {
    const categories = RISK_ANALYSIS_CONFIG.categories.map((c) => c.category);
    const unique = new Set(categories);
    expect(unique.size).toBe(categories.length);
  });

  it('should have non-empty subcategory names and indicators', () => {
    for (const category of RISK_ANALYSIS_CONFIG.categories) {
      for (const sub of category.subcategories) {
        expect(sub.name).toBeTruthy();
        expect(sub.indicator).toBeTruthy();
      }
    }
  });

  it('should have valid scoring rubric thresholds', () => {
    const rubric = RISK_ANALYSIS_CONFIG.scoringRubric;
    expect(rubric.LOW.min).toBe(0);
    expect(rubric.LOW.max).toBe(30);
    expect(rubric.MODERATE.min).toBe(31);
    expect(rubric.MODERATE.max).toBe(60);
    expect(rubric.HIGH.min).toBe(61);
    expect(rubric.HIGH.max).toBe(80);
    expect(rubric.CRITICAL.min).toBe(81);
    expect(rubric.CRITICAL.max).toBe(100);
  });

  it('should have a maxInputCharacters value', () => {
    expect(RISK_ANALYSIS_CONFIG.maxInputCharacters).toBe(200_000);
  });
});
