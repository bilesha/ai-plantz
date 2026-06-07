import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme, type Theme } from '../constants/theme';
import {
  getLikes,
  toggleLike,
  getComments,
  addComment,
  deleteComment,
  type CommentItem,
} from '../logic/socialLogic';

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${Math.max(1, mins)}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

type Props = {
  plantOwnerUserId: string;
  plantName: string;
  currentUserId: string | null;
};

export default function PlantSocialSection({ plantOwnerUserId, plantName, currentUserId }: Props) {
  const theme = useTheme();
  const s = useMemo(() => styles(theme), [theme]);

  const [likeCount, setLikeCount]         = useState(0);
  const [hasLiked, setHasLiked]           = useState(false);
  const [likeLoading, setLikeLoading]     = useState(false);
  const [comments, setComments]           = useState<CommentItem[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [commentText, setCommentText]     = useState('');
  const [sending, setSending]             = useState(false);

  useEffect(() => {
    (async () => {
      const [likes, commentData] = await Promise.all([
        getLikes(plantOwnerUserId, plantName),
        getComments(plantOwnerUserId, plantName),
      ]);
      setLikeCount(likes.count);
      setHasLiked(likes.hasLiked);
      setComments(commentData);
      setCommentsLoading(false);
    })();
  }, [plantOwnerUserId, plantName]);

  const handleToggleLike = async () => {
    if (!currentUserId || likeLoading) return;
    setLikeLoading(true);
    const optimistic = !hasLiked;
    setHasLiked(optimistic);
    setLikeCount(c => optimistic ? c + 1 : c - 1);
    try {
      const confirmed = await toggleLike(plantOwnerUserId, plantName);
      if (confirmed !== optimistic) {
        setHasLiked(confirmed);
        setLikeCount(c => confirmed ? c + 1 : c - 1);
      }
    } catch {
      setHasLiked(!optimistic);
      setLikeCount(c => optimistic ? c - 1 : c + 1);
    } finally {
      setLikeLoading(false);
    }
  };

  const handleSend = async () => {
    const trimmed = commentText.trim();
    if (!trimmed || !currentUserId || sending) return;
    setSending(true);
    const newComment = await addComment(plantOwnerUserId, plantName, trimmed);
    if (newComment) {
      setComments(prev => [...prev, newComment]);
      setCommentText('');
    }
    setSending(false);
  };

  const handleDelete = async (commentId: string) => {
    setComments(prev => prev.filter(c => c.id !== commentId));
    await deleteComment(commentId);
  };

  return (
    <View style={s.container}>
      {/* Like row */}
      <View style={s.likeRow}>
        <TouchableOpacity
          style={s.likeBtn}
          onPress={handleToggleLike}
          disabled={!currentUserId || likeLoading}
          activeOpacity={0.7}
        >
          <Text style={s.likeHeart}>{hasLiked ? '❤️' : '🤍'}</Text>
        </TouchableOpacity>
        <Text style={s.likeCount}>{likeCount} {likeCount === 1 ? 'like' : 'likes'}</Text>
      </View>

      {/* Comments section */}
      <Text style={s.sectionLabel}>COMMENTS</Text>

      {commentsLoading ? (
        <ActivityIndicator size="small" color={theme.accent} style={s.loader} />
      ) : comments.length === 0 ? (
        <Text style={s.emptyComments}>No comments yet. Be the first!</Text>
      ) : (
        comments.map(comment => (
          <View key={comment.id} style={s.commentRow}>
            {comment.avatar_url ? (
              <Image source={{ uri: comment.avatar_url }} style={s.commentAvatar} />
            ) : (
              <View style={s.commentAvatarPlaceholder}>
                <Text style={s.commentAvatarEmoji}>🪴</Text>
              </View>
            )}
            <View style={s.commentBody}>
              <View style={s.commentMeta}>
                <Text style={s.commentUsername}>{comment.username ?? 'User'}</Text>
                <Text style={s.commentTime}>{relativeTime(comment.created_at)}</Text>
              </View>
              <Text style={s.commentText}>{comment.body}</Text>
            </View>
            {comment.user_id === currentUserId && (
              <TouchableOpacity
                onPress={() => handleDelete(comment.id)}
                style={s.deleteBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={s.deleteText}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
        ))
      )}

      {/* Comment input */}
      <View style={s.inputRow}>
        <TextInput
          style={s.input}
          value={commentText}
          onChangeText={setCommentText}
          placeholder={currentUserId ? 'Add a comment...' : 'Sign in to comment'}
          placeholderTextColor={theme.textMuted}
          editable={!!currentUserId}
          returnKeyType="send"
          onSubmitEditing={handleSend}
        />
        <TouchableOpacity
          style={[s.sendBtn, (!commentText.trim() || !currentUserId) && s.sendBtnDisabled]}
          onPress={handleSend}
          disabled={!commentText.trim() || !currentUserId || sending}
        >
          {sending
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={s.sendBtnText}>Send</Text>
          }
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = (t: Theme) => StyleSheet.create({
  container:                { marginTop: 8 },
  likeRow:                  { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  likeBtn:                  { marginRight: 8 },
  likeHeart:                { fontSize: 26 },
  likeCount:                { fontSize: 15, color: t.textSecondary, fontWeight: '600' },
  sectionLabel:             { fontSize: 11, fontWeight: '800', color: t.textMuted, letterSpacing: 1, marginBottom: 12 },
  loader:                   { marginVertical: 12 },
  emptyComments:            { fontSize: 14, color: t.textMuted, marginBottom: 16 },
  commentRow:               { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 14 },
  commentAvatar:            { width: 36, height: 36, borderRadius: 18, marginRight: 10, backgroundColor: t.border },
  commentAvatarPlaceholder: { width: 36, height: 36, borderRadius: 18, marginRight: 10, backgroundColor: t.surfaceGreenSubtle, justifyContent: 'center', alignItems: 'center' },
  commentAvatarEmoji:       { fontSize: 16 },
  commentBody:              { flex: 1 },
  commentMeta:              { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 },
  commentUsername:          { fontSize: 13, fontWeight: '700', color: t.textPrimary },
  commentTime:              { fontSize: 12, color: t.textMuted },
  commentText:              { fontSize: 14, color: t.textBody, lineHeight: 20 },
  deleteBtn:                { paddingLeft: 8 },
  deleteText:               { fontSize: 12, color: t.textMuted },
  inputRow:                 { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16 },
  input:                    { flex: 1, backgroundColor: t.surface, borderWidth: 1.5, borderColor: t.border, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: t.textPrimary },
  sendBtn:                  { backgroundColor: t.accent, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, minWidth: 60, alignItems: 'center' },
  sendBtnDisabled:          { backgroundColor: t.accentDisabled },
  sendBtnText:              { color: '#fff', fontWeight: '700', fontSize: 14 },
});
