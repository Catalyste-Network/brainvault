import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { fetchCatalog, getApiBaseUrl } from "../api/resources";
import { ErrorBanner } from "../components/ErrorBanner";
import { ResourceCard } from "../components/ResourceCard";
import { SkeletonCard } from "../components/SkeletonCard";
import type { RootStackParamList } from "../navigation";
import type { Resource } from "../types";
import { spacing } from "../theme";
import type { ThemeColors } from "../theme";
import { useAppTheme } from "../theme/ThemeProvider";
import { useRecentlyViewed } from "../hooks/useRecentlyViewed";
import { useFavorites } from "../hooks/useFavorites";

type Props = NativeStackScreenProps<RootStackParamList, "RecentlyViewed">;

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      padding: spacing.lg,
      paddingBottom: spacing.xxl,
    },
    header: {
      gap: spacing.md,
      marginBottom: spacing.lg,
    },
    clearButton: {
      alignSelf: "flex-end",
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.sm,
      borderRadius: 8,
      backgroundColor: colors.dangerBg,
    },
    clearButtonText: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.danger,
    },
    listContent: {
      gap: spacing.md,
    },
    skeletons: {
      gap: 12,
    },
    separator: {
      height: spacing.md,
    },
    emptyState: {
      alignItems: "center",
      paddingVertical: spacing.xxl,
      gap: spacing.sm,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: "600",
      color: colors.text,
    },
    emptyBody: {
      textAlign: "center",
      fontSize: 14,
      color: colors.textMuted,
      maxWidth: 320,
      lineHeight: 20,
    },
    toast: {
      position: "absolute",
      bottom: spacing.xl,
      left: spacing.lg,
      right: spacing.lg,
      backgroundColor: colors.text,
      borderRadius: 12,
      paddingVertical: 12,
      paddingHorizontal: 16,
    },
    toastText: {
      color: colors.background,
      textAlign: "center",
      fontSize: 14,
      fontWeight: "500",
    },
    apiUrl: {
      marginTop: spacing.lg,
      fontSize: 12,
      color: colors.textSubtle,
    },
  });
}

export function RecentlyViewedScreen({ navigation }: Props) {
  const { colors, shared, typography } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const { recentlyViewed, clearRecentlyViewed, hydrated } = useRecentlyViewed();
  const { isFavorite, toggleFavorite } = useFavorites();

  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(timer);
  }, [toast]);

  const loadResources = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      if (recentlyViewed.length === 0) {
        setResources([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      try {
        const results = await Promise.allSettled(
          recentlyViewed.map((id) =>
            fetchCatalog({ search: id }).then((list) => list.find((r) => r.id === id))
          )
        );

        const map = new Map<string, Resource>();
        results.forEach((result, index) => {
          if (result.status === "fulfilled" && result.value) {
            map.set(recentlyViewed[index], result.value);
          }
        });

        // Preserve recency order (newest first).
        const ordered = recentlyViewed
          .map((id) => map.get(id))
          .filter((r): r is Resource => !!r);

        setResources(ordered);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to load recently viewed resources.";
        setError(message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [recentlyViewed]
  );

  useEffect(() => {
    if (hydrated) {
      void loadResources();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  const handleClearAll = useCallback(async () => {
    await clearRecentlyViewed();
    setResources([]);
    setToast("History cleared");
  }, [clearRecentlyViewed]);

  const handleToggleFavorite = useCallback(
    async (resourceId: string) => {
      await toggleFavorite(resourceId);
      setToast(isFavorite(resourceId) ? "Removed from favorites" : "Added to favorites");
    },
    [isFavorite, toggleFavorite]
  );

  const renderEmpty = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyTitle}>No history yet</Text>
      <Text style={styles.emptyBody}>
        Resources you open will appear here so you can find them again quickly.
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={shared.screen} edges={["top", "left", "right"]}>
      <StatusBar style="auto" />
      <FlatList
        data={loading ? null : resources}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void loadResources(true)}
          />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={typography.title}>Recently Viewed</Text>
            <Text style={typography.subtitle}>Resources you've opened recently</Text>
            {resources.length > 0 && (
              <Pressable style={styles.clearButton} onPress={() => void handleClearAll()}>
                <Text style={styles.clearButtonText}>Clear History</Text>
              </Pressable>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <ResourceCard
            resource={item}
            onCopyUrl={setToast}
            onPress={() =>
              navigation.navigate("ResourceDetail", { resourceId: item.id })
            }
            onRegister={() => {}}
            onFavoritePress={() => void handleToggleFavorite(item.id)}
            isFavorite={isFavorite(item.id)}
          />
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={loading ? null : renderEmpty()}
      />

      {error ? (
        <ErrorBanner message={error} onRetry={() => void loadResources()} />
      ) : null}

      {loading ? (
        <View style={styles.skeletons}>
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </View>
      ) : null}

      {toast ? (
        <View style={styles.toast}>
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      ) : null}

      <Text style={styles.apiUrl}>API: {getApiBaseUrl()}</Text>
    </SafeAreaView>
  );
}
