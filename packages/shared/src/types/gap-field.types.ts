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
}
