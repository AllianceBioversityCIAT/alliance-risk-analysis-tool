'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import {
  DEFAULT_COUNTRY,
  isSupportedCountry,
  type SupportedCountryLabel,
} from '@alliance-risk/shared';

const STORAGE_KEY = 'alliance_active_country';

interface CountryFilterContextValue {
  activeCountry: SupportedCountryLabel;
  setActiveCountry: (country: SupportedCountryLabel) => void;
}

const CountryFilterContext = createContext<CountryFilterContextValue | null>(null);

function readStoredCountry(): SupportedCountryLabel {
  if (typeof window === 'undefined') return DEFAULT_COUNTRY;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && isSupportedCountry(stored)) return stored;
  } catch {
    // ignore storage errors
  }
  return DEFAULT_COUNTRY;
}

export function CountryFilterProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [activeCountry, setActiveCountryState] = useState<SupportedCountryLabel>(DEFAULT_COUNTRY);

  useEffect(() => {
    setActiveCountryState(readStoredCountry());
  }, []);

  const setActiveCountry = useCallback((country: SupportedCountryLabel) => {
    setActiveCountryState(country);
    try {
      localStorage.setItem(STORAGE_KEY, country);
    } catch {
      // ignore storage errors
    }
  }, []);

  return (
    <CountryFilterContext.Provider value={{ activeCountry, setActiveCountry }}>
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
