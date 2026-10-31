import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const RECENTLY_VIEWED_KEY = "@mindvault_recently_viewed";
const MAX_RECENTLY_VIEWED = 20;

export interface UserecentlyViewedResult {
  recentlyViewed: string[];
  addRecentlyViewed: (resourceId: string) => Promise<void>;
  removeRecentlyViewed: (resourceId: string) => Promise<void>;
  clearRecentlyViewed: () => Promise<void>;
  hydrated: boolean;
}

/**
 * Hook for tracking recently viewed resource IDs, persisted to AsyncStorage.
 * Stores the most recent MAX_RECENTLY_VIEWED IDs, newest first.
 */
export function useRecentlyViewed(): UserecentlyViewedResult {
  const [recentlyViewed, setRecentlyViewed] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const raw = await AsyncStorage.getItem(RECENTLY_VIEWED_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            setRecentlyViewed(parsed.filter((id) => typeof id === "string"));
          }
        }
      } catch {
        // Ignore storage errors; start with empty list.
      } finally {
        setHydrated(true);
      }
    }
    void load();
  }, []);

  const persist = useCallback(async (ids: string[]) => {
    try {
      await AsyncStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(ids));
    } catch {
      // Ignore storage errors.
    }
  }, []);

  const addRecentlyViewed = useCallback(
    async (resourceId: string) => {
      // Move to front, remove any existing entry for same ID, cap at max.
      const without = recentlyViewed.filter((id) => id !== resourceId);
      const next = [resourceId, ...without].slice(0, MAX_RECENTLY_VIEWED);
      setRecentlyViewed(next);
      await persist(next);
    },
    [recentlyViewed, persist]
  );

  const removeRecentlyViewed = useCallback(
    async (resourceId: string) => {
      const next = recentlyViewed.filter((id) => id !== resourceId);
      setRecentlyViewed(next);
      await persist(next);
    },
    [recentlyViewed, persist]
  );

  const clearRecentlyViewed = useCallback(async () => {
    setRecentlyViewed([]);
    await persist([]);
  }, [persist]);

  return {
    recentlyViewed: hydrated ? recentlyViewed : [],
    addRecentlyViewed,
    removeRecentlyViewed,
    clearRecentlyViewed,
    hydrated,
  };
}
