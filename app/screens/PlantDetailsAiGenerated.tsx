import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Alert, Image, Platform, ScrollView, Share, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import * as Notifications from "expo-notifications";
import { useTheme } from "../../constants/theme";
import { getPlantTips } from "../../utilities/fetchPlantTips";
import { fetchPlantImage } from "../../utilities/fetchPlantImage";
import { CardSkeleton } from "../../components/SkeletonLoader";
import { getPlantDetailsFromCache, savePlantDetailsToCache, getPlantImageFromCache, savePlantImageToCache } from "../../logic/cacheLogic";
import { scheduleWateringReminder, cancelWateringReminder, getWateringReminder, WateringReminder } from "../../logic/reminderLogic";
import { addToCollection, removeFromCollection, getCollectionEntry, updateCollectionEntry } from "../../logic/collectionLogic";
import { logWatering, getWateringLog, formatRelativeDate } from "../../logic/wateringLogic";
import type { CollectionEntry, OwnershipStatus, PlantDetails } from "../../types";

const REMINDER_OPTIONS = [
  { days: 3,  label: '3 days' },
  { days: 7,  label: '7 days' },
  { days: 14, label: '14 days' },
  { days: 30, label: '30 days' },
];

const STATUS_OPTIONS: { status: OwnershipStatus; label: string }[] = [
  { status: 'own',   label: 'Own it'   },
  { status: 'want',  label: 'Want it'  },
  { status: 'tried', label: 'Tried it' },
];

const STATUS_COLORS: Record<OwnershipStatus, string> = {
  own:   '#059669',
  want:  '#d97706',
  tried: '#64748b',
};

const STATUS_LABELS: Record<OwnershipStatus, string> = {
  own:   'Own it',
  want:  'Want it',
  tried: 'Tried it',
};

const CARD_ORDER: (keyof PlantDetails)[] = ['watering', 'light', 'fertilizer'];

