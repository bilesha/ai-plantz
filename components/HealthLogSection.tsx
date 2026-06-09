import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { useTheme, type Theme } from '../constants/theme';
import { useToast } from '../context/ToastContext';
import {
  addHealthEntry,
  addHealthLogComment,
  deleteHealthEntry,
  deleteHealthLogComment,
  getHealthLog,
  getHealthLogComments,
} from '../logic/healthLogLogic';
import type { HealthLogComment, HealthLogEntry } from '../types';

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

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${Math.max(1, mins)}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function getInitials(username: string | null): string {
  if (!username) return '?';
  return username.charAt(0).toUpperCase();
}

export default function HealthLogSection({ plantName, isOwner }: Props) {
  const theme = useTheme();
  const s = useMemo(() => styles(theme), [theme]);
  const { showToast } = useToast();

  const [log, setLog] = useState<HealthLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [saving, setSaving] = useState(false);

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [loadedIds, setLoadedIds] = useState<Set<string>>(new Set());
  const [commentsByEntry, setCommentsByEntry] = useState<Record<string, HealthLogComment[]>>({});
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [sendingIds, setSendingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setCurrentUserId(session?.user?.id ?? null);
    });
    getHealthLog(plantName)
      .then(setLog)
      .finally(() => setLoading(false));
  }, [plantName]);

  const handleToggleExpand = (entryId: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(entryId)) { next.delete(entryId); } else { next.add(entryId); }
      return next;
    });

    if (!loadedIds.has(entryId)) {
      setLoadedIds(prev => { const s = new Set(prev); s.add(entryId); return s; });
      getHealthLogComments(entryId).then(comments => {
        setCommentsByEntry(prev => ({ ...prev, [entryId]: comments }));
      });
    }
  };

  const handleAdd = async () => {
    const trimmed = noteText.trim();
    if (!trimmed) {
      showToast('Note cannot be empty', 'error');
      return;
    }
    setSaving(true);
    try {
      const entry = await addHealthEntry(plantName, trimmed);
      if (entry) {
        setLog(prev => [entry, ...prev]);
        showToast('Health note added', 'success');
        setShowAddModal(false);
        setNoteText('');
      } else {
        showToast('Failed to add note', 'error');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setLog(prev => prev.filter(e => e.id !== id));
    setExpandedIds(prev => { const s = new Set(prev); s.delete(id); return s; });
    setLoadedIds(prev => { const s = new Set(prev); s.delete(id); return s; });
    setCommentsByEntry(prev => { const next = { ...prev }; delete next[id]; return next; });
    setCommentInputs(prev => { const next = { ...prev }; delete next[id]; return next; });
    await deleteHealthEntry(id);
    showToast('Entry deleted', 'success');
  };

  const handleAddComment = async (entryId: string) => {
    const body = (commentInputs[entryId] ?? '').trim();
    if (!body) return;
    setSendingIds(prev => { const s = new Set(prev); s.add(entryId); return s; });
    try {
      const comment = await addHealthLogComment(entryId, body);
      if (comment) {
        setCommentsByEntry(prev => ({
          ...prev,
          [entryId]: [...(prev[entryId] ?? []), comment],
        }));
        setCommentInputs(prev => ({ ...prev, [entryId]: '' }));
      } else {
        showToast('Failed to add comment', 'error');
      }
    } finally {
      setSendingIds(prev => { const s = new Set(prev); s.delete(entryId); return s; });
    }
  };

  const handleDeleteComment = (entryId: string, commentId: string) => {
    setCommentsByEntry(prev => ({
      ...prev,
      [entryId]: (prev[entryId] ?? []).filter(c => c.id !== commentId),
    }));
    deleteHealthLogComment(commentId);
  };

  if (loading) {
    return (
      <View style={s.container}>
        <Text style={s.sectionLabel}>HEALTH LOG</Text>
        <ActivityIndicator size="small" color={theme.accent} style={s.loader} />
      </View>
    );
  }

  const displayLog = showAll ? log : log.slice(0, 3);

  return (
    <View style={s.container}>
      <View style={s.headerRow}>
        <Text style={s.sectionLabel}>HEALTH LOG</Text>
        {isOwner && (
          <TouchableOpacity style={s.smallBtn} onPress={() => setShowAddModal(true)}>
            <Text style={s.smallBtnText}>+ Add Note</Text>
          </TouchableOpacity>
        )}
      </View>

      {log.length === 0 ? (
        <Text style={s.emptyText}>No health observations yet</Text>
      ) : (
        <View style={s.historyBox}>
          {displayLog.map((entry, i) => {
            const isExpanded = expandedIds.has(entry.id);
            const entryComments = commentsByEntry[entry.id];
            return (
              <View
                key={entry.id}
                style={i < displayLog.length - 1 && s.entryGroupBorder}
              >
                <TouchableOpacity
                  style={s.historyEntry}
                  onPress={() => handleToggleExpand(entry.id)}
                  activeOpacity={0.7}
                >
                  <View style={s.historyDot} />
                  <View style={s.historyInfo}>
                    <Text style={s.historyDate}>{formatEntryDate(entry.logged_at)}</Text>
                    <Text style={s.historyNote}>{entry.note}</Text>
                  </View>
                  {isOwner && (
                    <TouchableOpacity
                      onPress={() => handleDelete(entry.id)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text style={s.deleteText}>✕</Text>
                    </TouchableOpacity>
                  )}
                  <Text style={s.chevronText}>{isExpanded ? '▲' : '▾'}</Text>
                </TouchableOpacity>

                {isExpanded && (
                  <View style={s.commentsSection}>
                    {!entryComments ? (
                      <ActivityIndicator size="small" color={theme.accent} />
                    ) : entryComments.length === 0 ? (
                      <Text style={s.noCommentsText}>No comments yet</Text>
                    ) : (
                      entryComments.map(comment => (
                        <View key={comment.id} style={s.commentRow}>
                          {comment.avatar_url ? (
                            <Image source={{ uri: comment.avatar_url }} style={s.commentAvatar} />
                          ) : (
                            <View style={s.commentAvatarInitials}>
                              <Text style={s.commentAvatarText}>{getInitials(comment.username)}</Text>
                            </View>
                          )}
                          <View style={s.commentBody}>
                            <Text style={s.commentUsername}>{comment.username ?? 'Unknown'}</Text>
                            <Text style={s.commentText}>{comment.body}</Text>
                            <Text style={s.commentTime}>{relativeTime(comment.created_at)}</Text>
                          </View>
                          {currentUserId === comment.user_id && (
                            <TouchableOpacity
                              onPress={() => handleDeleteComment(entry.id, comment.id)}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                              <Text style={s.deleteText}>✕</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      ))
                    )}

                    {currentUserId && (
                      <View style={s.commentInputRow}>
                        <TextInput
                          testID="health-log-comment-input"
                          style={s.commentInput}
                          value={commentInputs[entry.id] ?? ''}
                          onChangeText={t =>
                            setCommentInputs(prev => ({ ...prev, [entry.id]: t }))
                          }
                          placeholder="Add a comment..."
                          placeholderTextColor={theme.textMuted}
                          maxLength={200}
                        />
                        <TouchableOpacity
                          style={[s.sendBtn, sendingIds.has(entry.id) && s.btnDisabled]}
                          onPress={() => handleAddComment(entry.id)}
                          disabled={sendingIds.has(entry.id)}
                        >
                          {sendingIds.has(entry.id) ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <Text style={s.sendBtnText}>Send</Text>
                          )}
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                )}
              </View>
            );
          })}
          {log.length > 3 && (
            <TouchableOpacity onPress={() => setShowAll(v => !v)} style={s.showAllBtn}>
              <Text style={s.showAllText}>
                {showAll ? 'Show less' : `Show all ${log.length} entries`}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      <Modal
        visible={showAddModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <Text style={s.modalTitle}>Add Health Note</Text>

            <Text style={s.modalLabel}>OBSERVATION</Text>
            <TextInput
              style={[s.modalInput, s.modalInputMultiline]}
              value={noteText}
              onChangeText={t => setNoteText(t.slice(0, 300))}
              placeholder="e.g. leaves yellowing, new growth spotted..."
              placeholderTextColor={theme.textMuted}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              maxLength={300}
            />
            <Text style={s.charCount}>{noteText.length}/300</Text>

            <TouchableOpacity
              style={[s.modalSaveBtn, saving && s.btnDisabled]}
              onPress={handleAdd}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={s.modalSaveBtnText}>Save</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => { setShowAddModal(false); setNoteText(''); }}
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
  container:             { marginTop: 8, marginBottom: 8, backgroundColor: t.background, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: t.border },
  headerRow:             { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionLabel:          { fontSize: 11, fontWeight: '800', color: t.textMuted, letterSpacing: 1 },
  loader:                { marginVertical: 8 },
  emptyText:             { fontSize: 14, color: t.textMuted, fontStyle: 'italic' },
  smallBtn:              { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 100, borderWidth: 1.5, borderColor: t.accent, backgroundColor: t.surfaceGreenSubtle },
  smallBtnText:          { color: t.accentDark, fontWeight: '700', fontSize: 13 },

  historyBox:            { backgroundColor: t.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: t.border },
  entryGroupBorder:      { borderBottomWidth: 1, borderBottomColor: t.border },
  historyEntry:          { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 10 },
  historyDot:            { width: 8, height: 8, borderRadius: 4, backgroundColor: t.accentMid, marginRight: 12, marginTop: 5 },
  historyInfo:           { flex: 1 },
  historyDate:           { fontSize: 12, color: t.textMuted, fontWeight: '600', marginBottom: 2 },
  historyNote:           { fontSize: 14, color: t.textBody },
  deleteText:            { fontSize: 13, color: t.textMuted, paddingLeft: 8 },
  chevronText:           { fontSize: 12, color: t.textMuted, paddingLeft: 8, paddingTop: 2 },
  showAllBtn:            { alignItems: 'center', paddingTop: 12 },
  showAllText:           { fontSize: 13, color: t.accent, fontWeight: '600' },

  commentsSection:       { paddingBottom: 12, paddingLeft: 20 },
  noCommentsText:        { fontSize: 13, color: t.textMuted, fontStyle: 'italic', paddingBottom: 8 },
  commentRow:            { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  commentAvatar:         { width: 28, height: 28, borderRadius: 14, marginRight: 8 },
  commentAvatarInitials: { width: 28, height: 28, borderRadius: 14, marginRight: 8, backgroundColor: t.accentMid, justifyContent: 'center', alignItems: 'center' },
  commentAvatarText:     { fontSize: 12, color: '#fff', fontWeight: '700' },
  commentBody:           { flex: 1 },
  commentUsername:       { fontSize: 12, fontWeight: '700', color: t.textPrimary },
  commentText:           { fontSize: 13, color: t.textBody, marginTop: 2 },
  commentTime:           { fontSize: 11, color: t.textMuted, marginTop: 2 },
  commentInputRow:       { flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 8 },
  commentInput:          { flex: 1, backgroundColor: t.background, borderWidth: 1.5, borderColor: t.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, color: t.textPrimary },
  sendBtn:               { paddingHorizontal: 14, paddingVertical: 8, backgroundColor: t.accent, borderRadius: 12 },
  sendBtnText:           { color: '#fff', fontWeight: '700', fontSize: 13 },

  modalOverlay:          { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalBox:              { backgroundColor: t.surface, borderRadius: 24, padding: 24, width: '100%', maxWidth: 400 },
  modalTitle:            { fontSize: 18, fontWeight: '800', color: t.textTitle, marginBottom: 20 },
  modalLabel:            { fontSize: 12, fontWeight: '700', color: t.textMuted, letterSpacing: 0.8, marginBottom: 6 },
  modalInput:            { backgroundColor: t.background, borderWidth: 1.5, borderColor: t.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, color: t.textPrimary },
  modalInputMultiline:   { minHeight: 96, textAlignVertical: 'top' },
  charCount:             { fontSize: 12, color: t.textMuted, textAlign: 'right', marginTop: 4 },
  btnDisabled:           { opacity: 0.5 },
  modalSaveBtn:          { backgroundColor: t.accent, padding: 14, borderRadius: 16, alignItems: 'center', marginTop: 16 },
  modalSaveBtnText:      { color: '#fff', fontWeight: '700', fontSize: 15 },
  modalCancelBtn:        { alignItems: 'center', paddingVertical: 12 },
  modalCancelText:       { color: t.textMuted, fontSize: 14, fontWeight: '600' },
});
