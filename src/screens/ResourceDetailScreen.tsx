import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as Clipboard from "expo-clipboard";
import * as Sharing from "expo-sharing";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { fetchResource, ResourceFetchError } from "../api/resources";
import { accessResource } from "../api/payment";
import type { RootStackParamList } from "../navigation";
import type { Resource } from "../types";
import { getResourceTypeLabel } from "../types";
import { spacing } from "../theme";
import type { ThemeColors } from "../theme";
import { useAppTheme } from "../theme/ThemeProvider";
import { openExternalUrl, stellarExpertAccountUrl, stellarExpertTxUrl } from "../utils/stellarExpert";
import { useRecentlyViewed } from "../hooks/useRecentlyViewed";
import { useResourceNotes } from "../hooks/useResourceNotes";

type Props = NativeStackScreenProps<RootStackParamList, "ResourceDetail">;

function shortenAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function verificationStyle(status: Resource["verificationStatus"], colors: ThemeColors) {
  switch (status) {
    case "verified":
      return { backgroundColor: colors.successBg, color: colors.success };
    case "rejected":
      return { backgroundColor: colors.dangerBg, color: colors.danger };
    default:
      return { backgroundColor: colors.neutralBg, color: colors.textMuted };
  }
}

function onchainStyle(status: Resource["onchainStatus"], colors: ThemeColors) {
  switch (status) {
    case "registered":
      return { backgroundColor: colors.primaryMuted, color: colors.primary };
    case "failed":
      return { backgroundColor: colors.dangerBg, color: colors.danger };
    case "pending":
      return { backgroundColor: colors.warningBg, color: colors.warning };
    default:
      return { backgroundColor: colors.neutralBg, color: colors.textSubtle };
  }
}

function formatTimestamp(value: string | undefined): string | null {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return date.toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function getResourceTimestamp(resource: Resource): { label: string; text: string } | null {
  const updatedAt = formatTimestamp(resource.updatedAt);
  if (updatedAt) return { label: "Last updated", text: updatedAt };

  const publishedAt = formatTimestamp(resource.publishedAt);
  if (publishedAt) return { label: "Published", text: publishedAt };

  return null;
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    centered: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: spacing.lg,
      gap: spacing.md,
    },
    errorText: {
      color: colors.danger,
      fontSize: 16,
      fontWeight: "500",
    },
    content: {
      padding: spacing.lg,
      paddingBottom: spacing.xxl,
      gap: spacing.md,
    },
    price: {
      fontSize: 24,
    },
    badges: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
    },
    infoRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    label: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.textMuted,
    },
    metadata: {
      color: colors.textSubtle,
      fontSize: 14,
      lineHeight: 20,
    },
    actionButton: {
      alignSelf: "stretch",
      alignItems: "center",
      paddingVertical: 12,
    },
    urlText: {
      fontSize: 13,
      color: colors.textSubtle,
      lineHeight: 18,
      flexShrink: 1,
    },
    linkText: {
      color: colors.primary,
    },
    mono: {
      fontFamily: "monospace",
      fontSize: 12,
      maxWidth: 220,
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
    accessPanel: {
      marginTop: spacing.lg,
      padding: spacing.md,
      backgroundColor: colors.primaryMuted,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.primary,
      gap: spacing.md,
    },
    accessPanelTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.primary,
    },
    accessPanelContent: {
      fontSize: 13,
      color: colors.text,
      lineHeight: 20,
    },
    accessPanelExternal: {
      alignSelf: "flex-start",
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: colors.primary,
      borderRadius: 8,
    },
    accessPanelExternalText: {
      color: "#ffffff",
      fontWeight: "600",
      fontSize: 13,
    },
    accessPanelClose: {
      alignSelf: "flex-start",
      paddingHorizontal: 12,
      paddingVertical: 6,
      backgroundColor: colors.neutralBg,
      borderRadius: 8,
    },
    accessPanelCloseText: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: "600",
    },
    // Notes section
    notesSection: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: spacing.md,
      gap: spacing.sm,
    },
    notesSectionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    notesLabel: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.text,
    },
    notesEditButton: {
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: 8,
      backgroundColor: colors.neutralBg,
    },
    notesEditButtonText: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.primary,
    },
    notesInput: {
      minHeight: 90,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      padding: spacing.sm,
      fontSize: 14,
      color: colors.text,
      backgroundColor: colors.surface,
      textAlignVertical: "top",
    },
    notesInputFocused: {
      borderColor: colors.primary,
    },
    notesSaveRow: {
      flexDirection: "row",
      gap: spacing.sm,
      justifyContent: "flex-end",
    },
    notesSaveButton: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: 8,
      backgroundColor: colors.primary,
    },
    notesSaveButtonText: {
      fontSize: 13,
      fontWeight: "600",
      color: "#ffffff",
    },
    notesCancelButton: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: 8,
      backgroundColor: colors.neutralBg,
    },
    notesCancelButtonText: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.textMuted,
    },
    notesDeleteButton: {
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: 8,
      backgroundColor: colors.dangerBg,
    },
    notesDeleteButtonText: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.danger,
    },
    notesText: {
      fontSize: 14,
      color: colors.text,
      lineHeight: 20,
    },
    notesEmpty: {
      fontSize: 13,
      color: colors.textSubtle,
      fontStyle: "italic",
    },
  });
}

