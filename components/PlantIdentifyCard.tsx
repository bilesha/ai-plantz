import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { useRouter } from 'expo-router';
import { useTheme, type Theme } from '../constants/theme';
import { useToast } from '../context/ToastContext';
import { identifyPlant, type IdentifyResult } from '../logic/identifyLogic';

const CONFIDENCE_LABELS: Record<IdentifyResult['confidence'], string> = {
  high:   'High confidence',
  medium: 'Medium confidence',
  low:    'Low confidence',
};

export default function PlantIdentifyCard() {
  const router = useRouter();
  const theme = useTheme();
  const s = useMemo(() => styles(theme), [theme]);
  const { showToast } = useToast();

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<IdentifyResult | null>(null);

  const handleIdentify = async () => {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Allow photo library access to identify a plant.');
        return;
      }
    }

    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'] as any,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (picked.canceled || !picked.assets?.[0]) return;

    const asset = picked.assets[0];
    setLoading(true);

    try {
      let imageBase64: string;
      const mimeType = 'image/jpeg';

      if (Platform.OS === 'web') {
        const response = await fetch(asset.uri);
        const blob = await response.blob();
        imageBase64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const dataUrl = reader.result as string;
            resolve(dataUrl.split(',')[1] ?? '');
          };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      } else {
        imageBase64 = await FileSystem.readAsStringAsync(asset.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
      }

      const identified = await identifyPlant({ imageBase64, mimeType });
      setResult(identified);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Identification failed';
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleViewTips = () => {
    if (!result) return;
    const plantName = result.plantName || result.scientificName;
    setResult(null);
    router.push({ pathname: '/screens/PlantDetailsAiGenerated', params: { plantName } });
  };

  return (
    <>
      <TouchableOpacity
        testID="identify-plant-card"
        style={s.card}
        onPress={handleIdentify}
        disabled={loading}
        activeOpacity={0.8}
      >
        <Text style={s.cardIcon}>📸</Text>
        <View style={s.cardText}>
          <Text style={s.cardTitle}>Identify a Plant</Text>
          <Text style={s.cardSub}>Snap or pick a photo — AI names the plant</Text>
        </View>
        {loading
          ? <ActivityIndicator size="small" color={theme.accent} />
          : <Text style={s.cardChevron}>›</Text>}
      </TouchableOpacity>

      <Modal
        visible={!!result}
        transparent
        animationType="slide"
        onRequestClose={() => setResult(null)}
      >
        <View style={s.overlay}>
          <View style={s.sheet}>
            {result && (
              result.isPlant ? (
                <>
                  <Text style={s.resultName}>{result.plantName || 'Unknown plant'}</Text>
                  {!!result.scientificName && (
                    <Text style={s.resultSci}>{result.scientificName}</Text>
                  )}
                  <View style={[s.confidencePill, s[`confidence_${result.confidence}`] ?? s.confidence_low]}>
                    <Text style={s.confidenceText}>{CONFIDENCE_LABELS[result.confidence] ?? 'Low confidence'}</Text>
                  </View>
                  <Text style={s.bodyText}>{result.description}</Text>

                  <TouchableOpacity testID="identify-view-tips" style={s.primaryBtn} onPress={handleViewTips}>
                    <Text style={s.primaryBtnText}>View Care Tips 🌿</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text style={s.resultName}>No plant found 🤔</Text>
                  <Text style={s.bodyText}>{result.description}</Text>
                </>
              )
            )}

            <TouchableOpacity style={s.closeBtn} onPress={() => setResult(null)}>
              <Text style={s.closeBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = (t: Theme) => StyleSheet.create({
  card:        { flexDirection: 'row', alignItems: 'center', backgroundColor: t.surface, borderRadius: 20, padding: 18, marginBottom: 24, borderWidth: 1, borderColor: t.border, gap: 12 },
  cardIcon:    { fontSize: 28 },
  cardText:    { flex: 1 },
  cardTitle:   { fontSize: 16, fontWeight: '800', color: t.textTitle },
  cardSub:     { fontSize: 13, color: t.textMuted, marginTop: 2 },
  cardChevron: { fontSize: 24, color: t.accent, fontWeight: '700' },

  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: t.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 40,
    maxHeight: '85%',
  },

  resultName: { fontSize: 22, fontWeight: '900', color: t.textTitle },
  resultSci:  { fontSize: 15, fontStyle: 'italic', color: t.textMuted, marginTop: 2 },

  confidencePill: {
    alignSelf: 'flex-start',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
    marginTop: 12,
  },
  confidence_high:   { backgroundColor: 'rgba(5,150,105,0.12)', borderColor: '#059669' },
  confidence_medium: { backgroundColor: 'rgba(245,158,11,0.12)', borderColor: '#f59e0b' },
  confidence_low:    { backgroundColor: 'rgba(239,68,68,0.10)', borderColor: '#ef4444' },
  confidenceText:    { fontWeight: '700', fontSize: 13, color: t.textPrimary },

  bodyText: { fontSize: 15, color: t.textPrimary, lineHeight: 22, marginTop: 16 },

  primaryBtn: {
    backgroundColor: t.accent,
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  closeBtn: {
    borderWidth: 1.5,
    borderColor: t.border,
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  closeBtnText: { color: t.textPrimary, fontWeight: '700', fontSize: 15 },
});
