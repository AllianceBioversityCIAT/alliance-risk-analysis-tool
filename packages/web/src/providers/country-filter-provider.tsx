'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  isSupportedCountry,
  type SupportedCountryLabel,
} from '@alliance-risk/shared';

const STORAGE_KEY = 'alliance_active_country';

/**
 * Web-only sentinel meaning "no country scope" — never a valid value for
 * `Assessment.country`, never sent to the API as a literal string, and never
 * exported from `@alliance-risk/shared`. A string that can never collide with
 * a real country label.
 */
export const ALL_COUNTRIES_FILTER = 'ALL_COUNTRIES';

export type CountryFilterValue = SupportedCountryLabel | typeof ALL_COUNTRIES_FILTER;

interface CountryFilterContextValue {
  activeCountry: CountryFilterValue;
  setActiveCountry: (country: CountryFilterValue) => void;
}

const CountryFilterContext = createContext<CountryFilterContextValue | null>(null);

function readStoredCountry(): CountryFilterValue {
  if (typeof window === 'undefined') return ALL_COUNTRIES_FILTER;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && (stored === ALL_COUNTRIES_FILTER || isSupportedCountry(stored))) return stored;
  } catch {
    // ignore storage errors
  }
  return ALL_COUNTRIES_FILTER;
}

export function CountryFilterProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [internalActiveCountry, setInternalActiveCountry] = useState<CountryFilterValue>(ALL_COUNTRIES_FILTER);

  useEffect(() => {
    setInternalActiveCountry(readStoredCountry());
  }, []);

  const setActiveCountry = useCallback((country: CountryFilterValue) => {
    setInternalActiveCountry(country);
    try {
      localStorage.setItem(STORAGE_KEY, country);
    } catch {
      // ignore storage errors
    }
  }, []);

  const value = useMemo(
    () => ({ activeCountry: internalActiveCountry, setActiveCountry }),
    [internalActiveCountry, setActiveCountry],
  );

  return (
    <CountryFilterContext.Provider value={value}>
      {children}
    </CountryFilterContext.Provider>
  );
}

export function useCountryFilter(): CountryFilterContextValue {
  const ctx = useContext(CountryFilterContext);
  if (!ctx) {
    throw new Error('useCountryFilter must be used within CountryFilterProvider');
  }
  return ctx;
}

/**
 * Translates the active country filter into the query-param value expected
 * by the assessments list/stats endpoints: `undefined` (omitted entirely)
 * when "All countries" is active, the real country label unchanged otherwise.
 */
export function resolveListCountryParam(value: CountryFilterValue): string | undefined {
  return value === ALL_COUNTRIES_FILTER ? undefined : value;
}
