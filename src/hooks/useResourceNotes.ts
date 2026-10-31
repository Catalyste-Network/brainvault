import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const NOTES_STORAGE_KEY = "@mindvault_resource_notes";

export interface UseResourceNotesResult {
  notes: Record<string, string>;
  getNote: (resourceId: string) => string;
  setNote: (resourceId: string, note: string) => Promise<void>;
  deleteNote: (resourceId: string) => Promise<void>;
  hydrated: boolean;
}

/**
 * Hook for managing personal per-resource notes, persisted to AsyncStorage.
 * Notes are stored as a flat map of resourceId → note text.
 */
export function useResourceNotes(): UseResourceNotesResult {
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const raw = await AsyncStorage.getItem(NOTES_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            // Only keep string values to guard against corrupt data.
            const cleaned: Record<string, string> = {};
            for (const [key, val] of Object.entries(parsed)) {
              if (typeof val === "string") cleaned[key] = val;
            }
            setNotes(cleaned);
          }
        }
      } catch {
        // Ignore storage errors; start with empty notes.
      } finally {
        setHydrated(true);
      }
    }
    void load();
  }, []);

  const persist = useCallback(async (data: Record<string, string>) => {
    try {
      await AsyncStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(data));
    } catch {
      // Ignore storage errors.
    }
  }, []);

  const getNote = useCallback(
    (resourceId: string): string => notes[resourceId] ?? "",
    [notes]
  );

  const setNote = useCallback(
    async (resourceId: string, note: string) => {
      const trimmed = note.trim();
      const next = { ...notes };
      if (trimmed === "") {
        delete next[resourceId];
      } else {
        next[resourceId] = trimmed;
      }
      setNotes(next);
      await persist(next);
    },
    [notes, persist]
  );

  const deleteNote = useCallback(
    async (resourceId: string) => {
      const next = { ...notes };
      delete next[resourceId];
      setNotes(next);
      await persist(next);
    },
    [notes, persist]
  );

  return {
    notes: hydrated ? notes : {},
    getNote,
    setNote,
    deleteNote,
    hydrated,
  };
}
