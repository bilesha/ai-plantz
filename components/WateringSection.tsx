import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme, type Theme } from '../constants/theme';
import { useToast } from '../context/ToastContext';
import {
  getWateringLog,
  logWatering,
  deleteWateringEntry,
  setWateringInterval,
  getWateringInterval,
  suggestWateringInterval,
  type WateringEntry,
  type WateringInterval,
} from '../logic/wateringLogic';

type Props = {
  plantName: string;
  isOwner: boolean;
};

function formatEntryDate(iso: string): string {
  const d = new Date(iso);
  const diffDays = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 30) return `${diffDays} days ago`;
  return d.toLocaleDateString();
}

function nextWateringInfo(isoDate: string | null): { label: string; color: string } | null {
  if (!isoDate) return null;
  const todayMidnight = new Date();
  todayMidnight.setHours(0, 0, 0, 0);
  const nextMidnight = new Date(isoDate);
  nextMidnight.setHours(0, 0, 0, 0);
  const diffDays = Math.round((nextMidnight.getTime() - todayMidnight.getTime()) / 86400000);
  if (diffDays < 0) return { label: `Overdue by ${Math.abs(diffDays)} day${Math.abs(diffDays) !== 1 ? 's' : ''}`, color: '#dc2626' };
  if (diffDays === 0) return { label: 'Due today', color: '#d97706' };
  return { label: `Due in ${diffDays} day${diffDays !== 1 ? 's' : ''}`, color: '#059669' };
}

