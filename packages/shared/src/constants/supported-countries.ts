export const SUPPORTED_COUNTRIES = [
  { label: 'Kenya', flag: '🇰🇪' },
  { label: 'Ethiopia', flag: '🇪🇹' },
  { label: 'Nigeria', flag: '🇳🇬' },
  { label: 'Zambia', flag: '🇿🇲' },
] as const;

export type SupportedCountry = (typeof SUPPORTED_COUNTRIES)[number];
export type SupportedCountryLabel = SupportedCountry['label'];

export const SUPPORTED_COUNTRY_LABELS: SupportedCountryLabel[] = SUPPORTED_COUNTRIES.map(
  (c) => c.label,
);

export const DEFAULT_COUNTRY: SupportedCountryLabel = 'Kenya';

export function isSupportedCountry(value: string): value is SupportedCountryLabel {
  return (SUPPORTED_COUNTRY_LABELS as readonly string[]).includes(value);
}

export function getCountryFlag(label: SupportedCountryLabel): string {
  return SUPPORTED_COUNTRIES.find((c) => c.label === label)?.flag ?? '';
}
