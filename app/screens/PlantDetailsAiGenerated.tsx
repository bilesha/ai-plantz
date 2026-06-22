import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Image, Modal, Platform, ScrollView, Share, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import * as Notifications from "expo-notifications";
import { useTheme } from "../../constants/theme";
import { supabase } from "../../lib/supabase";
import PlantSocialSection from "../../components/PlantSocialSection";
import { getPlantTips } from "../../utilities/fetchPlantTips";
import { fetchPlantImage } from "../../utilities/fetchPlantImage";
import { CardSkeleton } from "../../components/SkeletonLoader";
import { getPlantDetailsFromCache, savePlantDetailsToCache, getPlantImageFromCache, savePlantImageToCache } from "../../logic/cacheLogic";
import { scheduleWateringReminder, cancelWateringReminder, getWateringReminder, WateringReminder } from "../../logic/reminderLogic";
import { addToCollection, removeFromCollection, getCollectionEntry, updateCollectionEntry, getCollection } from "../../logic/collectionLogic";
import PlantPhotoGallery from "../../components/PlantPhotoGallery";
import PlantDiagnosisButton from "../../components/PlantDiagnosisButton";
import PlantChatSection from "../../components/PlantChatSection";
import { recordActivity, checkAndAwardBadges, updateLeaderboard } from "../../logic/gamificationLogic";
import { addDeathEntry } from "../../logic/deathLogLogic";
import { useToast } from "../../context/ToastContext";
import HealthLogSection from "../../components/HealthLogSection";
import SeasonalAdviceSection from "../../components/SeasonalAdviceSection";
import WateringSection from "../../components/WateringSection";
import type { CollectionEntry, OwnershipStatus, PlantDetails } from "../../types";
import { createListing, deleteListing, getMyListingForPlant, type PlantListing } from "../../logic/listingLogic";

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

const CARD_ORDER: (keyof PlantDetails)[] = [
  'watering', 'light', 'fertilizer', 'careLevel', 'toxicity',
  'funFact', 'seasonalCare', 'compatibility', 'propagation', 'pairingPlants', 'troubleshooting',
];

const CARD_LABELS: Partial<Record<keyof PlantDetails, string>> = {
  watering:       'Watering',
  light:          'Light',
  fertilizer:     'Fertilizer',
  careLevel:      'Care Level',
  funFact:        'Fun Fact',
  toxicity:       'Toxicity',
  seasonalCare:   'Seasonal Care',
  compatibility:  'Compatibility',
  pairingPlants:  'Pairing Plants',
  propagation:    'Propagation',
  troubleshooting:'Troubleshooting',
};

const CARE_LEVEL_COLORS: Record<string, string> = {
  easy:   '#16a34a',
  medium: '#d97706',
  hard:   '#dc2626',
};

const PROVIDER_LABELS: Record<string, string> = {
  gemini:   'Gemini',
  groq:     'Groq',
  deepseek: 'DeepSeek',
  qwen:     'Qwen',
  moonshot: 'Moonshot',
};

