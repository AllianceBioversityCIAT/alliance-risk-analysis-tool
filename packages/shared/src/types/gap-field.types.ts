import { GapFieldStatus } from '../enums/gap-field-status.enum';

export interface GapFieldResponse {
  id: string;
  category: string;
  field: string;
  label: string;
  extractedValue: string | null;
  correctedValue: string | null;
  status: GapFieldStatus;
  isMandatory: boolean;
  order: number;
  confidence: number | null;
  aiReasoning: string | null;
  validationFeedback?: string | null;
}

export interface InvalidField {
  id: string;
  field: string;
  feedback: string;
}

export interface GapFieldValidationError {
  statusCode: 400;
  message: string;
  invalidFields: InvalidField[];
}
