'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

interface SearchContextValue {
  searchQuery: string;
  setSearchQuery: (value: string) => void;
}

const SearchContext = createContext<SearchContextValue | null>(null);

export function SearchProvider({ children }: { children: ReactNode }) {
  const [searchQuery, setSearchQueryState] = useState('');

  const setSearchQuery = useCallback((value: string) => {
    setSearchQueryState(value);
  }, []);

  return (
    <SearchContext.Provider value={{ searchQuery, setSearchQuery }}>
      {children}
    </SearchContext.Provider>
  );
}

export function useSearch(): SearchContextValue {
  const ctx = useContext(SearchContext);
  if (!ctx) throw new Error('useSearch must be used within SearchProvider');
  return ctx;
}
