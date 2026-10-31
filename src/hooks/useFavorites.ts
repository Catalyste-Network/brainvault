import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const FAVORITES_STORAGE_KEY = "@mindvault_favorites";

export interface UseFavoritesResult {
  favorites: string[];
  isFavorite: (resourceId: string) => boolean;
  toggleFavorite: (resourceId: string) => Promise<void>;
  addFavorite: (resourceId: string) => Promise<void>;
  removeFavorite: (resourceId: string) => Promise<void>;
  clearFavorites: () => Promise<void>;
}

/**
 * Hook for managing favorited resources, persisted to AsyncStorage.
 */
export function useFavorites(): UseFavoritesResult {
  const [favorites, setFavorites] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    async function loadFavorites() {
      try {
        const raw = await AsyncStorage.getItem(FAVORITES_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            setFavorites(parsed.filter((id) => typeof id === "string"));
          }
        }
      } catch {
        // Ignore storage errors; start with empty favorites.
      } finally {
        setHydrated(true);
      }
    }
    void loadFavorites();
  }, []);

  const persist = useCallback(async (ids: string[]) => {
    try {
      await AsyncStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(ids));
    } catch {
      // Ignore storage errors.
    }
  }, []);

  const isFavorite = useCallback(
    (resourceId: string) => favorites.includes(resourceId),
    [favorites]
  );

  const addFavorite = useCallback(
    async (resourceId: string) => {
      if (favorites.includes(resourceId)) return;
      const next = [...favorites, resourceId];
      setFavorites(next);
      await persist(next);
    },
    [favorites, persist]
  );

  const removeFavorite = useCallback(
    async (resourceId: string) => {
      const next = favorites.filter((id) => id !== resourceId);
      setFavorites(next);
      await persist(next);
    },
    [favorites, persist]
  );

  const toggleFavorite = useCallback(
    async (resourceId: string) => {
      if (favorites.includes(resourceId)) {
        await removeFavorite(resourceId);
      } else {
        await addFavorite(resourceId);
      }
    },
    [addFavorite, favorites, removeFavorite]
  );

  const clearFavorites = useCallback(async () => {
    setFavorites([]);
    await persist([]);
  }, [persist]);

  return {
    favorites: hydrated ? favorites : [],
    isFavorite,
    toggleFavorite,
    addFavorite,
    removeFavorite,
    clearFavorites,
  };
}
