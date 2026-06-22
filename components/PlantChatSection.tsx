import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme, type Theme } from '../constants/theme';
import { useToast } from '../context/ToastContext';
import { getPlantChat, saveChatMessage, clearPlantChat, type ChatMessage } from '../logic/chatLogic';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:5000';

type Props = {
  plantName: string;
};

function TypingDots({ color }: { color: string }) {
  const dot1 = useSharedValue(0.3);
  const dot2 = useSharedValue(0.3);
  const dot3 = useSharedValue(0.3);

  useEffect(() => {
    const cfg = { duration: 400 };
    dot1.value = withRepeat(withSequence(withTiming(1, cfg), withTiming(0.3, cfg)), -1);
    setTimeout(() => {
      dot2.value = withRepeat(withSequence(withTiming(1, cfg), withTiming(0.3, cfg)), -1);
    }, 133);
    setTimeout(() => {
      dot3.value = withRepeat(withSequence(withTiming(1, cfg), withTiming(0.3, cfg)), -1);
    }, 266);
  }, []);

  const s1 = useAnimatedStyle(() => ({ opacity: dot1.value }));
  const s2 = useAnimatedStyle(() => ({ opacity: dot2.value }));
  const s3 = useAnimatedStyle(() => ({ opacity: dot3.value }));

  const dot: object = { width: 7, height: 7, borderRadius: 4, backgroundColor: color, marginHorizontal: 2 };

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4 }}>
      <Animated.View style={[dot, s1]} />
      <Animated.View style={[dot, s2]} />
      <Animated.View style={[dot, s3]} />
    </View>
  );
}

export default function PlantChatSection({ plantName }: Props) {
  const theme = useTheme();
  const s = useMemo(() => styles(theme), [theme]);
  const { showToast } = useToast();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    (async () => {
      try {
        const history = await getPlantChat(plantName);
        setMessages(history);
      } finally {
        setLoadingHistory(false);
      }
    })();
  }, [plantName]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    }
  }, [messages.length, typing]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || typing) return;
    setInput('');

    const saved = await saveChatMessage(plantName, 'user', text);
    const optimisticUser: ChatMessage = saved ?? {
      id: Date.now().toString(),
      user_id: '',
      plant_name: plantName,
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, optimisticUser]);
    setTyping(true);

    try {
      const aiProvider = (await AsyncStorage.getItem('ai_provider')) ?? 'gemini';
      const provider = aiProvider === 'groq' ? 'groq' : 'gemini';

      const history = [...messages, optimisticUser].map(m => ({ role: m.role, content: m.content }));

      const response = await fetch(`${API_URL}/api/plant-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plantName, messages: history, aiProvider: provider }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({})) as Record<string, unknown>;
        throw new Error((body.error as string) ?? `Server error ${response.status}`);
      }

      const { reply } = await response.json() as { reply: string };

      const savedReply = await saveChatMessage(plantName, 'assistant', reply);
      const assistantMsg: ChatMessage = savedReply ?? {
        id: (Date.now() + 1).toString(),
        user_id: '',
        plant_name: plantName,
        role: 'assistant',
        content: reply,
        created_at: new Date().toISOString(),
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Chat failed';
      showToast(msg, 'error');
    } finally {
      setTyping(false);
    }
  }, [input, typing, messages, plantName, showToast]);

  const handleClear = () => {
    const doClear = async () => {
      await clearPlantChat(plantName);
      setMessages([]);
    };
    if (Platform.OS === 'web') {
      if (window.confirm('Clear all chat messages for this plant?')) doClear();
    } else {
      Alert.alert('Clear chat', 'Delete all messages for this plant?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear', style: 'destructive', onPress: doClear },
      ]);
    }
  };

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.sectionLabel}>ASK ROOTNOTE</Text>
        <TouchableOpacity onPress={handleClear} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={s.clearBtn}>Clear</Text>
        </TouchableOpacity>
      </View>

      {loadingHistory ? (
        <ActivityIndicator size="small" color={theme.accent} style={{ marginVertical: 16 }} />
      ) : (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            ref={scrollRef}
            style={s.messageList}
            contentContainerStyle={s.messageListContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {messages.length === 0 && !typing && (
              <Text style={s.emptyText}>
                Ask anything about your {plantName} — watering, pests, pruning, and more.
              </Text>
            )}

            {messages.map(msg => (
              <View
                key={msg.id}
                style={[s.bubble, msg.role === 'user' ? s.bubbleUser : s.bubbleAssistant]}
              >
                <Text style={msg.role === 'user' ? s.bubbleTextUser : s.bubbleTextAssistant}>
                  {msg.content}
                </Text>
              </View>
            ))}

            {typing && (
              <View style={[s.bubble, s.bubbleAssistant, s.typingBubble]}>
                <TypingDots color={theme.textMuted} />
              </View>
            )}
          </ScrollView>

          <View style={s.inputRow}>
            <TextInput
              style={s.input}
              value={input}
              onChangeText={setInput}
              placeholder={`Ask about your ${plantName}…`}
              placeholderTextColor={theme.textMuted}
              returnKeyType="send"
              onSubmitEditing={handleSend}
              editable={!typing}
              multiline
            />
            <TouchableOpacity
              style={[s.sendBtn, (!input.trim() || typing) && s.sendBtnDisabled]}
              onPress={handleSend}
              disabled={!input.trim() || typing}
            >
              <Text style={s.sendBtnText}>Send</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

const styles = (t: Theme) => StyleSheet.create({
  container: {
    marginTop: 8,
    marginBottom: 8,
    backgroundColor: t.background,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: t.border,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: t.textMuted,
    letterSpacing: 1,
  },
  clearBtn: {
    fontSize: 13,
    fontWeight: '600',
    color: t.textMuted,
  },

  messageList: { maxHeight: 320 },
  messageListContent: { gap: 8, paddingBottom: 4 },

  emptyText: {
    color: t.textMuted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    paddingVertical: 12,
  },

  bubble: {
    maxWidth: '82%',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleUser: {
    alignSelf: 'flex-end',
    backgroundColor: t.accent,
    borderBottomRightRadius: 4,
  },
  bubbleAssistant: {
    alignSelf: 'flex-start',
    backgroundColor: t.surface,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: t.border,
  },
  bubbleTextUser:      { color: '#fff', fontSize: 14, lineHeight: 20 },
  bubbleTextAssistant: { color: t.textPrimary, fontSize: 14, lineHeight: 20 },
  typingBubble: { paddingVertical: 12 },

  inputRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    backgroundColor: t.surface,
    borderWidth: 1.5,
    borderColor: t.border,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: t.textPrimary,
    maxHeight: 100,
  },
  sendBtn: {
    backgroundColor: t.accent,
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 10,
    justifyContent: 'center',
    minHeight: 44,
  },
  sendBtnDisabled: { opacity: 0.4 },
  sendBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
