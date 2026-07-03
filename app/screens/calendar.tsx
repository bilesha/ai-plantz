import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme, type Theme } from '../../constants/theme';
import { getCollection } from '../../logic/collectionLogic';
import { getFertilizerRecipes, type FertilizerRecipe } from '../../logic/fertilizerLogic';
import { getSeasonalAdvice, getSeasonEmoji, type SeasonalAdvice } from '../../logic/seasonalAdviceLogic';
import {
  groupEventsByDay,
  getUnscheduledRecipes,
  projectFertilizerEvents,
  projectWateringEvents,
  toDateKey,
  type CalendarEvent,
} from '../../logic/calendarLogic';
import type { CollectionEntry } from '../../types';

const WATER_COLOR = '#3b82f6';
const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function weekDayLabel(d: Date, today: Date): string {
  const diff = Math.round(
    (new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() -
      new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) / 86_400_000,
  );
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  return d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' });
}

export default function CareCalendarScreen() {
  const router = useRouter();
  const theme = useTheme();
  const s = useMemo(() => styles(theme), [theme]);

  const [loading, setLoading] = useState(true);
  const [collection, setCollection] = useState<CollectionEntry[]>([]);
  const [recipes, setRecipes] = useState<FertilizerRecipe[]>([]);
  const [seasonal, setSeasonal] = useState<SeasonalAdvice | null>(null);

  const [view, setView] = useState<'week' | 'month'>('week');
  const today = useMemo(() => new Date(), []);
  const [monthCursor, setMonthCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDay, setSelectedDay] = useState(() => toDateKey(today));

  useEffect(() => {
    (async () => {
      const [collectionData, recipeData, seasonalData] = await Promise.all([
        getCollection(),
        getFertilizerRecipes(),
        getSeasonalAdvice().catch(() => null),
      ]);
      setCollection(collectionData);
      setRecipes(recipeData);
      setSeasonal(seasonalData);
      setLoading(false);
    })();
  }, []);

  // ── Event computation for the visible range ─────────────────────────────────

  const { eventsByDay, monthDays, leadingBlanks } = useMemo(() => {
    let rangeStart: Date;
    let rangeEnd: Date;
    if (view === 'week') {
      rangeStart = today;
      rangeEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 6);
    } else {
      rangeStart = monthCursor;
      rangeEnd = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 0);
    }

    const events: CalendarEvent[] = [
      ...projectWateringEvents(collection, rangeStart, rangeEnd, today),
      ...projectFertilizerEvents(recipes, rangeStart, rangeEnd, today),
    ];

    const daysInMonth = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 0).getDate();
    return {
      eventsByDay: groupEventsByDay(events),
      monthDays: Array.from({ length: daysInMonth }, (_, i) => i + 1),
      leadingBlanks: monthCursor.getDay(),
    };
  }, [view, monthCursor, collection, recipes, today]);

  const unscheduled = useMemo(() => getUnscheduledRecipes(recipes), [recipes]);

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => new Date(today.getFullYear(), today.getMonth(), today.getDate() + i)),
    [today],
  );
  const weekIsEmpty = weekDays.every(d => !(eventsByDay[toDateKey(d)]?.length));

  const changeMonth = (delta: number) => {
    const next = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + delta, 1);
    setMonthCursor(next);
    const isCurrentMonth = next.getFullYear() === today.getFullYear() && next.getMonth() === today.getMonth();
    setSelectedDay(isCurrentMonth ? toDateKey(today) : toDateKey(next));
  };

  const handleEventPress = (event: CalendarEvent) => {
    if (event.type === 'watering') {
      router.push({ pathname: '/screens/PlantDetailsAiGenerated', params: { plantName: event.title } });
    } else {
      router.push('/screens/fertilizer');
    }
  };

  // ── Render helpers ───────────────────────────────────────────────────────────

  const renderEventRow = (event: CalendarEvent, key: string) => (
    <TouchableOpacity key={key} style={s.eventRow} onPress={() => handleEventPress(event)} activeOpacity={0.7}>
      <Text style={s.eventIcon}>{event.type === 'watering' ? '💧' : '🧪'}</Text>
      <View style={s.eventText}>
        <Text style={s.eventTitle} numberOfLines={1}>{event.title}</Text>
        {!!event.subtitle && <Text style={s.eventSubtitle} numberOfLines={1}>{event.subtitle}</Text>}
      </View>
      {event.overdue && (
        <View style={s.overduePill}><Text style={s.overduePillText}>Overdue</Text></View>
      )}
    </TouchableOpacity>
  );

  const selectedDayEvents = eventsByDay[selectedDay] ?? [];

  return (
    <View style={s.root}>
      {/* Header — identical pattern to fertilizer.tsx / leaderboard.tsx */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={s.backArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={s.title}>Care Calendar</Text>
      </View>

      {/* View toggle */}
      <View style={s.tabRow}>
        <TouchableOpacity testID="calendar-week-tab" style={[s.tab, view === 'week' && s.tabActive]} onPress={() => setView('week')}>
          <Text style={[s.tabText, view === 'week' && s.tabTextActive]}>This Week</Text>
        </TouchableOpacity>
        <TouchableOpacity testID="calendar-month-tab" style={[s.tab, view === 'month' && s.tabActive]} onPress={() => setView('month')}>
          <Text style={[s.tabText, view === 'month' && s.tabTextActive]}>Month</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={s.centered}><ActivityIndicator size="large" color={theme.accent} /></View>
      ) : (
        <ScrollView contentContainerStyle={s.content}>
          {/* Seasonal advice banner (needs a saved location) */}
          {seasonal && (
            <View style={s.seasonCard}>
              <Text style={s.seasonTitle}>
                {getSeasonEmoji(seasonal.season)} {seasonal.season.charAt(0).toUpperCase() + seasonal.season.slice(1)} care
              </Text>
              {seasonal.advice.slice(0, 3).map((tip, i) => (
                <Text key={i} style={s.seasonTip}>• {tip}</Text>
              ))}
            </View>
          )}

          {view === 'week' ? (
            weekIsEmpty ? (
              <View style={s.emptyState}>
                <Text style={s.emptyIcon}>🗓️</Text>
                <Text style={s.emptyTitle}>Nothing scheduled this week</Text>
                <Text style={s.emptyBody}>
                  Set a watering interval on your plants, or give your fertilizer recipes a frequency like "every 2 weeks", and they'll show up here.
                </Text>
              </View>
            ) : (
              weekDays.map(day => {
                const dayEvents = eventsByDay[toDateKey(day)] ?? [];
                if (dayEvents.length === 0) return null;
                return (
                  <View key={toDateKey(day)} style={s.daySection}>
                    <Text style={s.dayHeading}>{weekDayLabel(day, today)}</Text>
                    <View style={s.dayCard}>
                      {dayEvents.map((event, i) => renderEventRow(event, `${event.type}-${event.title}-${i}`))}
                    </View>
                  </View>
                );
              })
            )
          ) : (
            <>
              {/* Month navigation */}
              <View style={s.monthNav}>
                <TouchableOpacity onPress={() => changeMonth(-1)} style={s.monthNavBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={s.monthNavArrow}>‹</Text>
                </TouchableOpacity>
                <Text style={s.monthNavTitle}>
                  {MONTH_NAMES[monthCursor.getMonth()]} {monthCursor.getFullYear()}
                </Text>
                <TouchableOpacity onPress={() => changeMonth(1)} style={s.monthNavBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={s.monthNavArrow}>›</Text>
                </TouchableOpacity>
              </View>

              {/* Weekday labels + day grid */}
              <View style={s.grid}>
                {WEEKDAY_LABELS.map((label, i) => (
                  <View key={`h${i}`} style={s.gridCell}>
                    <Text style={s.gridHeaderText}>{label}</Text>
                  </View>
                ))}
                {Array.from({ length: leadingBlanks }, (_, i) => (
                  <View key={`b${i}`} style={s.gridCell} />
                ))}
                {monthDays.map(dayNum => {
                  const key = toDateKey(new Date(monthCursor.getFullYear(), monthCursor.getMonth(), dayNum));
                  const dayEvents = eventsByDay[key] ?? [];
                  const isToday = key === toDateKey(today);
                  const isSelected = key === selectedDay;
                  return (
                    <TouchableOpacity
                      key={key}
                      style={s.gridCell}
                      onPress={() => setSelectedDay(key)}
                      activeOpacity={0.6}
                    >
                      <View style={[s.dayCircle, isToday && s.dayCircleToday, isSelected && s.dayCircleSelected]}>
                        <Text style={[s.dayNumber, isToday && s.dayNumberToday, isSelected && s.dayNumberSelected]}>{dayNum}</Text>
                      </View>
                      <View style={s.dotRow}>
                        {dayEvents.some(e => e.type === 'watering') && <View style={[s.dot, { backgroundColor: WATER_COLOR }]} />}
                        {dayEvents.some(e => e.type === 'fertilizer') && <View style={[s.dot, { backgroundColor: theme.accent }]} />}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Selected-day event list */}
              <View style={s.daySection}>
                <Text style={s.dayHeading}>
                  {new Date(selectedDay + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
                </Text>
                {selectedDayEvents.length === 0 ? (
                  <View style={s.dayCard}>
                    <Text style={s.noEventsText}>Nothing scheduled this day.</Text>
                  </View>
                ) : (
                  <View style={s.dayCard}>
                    {selectedDayEvents.map((event, i) => renderEventRow(event, `${event.type}-${event.title}-${i}`))}
                  </View>
                )}
              </View>
            </>
          )}

          {/* Recipes the frequency parser couldn't schedule */}
          {unscheduled.length > 0 && (
            <View style={s.unscheduledBox}>
              <Text style={s.unscheduledTitle}>Not on the calendar</Text>
              {unscheduled.map(r => (
                <Text key={r.id} style={s.unscheduledText}>
                  🧪 {r.name}{r.frequency ? ` — "${r.frequency}" isn't a recognizable schedule` : ' — no frequency set'}
                </Text>
              ))}
              <Text style={s.unscheduledHint}>
                Tip: use frequencies like "weekly", "every 10 days", or "monthly" so recipes appear on the calendar.
              </Text>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = (t: Theme) => StyleSheet.create({
  root: { flex: 1, backgroundColor: t.background },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingTop: 56, paddingBottom: 12, paddingHorizontal: 20,
    backgroundColor: t.surface,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.border,
    gap: 8,
  },
  backBtn:   { paddingRight: 4 },
  backArrow: { fontSize: 30, color: t.accent, lineHeight: 32 },
  title:     { fontSize: 20, fontWeight: '800', color: t.textTitle },

  tabRow: {
    flexDirection: 'row', padding: 12, gap: 8,
    backgroundColor: t.surface,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.border,
  },
  tab:          { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center', backgroundColor: t.background },
  tabActive:    { backgroundColor: t.accent },
  tabText:      { fontSize: 14, fontWeight: '700', color: t.textMuted },
  tabTextActive:{ color: '#fff' },

  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content:  { padding: 16, paddingBottom: 48 },

  seasonCard:  { backgroundColor: t.surfaceGreenSubtle, borderRadius: 16, borderWidth: 1, borderColor: t.accent, padding: 16, marginBottom: 16 },
  seasonTitle: { fontSize: 15, fontWeight: '800', color: t.textTitle, marginBottom: 8, textTransform: 'capitalize' },
  seasonTip:   { fontSize: 13, color: t.textPrimary, lineHeight: 20 },

  daySection: { marginBottom: 16 },
  dayHeading: { fontSize: 12, fontWeight: '800', letterSpacing: 1, color: t.textMuted, marginBottom: 8, textTransform: 'uppercase' },
  dayCard:    { backgroundColor: t.surface, borderRadius: 16, borderWidth: 1, borderColor: t.border, overflow: 'hidden' },

  eventRow:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.border },
  eventIcon:     { fontSize: 18 },
  eventText:     { flex: 1 },
  eventTitle:    { fontSize: 15, fontWeight: '700', color: t.textPrimary },
  eventSubtitle: { fontSize: 12, color: t.textMuted, marginTop: 1 },
  overduePill:     { backgroundColor: 'rgba(239,68,68,0.12)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.4)', borderRadius: 100, paddingHorizontal: 10, paddingVertical: 3 },
  overduePillText: { color: '#ef4444', fontWeight: '700', fontSize: 11 },

  noEventsText: { fontSize: 14, color: t.textMuted, fontStyle: 'italic', padding: 14 },

  monthNav:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, paddingHorizontal: 4 },
  monthNavBtn:   { padding: 4 },
  monthNavArrow: { fontSize: 26, color: t.accent, fontWeight: '700' },
  monthNavTitle: { fontSize: 16, fontWeight: '800', color: t.textTitle },

  grid:           { flexDirection: 'row', flexWrap: 'wrap', backgroundColor: t.surface, borderRadius: 16, borderWidth: 1, borderColor: t.border, paddingVertical: 8, marginBottom: 16 },
  gridCell:       { width: `${100 / 7}%`, alignItems: 'center', paddingVertical: 4 },
  gridHeaderText: { fontSize: 11, fontWeight: '800', color: t.textMuted },
  dayCircle:         { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  dayCircleToday:    { borderWidth: 1.5, borderColor: t.accent },
  dayCircleSelected: { backgroundColor: t.accent },
  dayNumber:         { fontSize: 13, fontWeight: '600', color: t.textPrimary },
  dayNumberToday:    { fontWeight: '800', color: t.accent },
  dayNumberSelected: { fontWeight: '800', color: '#fff' },
  dotRow: { flexDirection: 'row', gap: 3, height: 6, marginTop: 2 },
  dot:    { width: 5, height: 5, borderRadius: 3 },

  emptyState: { alignItems: 'center', paddingHorizontal: 32, paddingVertical: 40 },
  emptyIcon:  { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: t.textTitle, marginBottom: 8, textAlign: 'center' },
  emptyBody:  { fontSize: 14, color: t.textSecondary, textAlign: 'center', lineHeight: 21 },

  unscheduledBox:   { backgroundColor: t.surface, borderRadius: 16, borderWidth: 1, borderColor: t.border, padding: 14, marginTop: 4 },
  unscheduledTitle: { fontSize: 12, fontWeight: '800', letterSpacing: 1, color: t.textMuted, marginBottom: 8, textTransform: 'uppercase' },
  unscheduledText:  { fontSize: 13, color: t.textPrimary, lineHeight: 20, marginBottom: 4 },
  unscheduledHint:  { fontSize: 12, color: t.textMuted, marginTop: 6, fontStyle: 'italic' },
});
