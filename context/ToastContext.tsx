import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useTheme } from '../constants/theme';

type ToastType = 'success' | 'error' | 'info';

type ToastContextValue = {
  showToast: (message: string, type: ToastType) => void;
};

const ToastContext = createContext<ToastContextValue>({ showToast: () => {} });

export function useToast(): ToastContextValue {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const [toastKey, setToastKey] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string, type: ToastType) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast({ message, type });
    setToastKey(k => k + 1);
    timerRef.current = setTimeout(() => setToast(null), 3000);
  }, []);

  const bgColor = toast?.type === 'success' ? '#059669'
    : toast?.type === 'error' ? '#ef4444'
    : theme.accent;

  return (
    <ToastContext.Provider value={{ showToast }}>
      <View style={s.root}>
        {children}
        {toast && (
          <Animated.View
            key={toastKey}
            entering={FadeInDown}
            exiting={FadeOutDown}
            pointerEvents="none"
            style={s.overlay}
          >
            <View style={[s.pill, { backgroundColor: bgColor }]}>
              <Text style={s.text}>{toast.message}</Text>
            </View>
          </Animated.View>
        )}
      </View>
    </ToastContext.Provider>
  );
}

const s = StyleSheet.create({
  root:    { flex: 1 },
  overlay: { position: 'absolute', bottom: 90, left: 0, right: 0, alignItems: 'center' },
  pill: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 6,
  },
  text: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