export default function PlantDetailsAiGenerated() {
  const { plantName, summary: summaryParam } = useLocalSearchParams();
  const safePlantName = Array.isArray(plantName) ? plantName[0] : plantName;
  const routeSummary = Array.isArray(summaryParam) ? summaryParam[0] : (summaryParam ?? '');
  const router = useRouter();
  const theme = useTheme();
  const d = useMemo(() => styles(theme), [theme]);
  const { showToast } = useToast();

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
  const [aiProvider, setAiProvider] = useState<string>('gemini');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [existingListing, setExistingListing] = useState<PlantListing | null>(null);
  const [showListingModal, setShowListingModal] = useState(false);
  const [listingType, setListingType] = useState<'trade' | 'gift' | 'sell'>('trade');
  const [listingDescription, setListingDescription] = useState('');
  const [listingPrice, setListingPrice] = useState('');
  const [listingSubmitting, setListingSubmitting] = useState(false);
  const [showDeadModal, setShowDeadModal] = useState(false);
  const [deadCause, setDeadCause] = useState('');
  const [deadNotes, setDeadNotes] = useState('');
  const [markingDead, setMarkingDead] = useState(false);

  const runGamification = async (ctx: {
    collectionCount?: number;
    hasPhoto?: boolean;
    hasDiagnosis?: boolean;
    hasListing?: boolean;
  }) => {
    try {
      await recordActivity();
      await checkAndAwardBadges(ctx);
      updateLeaderboard();
    } catch {}
  };

  const fetchDetails = async (name: string) => {
    setLoading(true);
    setError(null);

    const provider = (await AsyncStorage.getItem('ai_provider')) ?? 'gemini';
    setAiProvider(provider);

    try {
      const cachedData = await getPlantDetailsFromCache(name, provider);
      if (cachedData) {
        setDetails(cachedData);
        return;
      }

      const apiData = await getPlantTips(name);
      await savePlantDetailsToCache(name, provider, apiData.details);
      setDetails(apiData.details);
    } catch (err: any) {
      const msg = err?.message ?? '';
      if (msg.includes('503')) {
        setError('Selected AI provider is not available. Try another in Settings.');
      } else if (msg.includes('429')) {
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

  const loadListing = async (name: string) => {
    try {
      setExistingListing(await getMyListingForPlant(name));
    } catch {}
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
          'Shared from Rootnote',
        ].join('\n'),
      });
    } catch {}
  };

  const handleSaveToCollection = async (status: OwnershipStatus) => {
    if (!safePlantName) return;
    const entry: CollectionEntry = { name: safePlantName, summary: routeSummary, details: details ?? undefined, addedAt: Date.now(), status };
    const result = await addToCollection(entry);
    if (result.success) {
      setCollectionEntry(entry);
      setShowAddPicker(false);
      showToast('Plant added to collection!', 'success');
      getCollection().then(all => runGamification({ collectionCount: all.length })).catch(() => {});
    } else {
      showToast(`Failed: ${result.error ?? 'Unknown error'}`, 'error');
    }
  };

  const handleRemoveFromCollection = async () => {
    if (!safePlantName) return;
    await removeFromCollection(safePlantName);
    setCollectionEntry(null);
    setShowEditSection(false);
    showToast('Plant removed', 'success');
  };

  const handleUpdateCollection = async () => {
    if (!safePlantName) return;
    const patch = { status: draftStatus, rating: draftRating, notes: draftNotes || undefined };
    await updateCollectionEntry(safePlantName, patch);
    setCollectionEntry(prev => prev ? { ...prev, ...patch } : null);
    setShowEditSection(false);
  };

  const handleMarkAsDead = async () => {
    if (!safePlantName) return;
    setMarkingDead(true);
    try {
      await addDeathEntry(safePlantName, deadCause || undefined, deadNotes || undefined, collectionEntry?.addedAt);
      await removeFromCollection(safePlantName);
      setCollectionEntry(null);
      setShowEditSection(false);
      setShowDeadModal(false);
      setDeadCause('');
      setDeadNotes('');
      showToast(`RIP 🌿 ${safePlantName} — added to your death log`, 'info');
    } finally {
      setMarkingDead(false);
    }
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
        `Rootnote will remind you to water your ${safePlantName} every ${days} days.`,
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
    supabase.auth.getSession().then(({ data: { session } }) => {
      setCurrentUserId(session?.user?.id ?? null);
    });
    if (safePlantName) {
      fetchDetails(safePlantName);
      loadImage(safePlantName);
      loadReminder(safePlantName);
      loadCollectionEntry(safePlantName);
      loadListing(safePlantName);
    }
  }, [safePlantName]);

  const inCollection = collectionEntry !== null;

  if (!safePlantName) {
    return (
      <View style={d.container}>
        <View style={d.topBar}>
          <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/')}>
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
    <>
    <ScrollView style={d.container} contentContainerStyle={d.content}>
      <View style={d.topBar}>
        <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/')}>
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

      <PlantPhotoGallery
        plantName={safePlantName}
        isOwner={inCollection && !!currentUserId}
        userId={currentUserId ?? undefined}
        onPhotoUploaded={() => runGamification({ hasPhoto: true })}
      />

      {collectionEntry !== null && (
        <PlantDiagnosisButton
          plantName={safePlantName}
          onSuccess={() => runGamification({ hasDiagnosis: true })}
        />
      )}

      {collectionEntry !== null && (
        <PlantChatSection plantName={safePlantName} />
      )}

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
            const color = key === 'careLevel' ? (CARE_LEVEL_COLORS[value] ?? '#888') : undefined;
            return (
              <Animated.View key={key} entering={FadeInDown.delay(i * 100).duration(400)} style={d.card}>
                <Text style={d.cardLabel}>{CARD_LABELS[key] ?? key}</Text>
                {key === 'careLevel' ? (
                  <View style={[d.careLevelPill, { borderColor: color }]}>
                    <Text style={[d.careLevelText, { color }]}>
                      {value.charAt(0).toUpperCase() + value.slice(1)}
                    </Text>
                  </View>
                ) : (
                  <Text style={d.cardValue}>
                    {key === 'toxicity'
                      ? (/toxic/i.test(value) ? '⚠️  ' : '✅  ') + value
                      : value}
                  </Text>
                )}
              </Animated.View>
            );
          })}

          <Text style={d.providerBadge}>Powered by {PROVIDER_LABELS[aiProvider] ?? aiProvider}</Text>



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

          {inCollection && (
            existingListing ? (
              <TouchableOpacity
                style={d.listingRemoveBtn}
                onPress={async () => {
                  await deleteListing(existingListing.id);
                  setExistingListing(null);
                  showToast('Listing removed', 'success');
                }}
              >
                <Text style={d.listingRemoveBtnText}>✕ Remove listing</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={d.listingBtn}
                onPress={() => {
                  setListingType('trade');
                  setListingDescription('');
                  setListingPrice('');
                  setShowListingModal(true);
                }}
              >
                <Text style={d.listingBtnText}>🏷️ List for trade / gift / sale</Text>
              </TouchableOpacity>
            )
          )}

          {inCollection && collectionEntry?.status === 'own' && currentUserId && (
            <TouchableOpacity style={d.deathBtn} onPress={() => setShowDeadModal(true)}>
              <Text style={d.deathBtnText}>☠️ Mark as dead</Text>
            </TouchableOpacity>
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

          {currentUserId && (
            <View style={d.socialWrapper}>
              <PlantSocialSection
                plantOwnerUserId={currentUserId}
                plantName={safePlantName}
                currentUserId={currentUserId}
              />
            </View>
          )}

          <SeasonalAdviceSection plantDetails={details} />
          <WateringSection plantName={safePlantName} isOwner={!!currentUserId} />
          <HealthLogSection plantName={safePlantName} isOwner={!!currentUserId} />
        </View>
      )}
    </ScrollView>

    <Modal
      visible={showListingModal}
      transparent
      animationType="fade"
      onRequestClose={() => setShowListingModal(false)}
    >
      <View testID="listing-modal" style={d.modalOverlay}>
        <View style={d.modalBox}>
          <Text style={d.modalTitle}>List this plant</Text>

          <View style={d.listingTypeRow}>
            {([
              { type: 'trade' as const, label: '🔄 Trade' },
              { type: 'gift'  as const, label: '🎁 Gift'  },
              { type: 'sell'  as const, label: '💰 Sell'  },
            ] as const).map(opt => (
              <TouchableOpacity
                key={opt.type}
                style={[d.listingTypePill, listingType === opt.type && d.listingTypePillActive]}
                onPress={() => setListingType(opt.type)}
              >
                <Text style={[d.listingTypePillText, listingType === opt.type && d.listingTypePillTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {listingType === 'sell' && (
            <>
              <Text style={d.modalLabel}>PRICE ($)</Text>
              <TextInput
                style={d.modalInput}
                value={listingPrice}
                onChangeText={setListingPrice}
                placeholder="0.00"
                placeholderTextColor={theme.textMuted}
                keyboardType="decimal-pad"
              />
            </>
          )}

          <Text style={d.modalLabel}>DESCRIPTION (optional)</Text>
          <TextInput
            style={[d.modalInput, d.modalInputMultiline]}
            value={listingDescription}
            onChangeText={v => setListingDescription(v.slice(0, 200))}
            placeholder="Cutting, pot size, health notes..."
            placeholderTextColor={theme.textMuted}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            maxLength={200}
          />

          <TouchableOpacity
            style={[d.collectionBtnSaved, listingSubmitting && { opacity: 0.6 }]}
            disabled={listingSubmitting}
            onPress={async () => {
              setListingSubmitting(true);
              try {
                const parsedPrice = parseFloat(listingPrice);
                const result = await createListing(
                  safePlantName!,
                  listingType,
                  listingDescription || undefined,
                  listingType === 'sell' && !isNaN(parsedPrice) ? parsedPrice : undefined,
                );
                if (result) {
                  setExistingListing(result);
                  setShowListingModal(false);
                  showToast('Listing created!', 'success');
                  runGamification({ hasListing: true });
                } else {
                  showToast('Failed to create listing', 'error');
                }
              } finally {
                setListingSubmitting(false);
              }
            }}
          >
            {listingSubmitting
              ? <ActivityIndicator size="small" color={theme.accentDark} />
              : <Text style={d.collectionBtnSavedText}>Create listing</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setShowListingModal(false)} style={d.dismissLink}>
            <Text style={d.dismissLinkText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
    <Modal
      testID="mark-as-dead-modal"
      visible={showDeadModal}
      transparent
      animationType="fade"
      onRequestClose={() => setShowDeadModal(false)}
    >
      <View style={d.modalOverlay}>
        <View style={d.modalBox}>
          <Text style={d.deadModalTitle}>Mark as Dead ☠️</Text>

          <Text style={d.modalLabel}>WHAT WENT WRONG? (optional)</Text>
          <TextInput
            style={d.modalInput}
            value={deadCause}
            onChangeText={t => setDeadCause(t.slice(0, 100))}
            placeholder="e.g. overwatering, root rot, pests..."
            placeholderTextColor={theme.textMuted}
            maxLength={100}
          />

          <Text style={d.modalLabel}>ANY REFLECTIONS? (optional)</Text>
          <TextInput
            style={[d.modalInput, d.modalInputMultiline]}
            value={deadNotes}
            onChangeText={t => setDeadNotes(t.slice(0, 300))}
            placeholder="Notes for next time..."
            placeholderTextColor={theme.textMuted}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            maxLength={300}
          />

          <TouchableOpacity
            style={[d.deathConfirmBtn, markingDead && { opacity: 0.6 }]}
            onPress={handleMarkAsDead}
            disabled={markingDead}
          >
            {markingDead
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={d.deathConfirmBtnText}>Mark as dead</Text>
            }
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => { setShowDeadModal(false); setDeadCause(''); setDeadNotes(''); }}
            style={d.dismissLink}
          >
            <Text style={d.dismissLinkText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
    </>
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
  careLevelPill:   { alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 5, borderRadius: 100, borderWidth: 1.5 },
  careLevelText:   { fontSize: 14, fontWeight: '700' },
  providerBadge:   { fontSize: 12, color: t.textMuted, textAlign: 'center', marginBottom: 16 },
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
  socialWrapper:   { marginTop: 8, marginBottom: 8, backgroundColor: t.background, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: t.border },
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
  // listing
  listingBtn:               { borderWidth: 1.5, borderColor: t.accent, backgroundColor: t.surface, padding: 14, borderRadius: 20, alignItems: 'center' as const, marginBottom: 12 },
  listingBtnText:           { color: t.accent, fontWeight: '700' as const, fontSize: 14 },
  listingRemoveBtn:         { alignItems: 'center' as const, paddingVertical: 10, marginBottom: 12 },
  listingRemoveBtnText:     { color: t.danger, fontSize: 14, fontWeight: '600' as const },
  listingTypeRow:           { flexDirection: 'row' as const, gap: 8, marginBottom: 16 },
  listingTypePill:          { flex: 1, alignItems: 'center' as const, paddingVertical: 10, borderRadius: 100, borderWidth: 1.5, borderColor: t.border, backgroundColor: t.surface },
  listingTypePillActive:    { borderColor: t.accent, backgroundColor: t.surfaceGreenSubtle },
  listingTypePillText:      { fontSize: 13, fontWeight: '700' as const, color: t.textSecondary },
  listingTypePillTextActive:{ color: t.accentDark },
  // listing modal
  modalOverlay:        { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center' as const, alignItems: 'center' as const, padding: 24 },
  modalBox:            { backgroundColor: t.surface, borderRadius: 24, padding: 24, width: '100%' },
  modalTitle:          { fontSize: 18, fontWeight: '800' as const, color: t.textTitle, marginBottom: 20 },
  modalLabel:          { fontSize: 12, fontWeight: '700' as const, color: t.textMuted, letterSpacing: 0.8, marginBottom: 6, marginTop: 12 },
  modalInput:          { backgroundColor: t.background, borderWidth: 1.5, borderColor: t.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, color: t.textPrimary },
  modalInputMultiline: { minHeight: 80, textAlignVertical: 'top' as const, marginBottom: 4 },
  // mark-as-dead
  deathBtn:          { alignItems: 'center' as const, paddingVertical: 10, marginBottom: 8 },
  deathBtnText:      { color: t.danger, fontSize: 13, fontWeight: '600' as const },
  deadModalTitle:    { fontSize: 18, fontWeight: '800' as const, color: t.danger, marginBottom: 20 },
  deathConfirmBtn:   { backgroundColor: t.danger, padding: 14, borderRadius: 16, alignItems: 'center' as const, marginTop: 16 },
  deathConfirmBtnText: { color: '#fff', fontWeight: '700' as const, fontSize: 15 },
});
