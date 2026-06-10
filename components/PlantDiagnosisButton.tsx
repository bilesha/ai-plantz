import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { useTheme, type Theme } from '../constants/theme';
import { useToast } from '../context/ToastContext';
import { diagnosePlant, type DiagnosisResult } from '../logic/diagnosisLogic';

type Props = {
  plantName: string;
  onSuccess?: () => void;
};

export default function PlantDiagnosisButton({ plantName, onSuccess }: Props) {
  const theme = useTheme();
  const s = useMemo(() => styles(theme), [theme]);
  const { showToast } = useToast();

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DiagnosisResult | null>(null);

  const handleDiagnose = async () => {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Allow photo library access to diagnose your plant.');
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

      const diagnosis = await diagnosePlant({ imageBase64, mimeType, plantName });
      setResult(diagnosis);
      onSuccess?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Diagnosis failed';
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <TouchableOpacity
        style={[s.button, loading && s.buttonDisabled]}
        onPress={handleDiagnose}
        disabled={loading}
        testID="diagnose-button"
      >
        {loading ? (
          <ActivityIndicator size="small" color={theme.accent} />
        ) : (
          <Text style={s.buttonText}>Diagnose Plant 🔬</Text>
        )}
      </TouchableOpacity>

      <Modal
        visible={!!result}
        transparent
        animationType="slide"
        onRequestClose={() => setResult(null)}
      >
        <View style={s.overlay}>
          <View style={s.sheet}>
            <ScrollView showsVerticalScrollIndicator={false}>
              {result && (
                <>
                  <View style={[s.statusBadge, result.healthy ? s.statusHealthy : s.statusUnhealthy]}>
                    <Text style={s.statusText}>
                      {result.healthy ? '✅ Plant looks healthy!' : '⚠️ Issues detected'}
                    </Text>
                  </View>

                  {result.issues.length > 0 && (
                    <>
                      <Text style={s.sectionLabel}>ISSUES FOUND</Text>
                      <View style={s.issueList}>
                        {result.issues.map((issue, i) => (
                          <View key={i} style={s.issuePill}>
                            <Text style={s.issuePillText}>{issue}</Text>
                          </View>
                        ))}
                      </View>
                    </>
                  )}

                  <Text style={s.sectionLabel}>DIAGNOSIS</Text>
                  <Text style={s.bodyText}>{result.diagnosis}</Text>

                  {result.recommendations.length > 0 && (
                    <>
                      <Text style={s.sectionLabel}>RECOMMENDATIONS</Text>
                      {result.recommendations.map((rec, i) => (
                        <View key={i} style={s.recRow}>
                          <Text style={s.recNumber}>{i + 1}</Text>
                          <Text style={s.recText}>{rec}</Text>
                        </View>
                      ))}
                    </>
                  )}
                </>
              )}
            </ScrollView>

            <TouchableOpacity style={s.closeBtn} onPress={() => setResult(null)}>
              <Text style={s.closeBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = (t: Theme) => StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.surfaceGreenSubtle,
    borderWidth: 1.5,
    borderColor: t.accent,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginTop: 8,
    minHeight: 44,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: t.accent, fontWeight: '700', fontSize: 15 },

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

  statusBadge: {
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    marginBottom: 20,
  },
  statusHealthy:   { backgroundColor: 'rgba(5,150,105,0.12)', borderWidth: 1, borderColor: '#059669' },
  statusUnhealthy: { backgroundColor: 'rgba(239,68,68,0.10)', borderWidth: 1, borderColor: '#ef4444' },
  statusText: { fontWeight: '800', fontSize: 16, color: t.textTitle },

  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: t.textMuted,
    letterSpacing: 1,
    marginTop: 16,
    marginBottom: 8,
  },

  issueList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  issuePill: {
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
  },
  issuePillText: { color: '#ef4444', fontWeight: '600', fontSize: 13 },

  bodyText: { fontSize: 15, color: t.textPrimary, lineHeight: 22 },

  recRow: { flexDirection: 'row', gap: 10, marginBottom: 10, alignItems: 'flex-start' },
  recNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: t.accent,
    color: '#fff',
    fontWeight: '800',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 24,
    flexShrink: 0,
  },
  recText: { flex: 1, fontSize: 14, color: t.textPrimary, lineHeight: 20, paddingTop: 2 },

  closeBtn: {
    backgroundColor: t.accent,
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  closeBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
