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

import {
  fetchCatalog,
  getApiBaseUrl,
} from "../api/resources";
import { ErrorBanner } from "../components/ErrorBanner";
import { ResourceCard } from "../components/ResourceCard";
import { SkeletonCard } from "../components/SkeletonCard";
import type { RootStackParamList } from "../navigation";
import type { Resource } from "../types";
import { spacing } from "../theme";
import type { ThemeColors } from "../theme";
import { useAppTheme } from "../theme/ThemeProvider";
import { useFavorites } from "../hooks/useFavorites";

type Props = NativeStackScreenProps<RootStackParamList, "Favorites">;

const CATALOG_FILTERS_KEY = "@mindvault_catalog_filters";

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
    title: {
      fontSize: 28,
      fontWeight: "700",
      color: colors.text,
    },
    subtitle: {
      fontSize: 14,
      color: colors.textMuted,
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
  });
}

export function FavoritesScreen({ navigation }: Props) {
  const { colors, shared, typography } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const { favorites, toggleFavorite, isFavorite } = useFavorites();
  const [resources, setResources] = useState<Resource[]>([]);
  const [resourceMap, setResourceMap] = useState<Map<string, Resource>>(
    new Map()
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(timer);
  }, [toast]);

  const loadFavoritedResources = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    if (favorites.length === 0) {
      setResources([]);
      setResourceMap(new Map());
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      const results = await Promise.allSettled(
        favorites.map((id) =>
          fetchCatalog({ search: id }).then((list) => list.find((r) => r.id === id))
        )
      );

      const found: Resource[] = [];
      const map = new Map<string, Resource>();

      results.forEach((result, index) => {
        if (result.status === "fulfilled" && result.value) {
          found.push(result.value);
          map.set(favorites[index], result.value);
        }
      });

      // Preserve the original favorite order.
      const ordered = favorites
        .map((id) => map.get(id))
        .filter((r): r is Resource => !!r);

      setResources(ordered);
      setResourceMap(map);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load favorited resources.";
      setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [favorites]);

  useEffect(() => {
    void loadFavoritedResources();
  }, [loadFavoritedResources]);

  const handleToggleFavorite = useCallback(
    async (resourceId: string) => {
      await toggleFavorite(resourceId);
      setToast(
        isFavorite(resourceId)
          ? "Removed from favorites"
          : "Added to favorites"
      );
    },
    [isFavorite, toggleFavorite]
  );

  const renderEmpty = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyTitle}>No favorites yet</Text>
      <Text style={styles.emptyBody}>
        Favorite resources from the catalog to see them here.
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={shared.screen} edges={["top", "left", "right"]}>
      <StatusBar style="auto" />
      <FlatList
        data={loading ? null : resources}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void loadFavoritedResources(true)}
          />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={typography.title}>Favorites</Text>
            <Text style={typography.subtitle}>
              Your favorited resources
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const fav = isFavorite(item.id);
          return (
            <ResourceCard
              resource={item}
              onCopyUrl={setToast}
              onPress={() =>
                navigation.navigate("ResourceDetail", { resourceId: item.id })
              }
              onRegister={() => {
                // Placeholder for future registration flow
              }}
              onFavoritePress={() => handleToggleFavorite(item.id)}
              isFavorite={fav}
            />
          );
        }}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          loading ? null : renderEmpty()
        }
      />

      {error ? (
        <ErrorBanner message={error} onRetry={() => void loadFavoritedResources()} />
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

      <Text style={{ ...styles.subtitle, marginTop: spacing.lg }}>
        API: {getApiBaseUrl()}
      </Text>
    </SafeAreaView>
  );
}
