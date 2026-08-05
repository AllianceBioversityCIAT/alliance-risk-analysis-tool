import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';
import {
  ALL_COUNTRIES_FILTER,
  CountryFilterProvider,
  resolveListCountryParam,
  useCountryFilter,
} from '../country-filter-provider';

const STORAGE_KEY = 'alliance_active_country';

function Wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(CountryFilterProvider, null, children);
}

describe('CountryFilterProvider', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('readStoredCountry (via mount behavior)', () => {
    it('defaults to ALL_COUNTRIES_FILTER when localStorage is empty', async () => {
      const { result } = renderHook(() => useCountryFilter(), { wrapper: Wrapper });

      await waitFor(() => {
        expect(result.current.activeCountry).toBe(ALL_COUNTRIES_FILTER);
      });
    });

    it('falls back to ALL_COUNTRIES_FILTER for an invalid stored value', async () => {
      localStorage.setItem(STORAGE_KEY, 'Uganda');
      const { result } = renderHook(() => useCountryFilter(), { wrapper: Wrapper });

      await waitFor(() => {
        expect(result.current.activeCountry).toBe(ALL_COUNTRIES_FILTER);
      });
    });

    it('falls back to ALL_COUNTRIES_FILTER when localStorage.getItem throws (corrupted access)', async () => {
      const getItemSpy = jest
        .spyOn(Storage.prototype, 'getItem')
        .mockImplementation(() => {
          throw new Error('corrupted storage');
        });

      const { result } = renderHook(() => useCountryFilter(), { wrapper: Wrapper });

      await waitFor(() => {
        expect(result.current.activeCountry).toBe(ALL_COUNTRIES_FILTER);
      });

      getItemSpy.mockRestore();
    });

    it('restores a valid stored real country unchanged (regression)', async () => {
      localStorage.setItem(STORAGE_KEY, 'Ethiopia');
      const { result } = renderHook(() => useCountryFilter(), { wrapper: Wrapper });

      await waitFor(() => {
        expect(result.current.activeCountry).toBe('Ethiopia');
      });
      expect(result.current.activeCountry).not.toBe(ALL_COUNTRIES_FILTER);
    });
  });

  describe('setActiveCountry', () => {
    it('persists ALL_COUNTRIES_FILTER to localStorage and a later re-read restores it', async () => {
      const { result, unmount } = renderHook(() => useCountryFilter(), { wrapper: Wrapper });

      await waitFor(() => {
        expect(result.current.activeCountry).toBe(ALL_COUNTRIES_FILTER);
      });

      act(() => {
        result.current.setActiveCountry('Kenya');
      });
      expect(result.current.activeCountry).toBe('Kenya');
      expect(localStorage.getItem(STORAGE_KEY)).toBe('Kenya');

      act(() => {
        result.current.setActiveCountry(ALL_COUNTRIES_FILTER);
      });
      expect(result.current.activeCountry).toBe(ALL_COUNTRIES_FILTER);
      expect(localStorage.getItem(STORAGE_KEY)).toBe(ALL_COUNTRIES_FILTER);

      unmount();

      const { result: result2 } = renderHook(() => useCountryFilter(), { wrapper: Wrapper });
      await waitFor(() => {
        expect(result2.current.activeCountry).toBe(ALL_COUNTRIES_FILTER);
      });
    });
  });

  describe('resolveListCountryParam', () => {
    it('returns undefined for the ALL_COUNTRIES_FILTER sentinel', () => {
      expect(resolveListCountryParam(ALL_COUNTRIES_FILTER)).toBeUndefined();
    });

    it('returns the value unchanged for a real country', () => {
      expect(resolveListCountryParam('Nigeria')).toBe('Nigeria');
    });
  });
});