export function ResourceDetailScreen({ route, navigation }: Props) {
  const { colors, shared, typography } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const { resourceId } = route.params;
  const [resource, setResource] = useState<Resource | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isTransientError, setIsTransientError] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [accessResult, setAccessResult] = useState<{
    type: "text";
    content: string;
  } | { type: "external"; url: string } | null>(null);
  const [accessing, setAccessing] = useState(false);

  // Notes state
  const { getNote, setNote, deleteNote } = useResourceNotes();
  const [editingNote, setEditingNote] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [noteFocused, setNoteFocused] = useState(false);

  // Recently viewed tracking
  const { addRecentlyViewed } = useRecentlyViewed();

  const loadResource = useCallback(async () => {
    setLoading(true);
    setError(null);
    setIsTransientError(false);
    try {
      const data = await fetchResource(resourceId);
      setResource(data);
      navigation.setOptions({ title: data.title });
      // Track this resource as recently viewed.
      void addRecentlyViewed(resourceId);
    } catch (err) {
      if (err instanceof ResourceFetchError) {
        setError(err.message);
        setIsTransientError(err.isTransient);
      } else {
        setError("An unexpected error occurred.");
        setIsTransientError(true);
      }
    } finally {
      setLoading(false);
    }
  }, [resourceId, navigation, addRecentlyViewed]);

  useEffect(() => {
    void loadResource();
  }, [loadResource]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    setAccessResult(null);
  }, [resource]);

  // Sync note draft when entering edit mode
  const handleStartEditNote = useCallback(() => {
    setNoteDraft(getNote(resourceId));
    setEditingNote(true);
  }, [getNote, resourceId]);

  const handleSaveNote = useCallback(async () => {
    await setNote(resourceId, noteDraft);
    setEditingNote(false);
    setToast(noteDraft.trim() ? "Note saved" : "Note cleared");
  }, [resourceId, noteDraft, setNote]);

  const handleCancelEditNote = useCallback(() => {
    setEditingNote(false);
    setNoteDraft("");
  }, []);

  const handleDeleteNote = useCallback(async () => {
    await deleteNote(resourceId);
    setEditingNote(false);
    setToast("Note deleted");
  }, [deleteNote, resourceId]);

  async function handleAccess() {
    if (!resource) return;
    setAccessing(true);
    setError(null);
    try {
      const result = await accessResource(resource.accessUrl);
      setAccessResult(result);
      if (result.type === "external") {
        await openExternalUrl(result.url).catch(() =>
          setToast("Unable to open external link")
        );
      } else {
        setToast("Resource content retrieved");
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to access resource.";
      setError(message);
    } finally {
      setAccessing(false);
    }
  }

  async function handleCopy() {
    if (!resource) return;
    await Clipboard.setStringAsync(resource.accessUrl);
    setToast("Resource URL copied");
  }

  async function handleShare() {
    if (!resource) return;
    try {
      await Sharing.shareAsync(resource.accessUrl);
    } catch {
      setToast("Unable to share URL");
    }
  }

  function handleOpenOwner() {
    if (!resource) return;
    const url = stellarExpertAccountUrl({ accountId: resource.walletAddress });
    openExternalUrl(url).catch(() => setToast("Unable to open explorer"));
  }

  function handleOpenTx() {
    if (!resource?.onchainTxHash) return;
    const url = stellarExpertTxUrl({ txHash: resource.onchainTxHash });
    openExternalUrl(url).catch(() => setToast("Unable to open explorer"));
  }

  if (loading) {
    return (
      <SafeAreaView style={shared.screen} edges={["bottom"]}>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !resource) {
    return (
      <SafeAreaView style={shared.screen} edges={["bottom"]}>
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
          {isTransientError ? (
            <Pressable
              style={[shared.button, shared.primaryButton]}
              onPress={() => void loadResource()}
            >
              <Text style={[shared.buttonText, shared.primaryButtonText]}>
                Try Again
              </Text>
            </Pressable>
          ) : null}
          <Pressable
            style={[shared.button, isTransientError ? undefined : shared.primaryButton]}
            onPress={() => navigation.goBack()}
          >
            <Text
              style={[
                shared.buttonText,
                isTransientError ? undefined : shared.primaryButtonText,
              ]}
            >
              Go Back
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const verification = verificationStyle(resource.verificationStatus, colors);
  const onchain = onchainStyle(resource.onchainStatus, colors);
  const timestamp = getResourceTimestamp(resource);
  const existingNote = getNote(resourceId);

  return (
    <SafeAreaView style={shared.screen} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={typography.subtitle}>Resource</Text>
        <Text style={typography.title}>{resource.title}</Text>

        {resource.publisherName ? (
          <Text style={typography.body}>Published by {resource.publisherName}</Text>
        ) : null}

        {timestamp ? (
          <Text style={styles.metadata}>
            {timestamp.label} {timestamp.text}
          </Text>
        ) : null}

        <View style={styles.badges}>
          <View style={[shared.badge, { backgroundColor: verification.backgroundColor }]}>
            <Text style={[shared.badgeText, { color: verification.color }]}>
              {resource.verificationStatus}
            </Text>
          </View>
          <View style={[shared.badge, { backgroundColor: onchain.backgroundColor }]}>
            <Text style={[shared.badgeText, { color: onchain.color }]}>
              {resource.onchainStatus === "none"
                ? "not on-chain"
                : resource.onchainStatus}
            </Text>
          </View>
        </View>

        <Text style={[typography.price, styles.price]}>
          {resource.price} USDC
        </Text>

        <View style={styles.infoRow}>
          <Text style={styles.label}>Owner</Text>
          <Pressable onPress={handleOpenOwner}>
            <Text style={[typography.body, styles.linkText]}>
              {shortenAddress(resource.walletAddress)}
            </Text>
          </Pressable>
        </View>

        {resource.onchainTxHash ? (
          <View style={styles.infoRow}>
            <Text style={styles.label}>Tx</Text>
            <Pressable onPress={handleOpenTx}>
              <Text
                style={[typography.body, styles.linkText, styles.mono]}
                numberOfLines={1}
                ellipsizeMode="middle"
              >
                {resource.onchainTxHash}
              </Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.infoRow}>
          <Text style={styles.label}>Type</Text>
          <Text style={typography.body}>{getResourceTypeLabel(resource.resourceType)}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.label}>Access URL</Text>
        </View>
        <Text style={styles.urlText} selectable={true}>
          {resource.accessUrl}
        </Text>

        <Pressable
          style={[shared.button, shared.primaryButton, styles.actionButton]}
          onPress={handleCopy}
        >
          <Text style={[shared.buttonText, shared.primaryButtonText]}>
            Copy Access URL
          </Text>
        </Pressable>

        <Pressable
          style={[shared.button, styles.actionButton]}
          onPress={handleShare}
        >
          <Text style={shared.buttonText}>Share Access URL</Text>
        </Pressable>

        <Pressable
          style={[
            shared.button,
            styles.actionButton,
            accessing && { opacity: 0.6 },
          ]}
          onPress={handleAccess}
          disabled={accessing}
        >
          <Text style={shared.buttonText}>
            {accessing ? "Accessing…" : "Access Resource"}
          </Text>
        </Pressable>

        {/* Personal Notes Section */}
        <View style={styles.notesSection}>
          <View style={styles.notesSectionHeader}>
            <Text style={styles.notesLabel}>My Notes</Text>
            {!editingNote && (
              <Pressable style={styles.notesEditButton} onPress={handleStartEditNote}>
                <Text style={styles.notesEditButtonText}>
                  {existingNote ? "Edit" : "Add Note"}
                </Text>
              </Pressable>
            )}
          </View>

          {editingNote ? (
            <>
              <TextInput
                style={[styles.notesInput, noteFocused && styles.notesInputFocused]}
                value={noteDraft}
                onChangeText={setNoteDraft}
                onFocus={() => setNoteFocused(true)}
                onBlur={() => setNoteFocused(false)}
                placeholder="Add a personal note about this resource…"
                placeholderTextColor={colors.textSubtle}
                multiline
                maxLength={2000}
              />
              <View style={styles.notesSaveRow}>
                {existingNote ? (
                  <Pressable
                    style={styles.notesDeleteButton}
                    onPress={() => void handleDeleteNote()}
                  >
                    <Text style={styles.notesDeleteButtonText}>Delete</Text>
                  </Pressable>
                ) : null}
                <Pressable style={styles.notesCancelButton} onPress={handleCancelEditNote}>
                  <Text style={styles.notesCancelButtonText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={styles.notesSaveButton}
                  onPress={() => void handleSaveNote()}
                >
                  <Text style={styles.notesSaveButtonText}>Save</Text>
                </Pressable>
              </View>
            </>
          ) : existingNote ? (
            <Text style={styles.notesText}>{existingNote}</Text>
          ) : (
            <Text style={styles.notesEmpty}>No notes yet. Tap "Add Note" to jot something down.</Text>
          )}
        </View>
      </ScrollView>

      {toast ? (
        <View style={styles.toast}>
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      ) : null}

      {accessResult ? (
        <View style={styles.accessPanel}>
          <Text style={styles.accessPanelTitle}>
            {accessResult.type === "text" ? "Resource Content" : "External Link"}
          </Text>
          {accessResult.type === "text" ? (
            <Text style={styles.accessPanelContent} selectable={true} numberOfLines={10}>
              {accessResult.content}
            </Text>
          ) : (
            <Pressable
              style={styles.accessPanelExternal}
              onPress={() => {
                void openExternalUrl(accessResult.url).catch(() =>
                  setToast("Unable to open link")
                );
              }}
            >
              <Text style={styles.accessPanelExternalText}>Open in browser →</Text>
            </Pressable>
          )}
          <Pressable
            style={styles.accessPanelClose}
            onPress={() => setAccessResult(null)}
          >
            <Text style={styles.accessPanelCloseText}>Dismiss</Text>
          </Pressable>
        </View>
      ) : null}
    </SafeAreaView>
  );
}