export default function PlantDetailsAiGenerated() {
  const { plantName, summary: summaryParam } = useLocalSearchParams();
  const safePlantName = Array.isArray(plantName) ? plantName[0] : plantName;
  const routeSummary = Array.isArray(summaryParam) ? summaryParam[0] : (summaryParam ?? '');
  const router = useRouter();
  const theme = useTheme();
  const d = useMemo(() => styles(theme), [theme]);

  const [details, setDetails] = useState<PlantDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [activeReminder, setActiveReminder] = useState<WateringReminder | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [collectionEntry, setCollectionEntry] = useState<CollectionEntry | null>(null);
  const [showAddPicker, setShowAddPicker] = useState(false);
  const [showEditSection, setShowEditSection] = useState(false);
  const [draftStatus, setDraftStatus] = useState<OwnershipStatus>('own');
  const [draftRating, setDraftRating] = useState<number | undefined>(undefined);
  const [draftNotes, setDraftNotes] = useState('');
  const [wateringLog, setWateringLog] = useState<number[]>([]);

  const fetchDetails = async (name: string) => {
    setLoading(true);
    setError(null);

    try {
      const cachedData = await getPlantDetailsFromCache(name);
      if (cachedData) {
        setDetails(cachedData);
        return;
      }

      const apiData = await getPlantTips(name);
      await savePlantDetailsToCache(name, apiData.details);
      setDetails(apiData.details);
    } catch (err: any) {
      const msg = err?.message ?? '';
      if (msg.includes('429')) {
        setError('Too many requests — wait a moment and try again.');
      } else if (msg.includes('502')) {
        setError('The AI service returned an unexpected response. Please try again.');
      } else if (msg.includes('Server error')) {
        setError('The server hit an error. Try again shortly.');
      } else {
        setError('Could not load plant details. Check your internet connection.');
      }
    } finally {
      setLoading(false);
    }
  };

  const loadImage = async (name: string) => {
    const cached = await getPlantImageFromCache(name);
    if (cached !== undefined) {
      setImageUrl(cached);
      return;
    }
    const url = await fetchPlantImage(name);
    setImageUrl(url);
    await savePlantImageToCache(name, url);
  };

  const loadReminder = async (name: string) => {
    try {
      const reminder = await getWateringReminder(name);
      setActiveReminder(reminder);
    } catch {
      // AsyncStorage failure is non-fatal — reminder section simply stays hidden
    }
  };

  const loadCollectionEntry = async (name: string) => {
    try {
      setCollectionEntry(await getCollectionEntry(name));
    } catch {}
  };

  const loadWateringLog = async (name: string) => {
    try {
      setWateringLog(await getWateringLog(name));
    } catch {}
  };

  const handleLogWatering = async () => {
    if (!safePlantName) return;
    await logWatering(safePlantName);
    setWateringLog(await getWateringLog(safePlantName));
  };

  const handleShare = async () => {
    if (!details || !safePlantName) return;
    try {
      await Share.share({
        title: `${safePlantName} Care Tips`,
        message: [
          `🌿 ${safePlantName} Care Tips`,
          '',
          `💧 Watering\n${details.watering}`,
          '',
          `☀️ Light\n${details.light}`,
          '',
          `🌱 Fertilizer\n${details.fertilizer}`,
          '',
          'Shared from LeafyAI',
        ].join('\n'),
      });
    } catch {}
  };

  const handleSaveToCollection = async (status: OwnershipStatus) => {
    if (!safePlantName) return;
    const entry: CollectionEntry = { name: safePlantName, summary: routeSummary, details: details ?? undefined, addedAt: Date.now(), status };
    await addToCollection(entry);
    setCollectionEntry(entry);
    setShowAddPicker(false);
  };

  const handleRemoveFromCollection = async () => {
    if (!safePlantName) return;
    await removeFromCollection(safePlantName);
    setCollectionEntry(null);
    setShowEditSection(false);
  };

  const handleUpdateCollection = async () => {
    if (!safePlantName) return;
    const patch = { status: draftStatus, rating: draftRating, notes: draftNotes || undefined };
    await updateCollectionEntry(safePlantName, patch);
    setCollectionEntry(prev => prev ? { ...prev, ...patch } : null);
    setShowEditSection(false);
  };

  const openEditSection = () => {
    if (!collectionEntry) return;
    setDraftStatus(collectionEntry.status);
    setDraftRating(collectionEntry.rating);
    setDraftNotes(collectionEntry.notes ?? '');
    setShowEditSection(true);
  };

  const confirmSetReminder = async (days: number) => {
    try {
      await scheduleWateringReminder(safePlantName!, days);
      setActiveReminder({ id: '', intervalDays: days });
      setShowPicker(false);
    } catch {
      Alert.alert(
        'Notifications unavailable',
        'Allow notifications in your device settings to set watering reminders.',
      );
    }
  };

  const handleSetReminder = async (days: number) => {
    const { status } = await Notifications.getPermissionsAsync();
    if (status === 'undetermined') {
      Alert.alert(
        'Allow Notifications',
        `LeafyAI will remind you to water your ${safePlantName} every ${days} days.`,
        [
          { text: 'Not now', style: 'cancel' },
          { text: 'Continue', onPress: () => confirmSetReminder(days) },
        ],
      );
      return;
    }
    await confirmSetReminder(days);
  };

  const handleCancelReminder = async () => {
    await cancelWateringReminder(safePlantName!);
    setActiveReminder(null);
  };

  useEffect(() => {
    if (safePlantName) {
      fetchDetails(safePlantName);
      loadImage(safePlantName);
      loadReminder(safePlantName);
      loadCollectionEntry(safePlantName);
      loadWateringLog(safePlantName);
    }
  }, [safePlantName]);

  const inCollection = collectionEntry !== null;

  if (!safePlantName) {
    return (
      <View style={d.container}>
        <View style={d.topBar}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={d.backText}>← Back to Search</Text>
          </TouchableOpacity>
        </View>
        <View style={d.errorContainer}>
          <Text style={d.errorIcon}>🌿</Text>
          <Text style={d.errorText}>No plant selected.</Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={d.container} contentContainerStyle={d.content}>
      <View style={d.topBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={d.backText}>← Back to Search</Text>
        </TouchableOpacity>
        {details && (
          <TouchableOpacity onPress={handleShare} style={d.shareBtn}>
            <Text style={d.shareBtnText}>Share</Text>
          </TouchableOpacity>
        )}
      </View>

      {imageUrl && (
        <Animated.View entering={FadeIn.duration(600)} style={d.heroWrapper}>
          <Image source={{ uri: imageUrl }} style={d.heroImage} resizeMode="cover" />
        </Animated.View>
      )}

      <Text style={d.headerTitle}>{safePlantName}</Text>
      <View style={d.divider} />

      {error ? (
        <View style={d.errorContainer}>
          <Text style={d.errorIcon}>⚠️</Text>
          <Text style={d.errorText}>{error}</Text>
          <TouchableOpacity style={d.retryButton} onPress={() => fetchDetails(safePlantName)}>
            <Text style={d.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : loading ? (
        <CardSkeleton />
      ) : (
        <View>
          {CARD_ORDER.map((key, i) => {
            const value = details?.[key];
            if (!value) return null;
            return (
              <Animated.View key={key} entering={FadeInDown.delay(i * 100).duration(400)} style={d.card}>
                <Text style={d.cardLabel}>{key}</Text>
                <Text style={d.cardValue}>{value}</Text>
              </Animated.View>
            );
          })}

          {!inCollection && !showAddPicker && (
            <TouchableOpacity style={d.collectionBtn} onPress={() => setShowAddPicker(true)}>
              <Text style={d.collectionBtnText}>+ Save to Collection</Text>
            </TouchableOpacity>
          )}

          {!inCollection && showAddPicker && (
            <View style={d.collectionPicker}>
              <Text style={d.collectionPickerLabel}>Add to collection as:</Text>
              <View style={d.statusRow}>
                {STATUS_OPTIONS.map(opt => (
                  <TouchableOpacity
                    key={opt.status}
                    style={[d.statusPill, draftStatus === opt.status && d.statusPillActive]}
                    onPress={() => setDraftStatus(opt.status)}
                  >
                    <Text style={[d.statusPillText, draftStatus === opt.status && d.statusPillActiveText]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity style={d.collectionBtnSaved} onPress={() => handleSaveToCollection(draftStatus)}>
                <Text style={d.collectionBtnSavedText}>Save</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowAddPicker(false)} style={d.dismissLink}>
                <Text style={d.dismissLinkText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          )}

          {inCollection && !showEditSection && (
            <View style={d.collectionSaved}>
              <View style={d.collectionSavedLeft}>
                <Text style={d.collectionSavedIcon}>🪴</Text>
                <View>
                  <Text style={d.collectionSavedTitle}>Saved to Collection</Text>
                  <View style={d.collectionSavedMeta}>
                    <Text style={[d.statusBadgeText, { color: STATUS_COLORS[collectionEntry!.status] }]}>
                      {STATUS_LABELS[collectionEntry!.status]}
                    </Text>
                    {collectionEntry?.rating != null && (
                      <Text style={d.ratingSmall}>
                        {'  '}{'★'.repeat(collectionEntry.rating)}{'☆'.repeat(5 - collectionEntry.rating)}
                      </Text>
                    )}
                  </View>
                </View>
              </View>
              <TouchableOpacity onPress={openEditSection}>
                <Text style={d.editLinkText}>Edit</Text>
              </TouchableOpacity>
            </View>
          )}

          {inCollection && showEditSection && (
            <View style={d.editSection}>
              <Text style={d.editSectionLabel}>STATUS</Text>
              <View style={d.statusRow}>
                {STATUS_OPTIONS.map(opt => (
                  <TouchableOpacity
                    key={opt.status}
                    style={[d.statusPill, draftStatus === opt.status && d.statusPillActive]}
                    onPress={() => setDraftStatus(opt.status)}
                  >
                    <Text style={[d.statusPillText, draftStatus === opt.status && d.statusPillActiveText]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={d.editSectionLabel}>RATING</Text>
              <View style={d.starRow}>
                {[1, 2, 3, 4, 5].map(n => (
                  <TouchableOpacity key={n} onPress={() => setDraftRating(draftRating === n ? undefined : n)}>
                    <Text style={d.star}>{n <= (draftRating ?? 0) ? '★' : '☆'}</Text>
                  </TouchableOpacity>
                ))}
                {draftRating != null && (
                  <TouchableOpacity onPress={() => setDraftRating(undefined)} style={d.clearRating}>
                    <Text style={d.clearRatingText}>Clear</Text>
                  </TouchableOpacity>
                )}
              </View>
              <Text style={d.editSectionLabel}>NOTES</Text>
              <TextInput
                style={d.notesInput}
                value={draftNotes}
                onChangeText={setDraftNotes}
                placeholder="Personal notes..."
                placeholderTextColor={theme.textMuted}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
              <TouchableOpacity style={d.collectionBtnSaved} onPress={handleUpdateCollection}>
                <Text style={d.collectionBtnSavedText}>Save Changes</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleRemoveFromCollection} style={d.dismissLink}>
                <Text style={d.removeLinkText}>Remove from Collection</Text>
              </TouchableOpacity>
            </View>
          )}

          {Platform.OS !== 'web' && (
            <View style={d.reminderSection}>
              {!showPicker && !activeReminder && (
                <TouchableOpacity style={d.reminderSetBtn} onPress={() => setShowPicker(true)}>
                  <Text style={d.reminderSetText}>💧 Set Watering Reminder</Text>
                </TouchableOpacity>
              )}

              {showPicker && (
                <View style={d.reminderPicker}>
                  <Text style={d.reminderPickerLabel}>Remind me every:</Text>
                  <View style={d.reminderOptionsRow}>
                    {REMINDER_OPTIONS.map(opt => (
                      <TouchableOpacity
                        key={opt.days}
                        style={d.reminderOption}
                        onPress={() => handleSetReminder(opt.days)}
                      >
                        <Text style={d.reminderOptionText}>{opt.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <TouchableOpacity onPress={() => setShowPicker(false)}>
                    <Text style={d.reminderDismiss}>Dismiss</Text>
                  </TouchableOpacity>
                </View>
              )}

              {activeReminder && (
                <View style={d.reminderActive}>
                  <Text style={d.reminderActiveText}>
                    💧 Reminder every {activeReminder.intervalDays} days
                  </Text>
                  <TouchableOpacity onPress={handleCancelReminder}>
                    <Text style={d.reminderDismiss}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          <View style={d.logSection}>
            <TouchableOpacity style={d.logBtn} onPress={handleLogWatering}>
              <Text style={d.logBtnText}>💧 Log Watering</Text>
            </TouchableOpacity>

            {wateringLog.length > 0 && (
              <View style={d.logHistory}>
                <Text style={d.logHistoryLabel}>WATERING HISTORY</Text>
                {wateringLog.slice(0, 5).map((ts, i) => (
                  <View
                    key={ts}
                    style={[d.logEntry, i < Math.min(wateringLog.length, 5) - 1 && d.logEntryBorder]}
                  >
                    <View style={d.logDot} />
                    <Text style={d.logEntryDate}>{formatRelativeDate(ts)}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = (t: ReturnType<typeof useTheme>) => StyleSheet.create({
  container:       { flex: 1, backgroundColor: t.surface },
  content:         { padding: 24, paddingTop: 60 },
  topBar:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  shareBtn:        { padding: 8 },
  shareBtnText:    { color: t.accent, fontWeight: '700', fontSize: 16 },
  heroWrapper:     { width: '100%', height: 220, borderRadius: 20, marginBottom: 24, backgroundColor: t.border, overflow: 'hidden' },
  heroImage:       { width: '100%', height: '100%' },
  backText:        { color: t.accent, fontWeight: '700', fontSize: 16 },
  headerTitle:     { fontSize: 40, fontWeight: '900', color: t.textHeading },
  divider:         { height: 6, width: 60, backgroundColor: t.accentMid, borderRadius: 3, marginVertical: 16 },
  card:            { backgroundColor: t.background, padding: 20, borderRadius: 24, marginBottom: 16, borderLeftWidth: 5, borderLeftColor: t.accentMid },
  cardLabel:       { fontSize: 12, fontWeight: '900', color: t.accent, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8 },
  cardValue:       { fontSize: 17, color: t.textBody, lineHeight: 26 },
  collectionBtn:           { backgroundColor: t.surface, borderWidth: 1.5, borderColor: t.accent, padding: 16, borderRadius: 20, alignItems: 'center', marginBottom: 12 },
  collectionBtnText:       { color: t.accent, fontWeight: '700', fontSize: 15 },
  collectionBtnSaved:      { backgroundColor: t.surfaceGreenSubtle, borderWidth: 1.5, borderColor: t.accentMid, padding: 16, borderRadius: 20, alignItems: 'center', marginBottom: 12 },
  collectionBtnSavedText:  { color: t.accentDark, fontWeight: '700', fontSize: 15 },
  reminderSection:     { marginTop: 8 },
  reminderSetBtn:      { backgroundColor: t.surfaceGreenSubtle, borderWidth: 1, borderColor: t.accent, padding: 16, borderRadius: 20, alignItems: 'center' },
  reminderSetText:     { color: t.accentDark, fontWeight: '700', fontSize: 15 },
  reminderPicker:      { backgroundColor: t.surfaceGreenSubtle, borderWidth: 1, borderColor: t.borderGreen, padding: 20, borderRadius: 20 },
  reminderPickerLabel: { fontSize: 13, fontWeight: '700', color: t.textSecondary, marginBottom: 12 },
  reminderOptionsRow:  { flexDirection: 'row', gap: 10, marginBottom: 16 },
  reminderOption:      { backgroundColor: t.surface, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 100, borderWidth: 1, borderColor: t.border },
  reminderOptionText:  { color: t.textPrimary, fontWeight: '600', fontSize: 14 },
  reminderActive:      { backgroundColor: t.surfaceGreenSubtle, borderWidth: 1, borderColor: t.borderGreen, padding: 16, borderRadius: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  reminderActiveText:  { color: t.accentDark, fontWeight: '600', fontSize: 14 },
  reminderDismiss:     { color: t.danger, fontSize: 13, fontWeight: '600' },
  logSection:      { marginTop: 16, paddingBottom: 16 },
  logBtn:          { backgroundColor: t.accent, padding: 16, borderRadius: 20, alignItems: 'center', marginBottom: 16 },
  logBtnText:      { color: '#fff', fontWeight: '700', fontSize: 15 },
  logHistory:      { backgroundColor: t.background, borderRadius: 20, padding: 16 },
  logHistoryLabel: { fontSize: 12, fontWeight: '800', color: t.textMuted, letterSpacing: 1, marginBottom: 12 },
  logEntry:        { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  logEntryBorder:  { borderBottomWidth: 1, borderBottomColor: t.border },
  logDot:          { width: 8, height: 8, borderRadius: 4, backgroundColor: t.accentMid, marginRight: 12 },
  logEntryDate:    { fontSize: 15, color: t.textBody },
  errorContainer:  { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  errorIcon:       { fontSize: 50, marginBottom: 20 },
  errorText:       { fontSize: 16, color: t.textSecondary, textAlign: 'center', marginBottom: 24, lineHeight: 22 },
  retryButton:     { backgroundColor: t.accent, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
  retryButtonText: { color: 'white', fontWeight: '700', fontSize: 16 },
  // collection - add picker
  collectionPicker:      { backgroundColor: t.surfaceGreenSubtle, borderWidth: 1, borderColor: t.borderGreen, padding: 20, borderRadius: 20, marginBottom: 12 },
  collectionPickerLabel: { fontSize: 13, fontWeight: '700', color: t.textSecondary, marginBottom: 12 },
  statusRow:             { flexDirection: 'row' as const, gap: 8, marginBottom: 16, flexWrap: 'wrap' as const },
  statusPill:            { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 100, borderWidth: 1.5, borderColor: t.border, backgroundColor: t.surface },
  statusPillActive:      { borderColor: t.accent, backgroundColor: t.surfaceGreenSubtle },
  statusPillText:        { color: t.textSecondary, fontWeight: '600' as const, fontSize: 14 },
  statusPillActiveText:  { color: t.accentDark },
  dismissLink:           { alignItems: 'center' as const, paddingVertical: 10 },
  dismissLinkText:       { color: t.textMuted, fontSize: 13, fontWeight: '600' as const },
  // collection - saved row
  collectionSaved:      { backgroundColor: t.surfaceGreenSubtle, borderWidth: 1.5, borderColor: t.accentMid, padding: 16, borderRadius: 20, flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const, marginBottom: 12 },
  collectionSavedLeft:  { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12, flex: 1 },
  collectionSavedIcon:  { fontSize: 24 },
  collectionSavedTitle: { fontSize: 14, fontWeight: '700' as const, color: t.accentDark },
  collectionSavedMeta:  { flexDirection: 'row' as const, alignItems: 'center' as const, marginTop: 2 },
  statusBadgeText:      { fontSize: 13, fontWeight: '600' as const },
  ratingSmall:          { fontSize: 13, color: t.textMuted },
  editLinkText:         { color: t.accent, fontWeight: '700' as const, fontSize: 14 },
  // collection - edit section
  editSection:      { backgroundColor: t.surface, borderWidth: 1, borderColor: t.border, padding: 20, borderRadius: 20, marginBottom: 12 },
  editSectionLabel: { fontSize: 11, fontWeight: '800' as const, color: t.textMuted, letterSpacing: 1, marginBottom: 8, marginTop: 4 },
  starRow:          { flexDirection: 'row' as const, gap: 4, alignItems: 'center' as const, marginBottom: 16 },
  star:             { fontSize: 28, color: t.accent },
  clearRating:      { marginLeft: 8 },
  clearRatingText:  { fontSize: 12, color: t.textMuted },
  notesInput:       { backgroundColor: t.background, borderWidth: 1, borderColor: t.border, borderRadius: 12, padding: 12, fontSize: 15, color: t.textPrimary, minHeight: 80, marginBottom: 16 },
  removeLinkText:   { color: t.danger, fontSize: 13, fontWeight: '600' as const, textAlign: 'center' as const, paddingVertical: 4 },
});