function todayString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function WateringSection({ plantName, isOwner }: Props) {
  const theme = useTheme();
  const s = useMemo(() => styles(theme), [theme]);
  const { showToast } = useToast();

  const [log, setLog] = useState<WateringEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [schedule, setSchedule] = useState<WateringInterval>({ intervalDays: null, nextWateringDate: null });
  const [showAll, setShowAll] = useState(false);

  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [customDays, setCustomDays] = useState('');
  const [aiSuggestLoading, setAiSuggestLoading] = useState(false);

  const [showLogModal, setShowLogModal] = useState(false);
  const [logDate, setLogDate] = useState(todayString());
  const [logAmount, setLogAmount] = useState('');
  const [logNotes, setLogNotes] = useState('');
  const [logSaving, setLogSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [logData, scheduleData] = await Promise.all([
          getWateringLog(plantName),
          getWateringInterval(plantName),
        ]);
        setLog(logData);
        setSchedule(scheduleData);
      } finally {
        setLoading(false);
      }
    })();
  }, [plantName]);

  const handleAiSuggest = async () => {
    setAiSuggestLoading(true);
    try {
      const days = await suggestWateringInterval(plantName);
      setCustomDays(String(days));
      showToast(`AI suggests every ${days} days`, 'info');
    } catch {
      showToast('AI suggestion failed', 'error');
    } finally {
      setAiSuggestLoading(false);
    }
  };

  const handleSaveSchedule = async () => {
    const days = parseInt(customDays, 10);
    if (isNaN(days) || days < 1 || days > 365) {
      showToast('Enter a valid number of days (1–365)', 'error');
      return;
    }
    await setWateringInterval(plantName, days);
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + days);
    setSchedule({ intervalDays: days, nextWateringDate: nextDate.toISOString() });
    setShowScheduleModal(false);
    setCustomDays('');
    showToast(`Schedule set: every ${days} days`, 'success');
  };

  const handleLogWatering = async () => {
    setLogSaving(true);
    try {
      const amountMl = logAmount.trim() ? parseInt(logAmount, 10) : undefined;
      const notes = logNotes.trim() || undefined;
      const dateParts = logDate.trim().split('-');
      const wateredAt =
        dateParts.length === 3 && !isNaN(new Date(logDate).getTime())
          ? new Date(logDate + 'T12:00:00').toISOString()
          : new Date().toISOString();

      const entry = await logWatering(plantName, amountMl, notes, wateredAt);
      if (entry) {
        setLog(prev => [entry, ...prev]);
        if (schedule.intervalDays) {
          const nextDate = new Date();
          nextDate.setDate(nextDate.getDate() + schedule.intervalDays);
          setSchedule(prev => ({ ...prev, nextWateringDate: nextDate.toISOString() }));
        }
        showToast('Watering logged!', 'success');
      } else {
        showToast('Failed to log watering', 'error');
      }
      setShowLogModal(false);
      setLogDate(todayString());
      setLogAmount('');
      setLogNotes('');
    } finally {
      setLogSaving(false);
    }
  };

  const handleDeleteEntry = async (id: string) => {
    setLog(prev => prev.filter(e => e.id !== id));
    await deleteWateringEntry(id);
    showToast('Entry deleted', 'success');
  };

  if (loading) {
    return (
      <View style={s.container}>
        <Text style={s.sectionLabel}>WATERING</Text>
        <ActivityIndicator size="small" color={theme.accent} style={s.loader} />
      </View>
    );
  }

  const displayLog = showAll ? log : log.slice(0, 3);
  const nextInfo = nextWateringInfo(schedule.nextWateringDate);

  return (
    <View style={s.container}>
      <Text style={s.sectionLabel}>WATERING</Text>

      {/* Schedule row */}
      <View style={s.scheduleRow}>
        <Text style={s.scheduleText}>
          {schedule.intervalDays ? `Every ${schedule.intervalDays} days` : 'No schedule set'}
        </Text>
        {isOwner && (
          <TouchableOpacity
            style={s.smallBtn}
            onPress={() => {
              setCustomDays(schedule.intervalDays ? String(schedule.intervalDays) : '');
              setShowScheduleModal(true);
            }}
          >
            <Text style={s.smallBtnText}>Set Schedule</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Next watering */}
      {nextInfo && (
        <Text style={[s.nextWatering, { color: nextInfo.color }]}>
          💧 {nextInfo.label}
        </Text>
      )}

      {/* Log watering button */}
      {isOwner && (
        <TouchableOpacity
          style={s.logBtn}
          onPress={() => {
            setLogDate(todayString());
            setShowLogModal(true);
          }}
        >
          <Text style={s.logBtnText}>💧 Log Watering</Text>
        </TouchableOpacity>
      )}

      {/* History */}
      {log.length > 0 && (
        <View style={s.historyBox}>
          <Text style={s.historyLabel}>WATERING HISTORY</Text>
          {displayLog.map((entry, i) => (
            <View
              key={entry.id}
              style={[s.historyEntry, i < displayLog.length - 1 && s.historyEntryBorder]}
            >
              <View style={s.historyDot} />
              <View style={s.historyInfo}>
                <Text style={s.historyDate}>{formatEntryDate(entry.watered_at)}</Text>
                {entry.amount_ml != null && (
                  <Text style={s.historyMeta}>{entry.amount_ml} ml</Text>
                )}
                {!!entry.notes && (
                  <Text style={s.historyNotes}>{entry.notes}</Text>
                )}
              </View>
              {isOwner && (
                <TouchableOpacity
                  onPress={() => handleDeleteEntry(entry.id)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={s.deleteText}>✕</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
          {log.length > 3 && (
            <TouchableOpacity onPress={() => setShowAll(v => !v)} style={s.showAllBtn}>
              <Text style={s.showAllText}>
                {showAll ? 'Show less' : `Show all ${log.length} entries`}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Set Schedule Modal */}
      <Modal
        visible={showScheduleModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowScheduleModal(false)}
      >
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <Text style={s.modalTitle}>Set Watering Schedule</Text>

            <Text style={s.modalLabel}>Interval (days)</Text>
            <TextInput
              style={s.modalInput}
              value={customDays}
              onChangeText={setCustomDays}
              keyboardType="number-pad"
              placeholder="e.g. 7"
              placeholderTextColor={theme.textMuted}
              maxLength={3}
            />

            <TouchableOpacity
              style={[s.aiBtn, aiSuggestLoading && s.btnDisabled]}
              onPress={handleAiSuggest}
              disabled={aiSuggestLoading}
            >
              {aiSuggestLoading ? (
                <ActivityIndicator size="small" color={theme.accent} />
              ) : (
                <Text style={s.aiBtnText}>✨ AI Suggest</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={s.modalSaveBtn} onPress={handleSaveSchedule}>
              <Text style={s.modalSaveBtnText}>Save</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowScheduleModal(false)} style={s.modalCancelBtn}>
              <Text style={s.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Log Watering Modal */}
      <Modal
        visible={showLogModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLogModal(false)}
      >
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <Text style={s.modalTitle}>Log Watering</Text>

            <Text style={s.modalLabel}>Date (YYYY-MM-DD)</Text>
            <TextInput
              style={s.modalInput}
              value={logDate}
              onChangeText={setLogDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={theme.textMuted}
              maxLength={10}
            />

            <Text style={s.modalLabel}>Amount (ml) — optional</Text>
            <TextInput
              style={s.modalInput}
              value={logAmount}
              onChangeText={setLogAmount}
              keyboardType="number-pad"
              placeholder="e.g. 250"
              placeholderTextColor={theme.textMuted}
              maxLength={5}
            />

            <Text style={s.modalLabel}>Notes — optional</Text>
            <TextInput
              style={[s.modalInput, s.modalInputMultiline]}
              value={logNotes}
              onChangeText={setLogNotes}
              placeholder="Any notes..."
              placeholderTextColor={theme.textMuted}
              multiline
              numberOfLines={2}
              textAlignVertical="top"
            />

            <TouchableOpacity
              style={[s.modalSaveBtn, logSaving && s.btnDisabled]}
              onPress={handleLogWatering}
              disabled={logSaving}
            >
              {logSaving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={s.modalSaveBtnText}>Save</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowLogModal(false)} style={s.modalCancelBtn}>
              <Text style={s.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = (t: Theme) => StyleSheet.create({
  container:       { marginTop: 8, marginBottom: 8, backgroundColor: t.background, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: t.border },
  sectionLabel:    { fontSize: 11, fontWeight: '800', color: t.textMuted, letterSpacing: 1, marginBottom: 12 },
  loader:          { marginVertical: 8 },

  scheduleRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  scheduleText:    { fontSize: 15, color: t.textBody, fontWeight: '600', flex: 1 },
  smallBtn:        { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 100, borderWidth: 1.5, borderColor: t.accent, backgroundColor: t.surfaceGreenSubtle },
  smallBtnText:    { color: t.accentDark, fontWeight: '700', fontSize: 13 },

  nextWatering:    { fontSize: 14, fontWeight: '600', marginBottom: 12 },

  logBtn:          { backgroundColor: t.accent, padding: 14, borderRadius: 20, alignItems: 'center', marginTop: 4, marginBottom: 16 },
  logBtnText:      { color: '#fff', fontWeight: '700', fontSize: 15 },

  historyBox:      { backgroundColor: t.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: t.border },
  historyLabel:    { fontSize: 11, fontWeight: '800', color: t.textMuted, letterSpacing: 1, marginBottom: 12 },
  historyEntry:    { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 10 },
  historyEntryBorder: { borderBottomWidth: 1, borderBottomColor: t.border },
  historyDot:      { width: 8, height: 8, borderRadius: 4, backgroundColor: t.accentMid, marginRight: 12, marginTop: 5 },
  historyInfo:     { flex: 1 },
  historyDate:     { fontSize: 14, color: t.textBody, fontWeight: '600' },
  historyMeta:     { fontSize: 12, color: t.textSecondary, marginTop: 2 },
  historyNotes:    { fontSize: 13, color: t.textSecondary, marginTop: 2, fontStyle: 'italic' },
  deleteText:      { fontSize: 13, color: t.textMuted, paddingLeft: 8 },
  showAllBtn:      { alignItems: 'center', paddingTop: 12 },
  showAllText:     { fontSize: 13, color: t.accent, fontWeight: '600' },

  modalOverlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalBox:        { backgroundColor: t.surface, borderRadius: 24, padding: 24, width: '100%', maxWidth: 400 },
  modalTitle:      { fontSize: 18, fontWeight: '800', color: t.textTitle, marginBottom: 20 },
  modalLabel:      { fontSize: 12, fontWeight: '700', color: t.textMuted, letterSpacing: 0.8, marginBottom: 6, marginTop: 12 },
  modalInput:      { backgroundColor: t.background, borderWidth: 1.5, borderColor: t.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, color: t.textPrimary },
  modalInputMultiline: { minHeight: 64, textAlignVertical: 'top' },
  aiBtn:           { marginTop: 12, borderWidth: 1.5, borderColor: t.accent, borderRadius: 12, padding: 12, alignItems: 'center' },
  aiBtnText:       { color: t.accent, fontWeight: '700', fontSize: 14 },
  btnDisabled:     { opacity: 0.5 },
  modalSaveBtn:    { backgroundColor: t.accent, padding: 14, borderRadius: 16, alignItems: 'center', marginTop: 20 },
  modalSaveBtnText:{ color: '#fff', fontWeight: '700', fontSize: 15 },
  modalCancelBtn:  { alignItems: 'center', paddingVertical: 12 },
  modalCancelText: { color: t.textMuted, fontSize: 14, fontWeight: '600' },
});
