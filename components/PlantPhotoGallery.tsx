import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useTheme, type Theme } from '../constants/theme';
import { useToast } from '../context/ToastContext';
import {
  getPlantPhotos,
  uploadPlantPhoto,
  deletePhoto,
  setPrimaryPhoto,
  type PlantPhoto,
} from '../logic/photoLogic';

type Props = {
  plantName: string;
  isOwner: boolean;
  userId?: string;
  onPhotoUploaded?: () => void;
};

export default function PlantPhotoGallery({ plantName, isOwner, userId, onPhotoUploaded }: Props) {
  const theme = useTheme();
  const s = useMemo(() => styles(theme), [theme]);
  const { showToast } = useToast();

  const [photos, setPhotos] = useState<PlantPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPhoto, setSelectedPhoto] = useState<PlantPhoto | null>(null);

  const [showAddModal, setShowAddModal] = useState(false);
  const [pendingUri, setPendingUri] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await getPlantPhotos(plantName, userId);
        setPhotos(data);
      } finally {
        setLoading(false);
      }
    })();
  }, [plantName, userId]);

  const handlePickPhoto = async () => {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Allow photo library access to add a plant photo.');
        return;
      }
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'] as any,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (result.canceled || !result.assets?.[0]) return;
    setPendingUri(result.assets[0].uri);
    setCaption('');
    setShowAddModal(true);
  };

  const handleUpload = async () => {
    if (!pendingUri) return;
    setUploading(true);
    try {
      const photo = await uploadPlantPhoto(plantName, pendingUri, caption.trim() || undefined);
      if (photo) {
        setPhotos(prev =>
          photo.is_primary
            ? [photo, ...prev.map(p => ({ ...p, is_primary: false }))]
            : [...prev, photo],
        );
        showToast('Photo added!', 'success');
        onPhotoUploaded?.();
      } else {
        showToast('Upload failed', 'error');
      }
    } finally {
      setUploading(false);
      setShowAddModal(false);
      setPendingUri(null);
      setCaption('');
    }
  };

  const handleSetPrimary = async (photo: PlantPhoto) => {
    await setPrimaryPhoto(photo.id, plantName, photo.photo_url);
    setPhotos(prev => prev.map(p => ({ ...p, is_primary: p.id === photo.id })));
    setSelectedPhoto(prev => prev ? { ...prev, is_primary: true } : null);
    showToast('Set as primary photo', 'success');
  };

  const handleDelete = (photo: PlantPhoto) => {
    const doDelete = async () => {
      await deletePhoto(photo.id, photo.photo_url);
      setPhotos(prev => {
        const filtered = prev.filter(p => p.id !== photo.id);
        if (photo.is_primary && filtered.length > 0) {
          filtered[0] = { ...filtered[0], is_primary: true };
        }
        return filtered;
      });
      setSelectedPhoto(null);
      showToast('Photo deleted', 'success');
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Delete this photo?')) doDelete();
    } else {
      Alert.alert('Delete photo', 'Are you sure?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => { doDelete(); } },
      ]);
    }
  };

  if (loading) {
    return (
      <View testID="plant-photo-gallery" style={s.container}>
        <Text style={s.sectionLabel}>PHOTOS</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={s.scrollContent}>
            {[0, 1, 2].map(i => <View key={i} style={s.skeleton} />)}
          </View>
        </ScrollView>
      </View>
    );
  }

  if (!isOwner && photos.length === 0) return null;

  return (
    <View testID="plant-photo-gallery" style={s.container}>
      <Text style={s.sectionLabel}>PHOTOS</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={s.scrollContent}>
          {photos.map(photo => (
            <TouchableOpacity key={photo.id} onPress={() => setSelectedPhoto(photo)}>
              <View style={s.thumbWrapper}>
                <Image source={{ uri: photo.photo_url }} style={s.thumb} resizeMode="cover" />
                {photo.is_primary && (
                  <View style={s.primaryBadge}>
                    <Text style={s.primaryBadgeText}>⭐</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          ))}
          {isOwner && (
            <TouchableOpacity style={s.addBtn} onPress={handlePickPhoto}>
              <Text style={s.addBtnText}>{'+ Add\nphoto'}</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* Fullscreen photo viewer */}
      <Modal
        visible={!!selectedPhoto}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedPhoto(null)}
      >
        <View style={s.viewerOverlay}>
          {selectedPhoto && (
            <View style={s.viewerBox}>
              <Image source={{ uri: selectedPhoto.photo_url }} style={s.viewerImage} resizeMode="contain" />
              {!!selectedPhoto.caption && (
                <Text style={s.viewerCaption}>{selectedPhoto.caption}</Text>
              )}
              <Text style={s.viewerDate}>
                {new Date(selectedPhoto.taken_at).toLocaleDateString()}
              </Text>
              {isOwner && (
                <View style={s.viewerActions}>
                  {!selectedPhoto.is_primary && (
                    <TouchableOpacity
                      style={s.viewerActionBtn}
                      onPress={() => handleSetPrimary(selectedPhoto)}
                    >
                      <Text style={s.viewerActionBtnText}>Set as primary</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={[s.viewerActionBtn, s.viewerDeleteBtn]}
                    onPress={() => handleDelete(selectedPhoto)}
                  >
                    <Text style={s.viewerDeleteBtnText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              )}
              <TouchableOpacity onPress={() => setSelectedPhoto(null)} style={s.viewerClose}>
                <Text style={s.viewerCloseText}>Close</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>

      {/* Caption modal shown after picking a photo */}
      <Modal
        visible={showAddModal}
        transparent
        animationType="fade"
        onRequestClose={() => { setShowAddModal(false); setPendingUri(null); }}
      >
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <Text style={s.modalTitle}>Add Photo</Text>
            {pendingUri && (
              <Image source={{ uri: pendingUri }} style={s.previewImage} resizeMode="cover" />
            )}
            <Text style={s.modalLabel}>CAPTION (optional)</Text>
            <TextInput
              style={s.modalInput}
              value={caption}
              onChangeText={v => setCaption(v.slice(0, 100))}
              placeholder="e.g. Blooming in spring"
              placeholderTextColor={theme.textMuted}
              maxLength={100}
            />
            <TouchableOpacity
              style={[s.modalSaveBtn, uploading && s.btnDisabled]}
              onPress={handleUpload}
              disabled={uploading}
            >
              {uploading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={s.modalSaveBtnText}>Upload</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => { setShowAddModal(false); setPendingUri(null); setCaption(''); }}
              style={s.modalCancelBtn}
            >
              <Text style={s.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = (t: Theme) => StyleSheet.create({
  container:     { marginTop: 8, marginBottom: 8, backgroundColor: t.background, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: t.border },
  sectionLabel:  { fontSize: 11, fontWeight: '800', color: t.textMuted, letterSpacing: 1, marginBottom: 12 },
  scrollContent: { flexDirection: 'row', gap: 8, paddingBottom: 4 },

  thumbWrapper:  { position: 'relative' },
  thumb:         { width: 100, height: 100, borderRadius: 12 },
  primaryBadge:  { position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 10, width: 22, height: 22, justifyContent: 'center', alignItems: 'center' },
  primaryBadgeText: { fontSize: 11 },

  skeleton:      { width: 100, height: 100, borderRadius: 12, backgroundColor: t.border },

  addBtn:        { width: 100, height: 100, borderRadius: 12, borderWidth: 1.5, borderColor: t.accent, borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', backgroundColor: t.surfaceGreenSubtle },
  addBtnText:    { color: t.accent, fontWeight: '700', fontSize: 13, textAlign: 'center' },

  // Viewer modal
  viewerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.88)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  viewerBox:     { width: '100%', maxWidth: 480 },
  viewerImage:   { width: '100%', aspectRatio: 1, borderRadius: 16, marginBottom: 12 },
  viewerCaption: { color: '#f1f5f9', fontSize: 15, textAlign: 'center', marginBottom: 4 },
  viewerDate:    { color: 'rgba(255,255,255,0.5)', fontSize: 13, textAlign: 'center', marginBottom: 16 },
  viewerActions: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  viewerActionBtn:     { flex: 1, padding: 12, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center' },
  viewerActionBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  viewerDeleteBtn:     { backgroundColor: 'rgba(239,68,68,0.28)' },
  viewerDeleteBtnText: { color: '#fca5a5', fontWeight: '700', fontSize: 14 },
  viewerClose:         { alignItems: 'center', paddingVertical: 12 },
  viewerCloseText:     { color: 'rgba(255,255,255,0.5)', fontSize: 14, fontWeight: '600' },

  // Caption / add modal
  modalOverlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalBox:        { backgroundColor: t.surface, borderRadius: 24, padding: 24, width: '100%', maxWidth: 400 },
  modalTitle:      { fontSize: 18, fontWeight: '800', color: t.textTitle, marginBottom: 16 },
  previewImage:    { width: '100%', height: 180, borderRadius: 12, marginBottom: 4 },
  modalLabel:      { fontSize: 12, fontWeight: '700', color: t.textMuted, letterSpacing: 0.8, marginBottom: 6, marginTop: 12 },
  modalInput:      { backgroundColor: t.background, borderWidth: 1.5, borderColor: t.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, color: t.textPrimary },
  modalSaveBtn:    { backgroundColor: t.accent, padding: 14, borderRadius: 16, alignItems: 'center', marginTop: 20 },
  modalSaveBtnText:{ color: '#fff', fontWeight: '700', fontSize: 15 },
  modalCancelBtn:  { alignItems: 'center', paddingVertical: 12 },
  modalCancelText: { color: t.textMuted, fontSize: 14, fontWeight: '600' },
  btnDisabled:     { opacity: 0.5 },
});
