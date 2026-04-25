import { useColorScheme } from 'react-native';

export const lightTheme = {
  // Surfaces
  background:         '#f8fafc',  // page / screen background
  surface:            '#ffffff',  // cards, inputs, elevated elements
  surfaceGreen:       '#ecfdf5',  // summary box, random button
  surfaceGreenSubtle: '#f0fdf4',  // outline button background

  // Text
  textHeading:   '#0f172a',  // large detail-screen titles
  textTitle:     '#064e3b',  // app title, section titles
  textPrimary:   '#1e293b',  // plant names, input text
  textBody:      '#334155',  // card value text
  textSecondary: '#64748b',  // subtitles, summaries, pill text
  textMuted:     '#94a3b8',  // placeholders, section labels, delete icon

  // Brand / accent
  accent:         '#059669',  // primary buttons, labels, borders
  accentMid:      '#10b981',  // divider bar, left border accent
  accentDark:     '#065f46',  // text on green surfaces
  accentDisabled: '#a7f3d0',  // disabled primary button

  // Borders
  border:      '#e2e8f0',  // pills, inputs, inactive filter buttons
  borderGreen: '#d1fae5',  // summary box, skeleton left border

  // Feedback
  errorBg:     '#fef2f2',
  errorBorder: '#fee2e2',
  errorText:   '#dc2626',
  danger:      '#f87171',  // destructive actions (clear, delete)
};

export const darkTheme = {
  // Surfaces
  background:         '#0f172a',
  surface:            '#1e293b',
  surfaceGreen:       '#064e3b',
  surfaceGreenSubtle: '#022c22',

  // Text
  textHeading:   '#f8fafc',
  textTitle:     '#6ee7b7',  // emerald-300 — readable on dark bg
  textPrimary:   '#f1f5f9',
  textBody:      '#cbd5e1',
  textSecondary: '#94a3b8',
  textMuted:     '#475569',

  // Brand / accent
  accent:         '#10b981',
  accentMid:      '#34d399',
  accentDark:     '#34d399',  // text on dark green surfaces
  accentDisabled: '#064e3b',

  // Borders
  border:      '#334155',
  borderGreen: '#065f46',

  // Feedback
  errorBg:     '#450a0a',
  errorBorder: '#7f1d1d',
  errorText:   '#fca5a5',
  danger:      '#f87171',
};

export type Theme = typeof lightTheme;

export function useTheme(): Theme {
  const scheme = useColorScheme();
  return scheme === 'dark' ? darkTheme : lightTheme;
}
