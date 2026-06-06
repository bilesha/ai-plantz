import { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '../constants/theme';
import BottomTabBar from './BottomTabBar';

export default function ScreenLayout({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      {children}
      <BottomTabBar />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
