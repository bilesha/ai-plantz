import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Alert, Image, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useTheme } from "../../constants/theme";
import { getPlantTips } from "../../utilities/fetchPlantTips";
import { fetchPlantImage } from "../../utilities/fetchPlantImage";
import { CardSkeleton } from "../../components/SkeletonLoader";
import { getPlantDetailsFromCache, savePlantDetailsToCache, getPlantImageFromCache, savePlantImageToCache } from "../logic/cacheLogic";
import { scheduleWateringReminder, cancelWateringReminder, getWateringReminder, WateringReminder } from "../logic/reminderLogic";
import { PlantDetails } from "../types";

const REMINDER_OPTIONS = [
  { days: 3,  label: '3 days' },
  { days: 7,  label: '7 days' },
  { days: 14, label: '14 days' },
  { days: 30, label: '30 days' },
];

const CARD_ORDER: (keyof PlantDetails)[] = ['watering', 'light', 'fertilizer'];

export default function PlantDetailsAiGenerated() {
  const { plantName } = useLocalSearchParams();
  const safePlantName = Array.isArray(plantName) ? plantName[0] : plantName;
  const router = useRouter();
  const theme = useTheme();
  const d = useMemo(() => styles(theme), [theme]);

  const [details, setDetails] = useState<PlantDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [activeReminder, setActiveReminder] = useState<WateringReminder | null>(null);
  const [showPicker, setShowPicker] = useState(false);

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
    const reminder = await getWateringReminder(name);
    setActiveReminder(reminder);
  };

  const handleSetReminder = async (days: number) => {
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

  const handleCancelReminder = async () => {
    await cancelWateringReminder(safePlantName!);
    setActiveReminder(null);
  };

  useEffect(() => {
    if (safePlantName) {
      fetchDetails(safePlantName);
      loadImage(safePlantName);
      loadReminder(safePlantName);
    }
  }, [safePlantName]);

  if (!safePlantName) {
    return (
      <View style={d.container}>
        <TouchableOpacity onPress={() => router.back()} style={d.backBtn}>
          <Text style={d.backText}>← Back to Search</Text>
        </TouchableOpacity>
        <View style={d.errorContainer}>
          <Text style={d.errorIcon}>🌿</Text>
          <Text style={d.errorText}>No plant selected.</Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={d.container} contentContainerStyle={d.content}>
      <TouchableOpacity onPress={() => router.back()} style={d.backBtn}>
        <Text style={d.backText}>← Back to Search</Text>
      </TouchableOpacity>

      {imageUrl && (
        <Image source={{ uri: imageUrl }} style={d.heroImage} resizeMode="cover" />
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
          {CARD_ORDER.map(key => {
            const value = details?.[key];
            if (!value) return null;
            return (
              <View key={key} style={d.card}>
                <Text style={d.cardLabel}>{key}</Text>
                <Text style={d.cardValue}>{value}</Text>
              </View>
            );
          })}

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
        </View>
      )}
    </ScrollView>
  );
}

const styles = (t: ReturnType<typeof useTheme>) => StyleSheet.create({
  container:       { flex: 1, backgroundColor: t.surface },
  content:         { padding: 24, paddingTop: 60 },
  backBtn:         { marginBottom: 24 },
  heroImage:       { width: '100%', height: 220, borderRadius: 20, marginBottom: 24, backgroundColor: t.border },
  backText:        { color: t.accent, fontWeight: '700', fontSize: 16 },
  headerTitle:     { fontSize: 40, fontWeight: '900', color: t.textHeading },
  divider:         { height: 6, width: 60, backgroundColor: t.accentMid, borderRadius: 3, marginVertical: 16 },
  card:            { backgroundColor: t.background, padding: 20, borderRadius: 24, marginBottom: 16, borderLeftWidth: 5, borderLeftColor: t.accentMid },
  cardLabel:       { fontSize: 12, fontWeight: '900', color: t.accent, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8 },
  cardValue:       { fontSize: 17, color: t.textBody, lineHeight: 26 },
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
  errorContainer:  { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  errorIcon:       { fontSize: 50, marginBottom: 20 },
  errorText:       { fontSize: 16, color: t.textSecondary, textAlign: 'center', marginBottom: 24, lineHeight: 22 },
  retryButton:     { backgroundColor: t.accent, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
  retryButtonText: { color: 'white', fontWeight: '700', fontSize: 16 },
});
