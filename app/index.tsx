// Requires the following Supabase RLS policies:
//   create policy "public read" on profiles for select using (true);
//
// Required Supabase RPC functions (run once in SQL editor):
//
//   create or replace function get_trending_plants(limit_count int default 10)
//   returns table(plant_name text, collection_count bigint, like_count bigint)
//   language sql security definer as $$
//     select
//       pc.plant_name,
//       count(distinct pc.id)  as collection_count,
//       count(distinct pl.id)  as like_count
//     from plant_collection pc
//     left join plant_likes pl on pl.plant_name = pc.plant_name
//     group by pc.plant_name
//     order by collection_count desc
//     limit limit_count;
//   $$;
//
//   create or replace function get_suggested_users(viewer_id uuid, limit_count int default 6)
//   returns table(id uuid, username text, avatar_url text, plant_count bigint, follower_count bigint)
//   language sql security definer as $$
//     select
//       p.id,
//       p.username,
//       p.avatar_url,
//       count(distinct pc.id) as plant_count,
//       count(distinct f.id)  as follower_count
//     from profiles p
//     left join plant_collection pc on pc.user_id = p.id
//     left join follows f on f.following_id = p.id
//     where p.id != viewer_id
//       and p.id not in (
//         select following_id from follows where follower_id = viewer_id
//       )
//     group by p.id
//     order by follower_count desc, plant_count desc
//     limit limit_count;
//   $$;

import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { PLANT_SUGGESTIONS } from '../constants/plants';
import { useTheme, type Theme } from '../constants/theme';
import ScreenLayout from '../components/ScreenLayout';
import { supabase } from '../lib/supabase';
import { getFeed, type FeedItem } from '../logic/feedLogic';
import { getActiveListings, type ListingWithProfile } from '../logic/listingLogic';
import { followUser } from '../logic/followLogic';
import { useToast } from '../context/ToastContext';
import FeedItemRow from '../components/FeedItem';
import {
  getCurrentNominations,
  getUserNominationThisWeek,
  nominatePlant,
  voteForNomination,
  type PotWNomination,
} from '../logic/potwLogic';
import { searchPlants } from '../utilities/fetchPlantSearch';

type ProfileResult = {
  id: string;
  username: string | null;
  bio: string | null;
  avatar_url: string | null;
};

type TrendingPlant = {
  plant_name: string;
  collection_count: number;
  like_count: number;
};

type SuggestedUser = {
  id: string;
  username: string | null;
  avatar_url: string | null;
  plant_count: number;
  follower_count: number;
};

type PlantResult = {
  id: number;
  commonName: string | null;
  scientificName: string;
  imageUrl: string | null;
};

async function getTrendingPlants(): Promise<TrendingPlant[]> {
  const { data, error } = await supabase.rpc('get_trending_plants', { limit_count: 10 });
  if (error || !data) return [];
  return data as TrendingPlant[];
}

function getInitials(str: string): string {
  const parts = str.trim().split(/[\s._@]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return str.slice(0, 2).toUpperCase();
}

function Avatar({ url, name, size, style: styleProp }: {
  url: string | null;
  name: string;
  size: number;
  style?: object;
}) {
  const [errored, setErrored] = useState(false);
  const theme = useTheme();
  const s = useMemo(() => avatarStyles(theme), [theme]);
  const showImage = !errored && !!url?.startsWith('http');

  return showImage ? (
    <Image
      source={{ uri: url! }}
      style={[{ width: size, height: size, borderRadius: size / 2 }, styleProp]}
      onError={() => setErrored(true)}
    />
  ) : (
    <View style={[s.placeholder, { width: size, height: size, borderRadius: size / 2 }, styleProp]}>
      <Text style={[s.initials, { fontSize: size * 0.35 }]}>{getInitials(name)}</Text>
    </View>
  );
}

const avatarStyles = (t: Theme) => StyleSheet.create({
  placeholder: { backgroundColor: t.accent, justifyContent: 'center', alignItems: 'center' },
  initials:    { fontWeight: '900', color: '#fff' },
});

function PlantResultIcon({ imageUrl, theme }: { imageUrl: string | null; theme: Theme }) {
  const [errored, setErrored] = useState(false);
  const s = useMemo(() => styles(theme), [theme]);

  if (imageUrl && !errored) {
    return (
      <Image
        source={{ uri: imageUrl }}
        style={{ width: 44, height: 44, borderRadius: 22 }}
        onError={() => setErrored(true)}
      />
    );
  }
  return (
    <View style={s.plantResultIcon}>
      <Text style={s.plantResultEmoji}>🌿</Text>
    </View>
  );
}

export default function DiscoverScreen() {
  const router = useRouter();
  const theme = useTheme();
  const s = useMemo(() => styles(theme), [theme]);
  const { showToast } = useToast();

  const [query, setQuery]             = useState('');
  const [searchType, setSearchType]   = useState<'users' | 'plants'>('users');
  const [results, setResults]         = useState<ProfileResult[]>([]);
  const [plantResults, setPlantResults] = useState<PlantResult[]>([]);
  const [loading, setLoading]         = useState(false);
  const [searched, setSearched]       = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [trending, setTrending]               = useState<TrendingPlant[]>([]);
  const [trendingLoading, setTrendingLoading] = useState(true);
  const [marketplace, setMarketplace]             = useState<ListingWithProfile[]>([]);
  const [marketplaceLoading, setMarketplaceLoading] = useState(true);
  const [activity, setActivity]               = useState<FeedItem[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [suggested, setSuggested]             = useState<SuggestedUser[]>([]);
  const [suggestedLoading, setSuggestedLoading] = useState(false);
  // undefined = auth not yet resolved; null = not logged in; string = user id
  const [viewerId, setViewerId] = useState<string | null | undefined>(undefined);

  const [potwNominations, setPotwNominations]         = useState<PotWNomination[]>([]);
  const [potwLoading, setPotwLoading]                 = useState(true);
  const [showNominateModal, setShowNominateModal]     = useState(false);
  const [nominatePlantName, setNominatePlantName]     = useState('');
  const [nominateReason, setNominateReason]           = useState('');
  const [nominateSuggestions, setNominateSuggestions] = useState<string[]>([]);
  const [submittingNomination, setSubmittingNomination] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setTrendingLoading(true);
      setMarketplaceLoading(true);
      setPotwLoading(true);

      (async () => {
        const { data: { session } } = await supabase.auth.getSession();
        const uid = session?.user?.id ?? null;
        if (!active) return;
        setViewerId(uid);

        const [trendingData, marketplaceData, potwData] = await Promise.all([
          getTrendingPlants(),
          getActiveListings(6),
          getCurrentNominations(),
        ]);
        if (!active) return;
        setTrending(trendingData);
        setMarketplace(marketplaceData);
        setPotwNominations(potwData);
        setTrendingLoading(false);
        setMarketplaceLoading(false);
        setPotwLoading(false);

        if (uid) setSuggestedLoading(true);
        setActivityLoading(true);

        const [feedData, suggestedResult] = await Promise.all([
          getFeed(5),
          uid
            ? supabase.rpc('get_suggested_users', { viewer_id: uid, limit_count: 6 })
            : Promise.resolve({ data: null }),
        ]);

        if (!active) return;
        setActivity(feedData);
        setActivityLoading(false);
        if (uid) {
          setSuggested((suggestedResult.data as SuggestedUser[] | null) ?? []);
          setSuggestedLoading(false);
        }
      })();

      return () => { active = false; };
    }, [])
  );

  const handleFollowSuggested = async (userId: string) => {
    setSuggested(prev => prev.filter(u => u.id !== userId));
    await followUser(userId);
    showToast('Following!', 'success');
  };

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setPlantResults([]);
      setSearched(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        if (searchType === 'users') {
          const { data } = await supabase
            .from('profiles')
            .select('id, username, bio, avatar_url')
            .ilike('username', `%${trimmed}%`)
            .limit(30);
          setResults((data ?? []) as ProfileResult[]);
          setPlantResults([]);
        } else {
          const { results } = await searchPlants(trimmed);
          const seen = new Set<string>();
          const unique: PlantResult[] = [];
          for (const item of results) {
            const key = item.scientificName.toLowerCase();
            if (!seen.has(key)) {
              seen.add(key);
              unique.push(item);
            }
            if (unique.length === 8) break;
          }
          setPlantResults(unique);
          setResults([]);
        }
        setSearched(true);
      } finally {
        setLoading(false);
      }
    }, 400);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, searchType]);

  const handleVote = (nominationId: string) => {
    if (!viewerId) return;
    setPotwNominations(prev =>
      prev
        .map(n => n.id === nominationId ? { ...n, vote_count: n.vote_count + 1, hasVoted: true } : n)
        .sort((a, b) => b.vote_count - a.vote_count)
    );
    voteForNomination(nominationId);
  };

  const handleNominateNameChange = (text: string) => {
    setNominatePlantName(text);
    const trimmed = text.trim();
    if (trimmed.length >= 2) {
      setNominateSuggestions(
        PLANT_SUGGESTIONS.filter(p => p.toLowerCase().includes(trimmed.toLowerCase())).slice(0, 5)
      );
    } else {
      setNominateSuggestions([]);
    }
  };

  const handleNominate = async () => {
    const name = nominatePlantName.trim();
    if (!name) { showToast('Enter a plant name', 'error'); return; }
    setSubmittingNomination(true);
    try {
      const nomination = await nominatePlant(name, nominateReason.trim() || undefined);
      if (nomination) {
        setPotwNominations(prev =>
          [...prev, nomination].sort((a, b) => b.vote_count - a.vote_count)
        );
        setShowNominateModal(false);
        setNominatePlantName('');
        setNominateReason('');
        setNominateSuggestions([]);
        showToast('Plant nominated! 🏆', 'success');
      } else {
        showToast('Already nominated this week', 'error');
      }
    } finally {
      setSubmittingNomination(false);
    }
  };

  const showSuggested = !!viewerId && (suggestedLoading || suggested.length > 0);
  const userAlreadyVotedThisWeek = potwNominations.some(n => n.hasVoted);
  const myNomination = viewerId
    ? (potwNominations.find(n => n.user_id === viewerId) ?? null)
    : null;

  return (
    <ScreenLayout>
    <ScrollView style={s.container} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      <Text style={s.title}>Discover</Text>

      <View style={s.inputCard}>
        <TextInput
          testID="discover-search-input"
          style={s.input}
          value={query}
          onChangeText={setQuery}
          placeholder="Search users and plants..."
          placeholderTextColor={theme.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
      </View>

      {query.trim().length >= 2 && (
        <View style={s.typeToggleRow}>
          <TouchableOpacity
            testID="search-type-users"
            style={[s.typeTogglePill, searchType === 'users' && s.typeTogglePillActive]}
            onPress={() => setSearchType('users')}
          >
            <Text style={[s.typeToggleText, searchType === 'users' && s.typeToggleTextActive]}>👥 Users</Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="search-type-plants"
            style={[s.typeTogglePill, searchType === 'plants' && s.typeTogglePillActive]}
            onPress={() => setSearchType('plants')}
          >
            <Text style={[s.typeToggleText, searchType === 'plants' && s.typeToggleTextActive]}>🌿 Plants</Text>
          </TouchableOpacity>
        </View>
      )}

      {loading && <ActivityIndicator style={s.spinner} color={theme.accent} />}

      {!loading && query.trim().length > 0 && query.trim().length < 2 && (
        <Text style={s.hint}>Type at least 2 characters to search.</Text>
      )}

      {!loading && searched && searchType === 'users' && results.length === 0 && (
        <View style={s.emptyState}>
          <Text style={s.emptyIcon}>🔍</Text>
          <Text style={s.emptyText}>No users found for "{query.trim()}".</Text>
        </View>
      )}

      {!loading && searched && searchType === 'plants' && plantResults.length === 0 && (
        <View style={s.emptyState}>
          <Text style={s.emptyIcon}>🔍</Text>
          <Text style={s.emptyText}>No plants found for "{query.trim()}".</Text>
          <TouchableOpacity
            style={s.aiSearchBtn}
            onPress={() => router.push({ pathname: '/screens/aiAssistant', params: { plantName: query.trim() } })}
          >
            <Text style={s.aiSearchBtnText}>Don't see it? Search with AI instead</Text>
          </TouchableOpacity>
        </View>
      )}

      {!loading && searchType === 'users' && results.length > 0 && (
        <View style={s.resultsList}>
          {results.map((user, i) => {
            const name = user.username ?? 'Plant Lover';
            return (
              <TouchableOpacity
                key={user.id}
                style={[s.resultRow, i < results.length - 1 && s.resultBorder]}
                onPress={() => router.push({ pathname: '/screens/publicProfile', params: { userId: user.id } })}
                activeOpacity={0.7}
              >
                <Avatar url={user.avatar_url} name={name} size={44} style={s.avatar} />
                <View style={s.resultText}>
                  <Text style={s.resultName}>{name}</Text>
                  {user.bio ? <Text style={s.resultBio} numberOfLines={1}>{user.bio}</Text> : null}
                </View>
                <Text style={s.chevron}>›</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {!loading && searchType === 'plants' && plantResults.length > 0 && (
        <View style={s.resultsList}>
          {plantResults.map((item, i) => (
            <TouchableOpacity
              key={item.id}
              style={[s.resultRow, i < plantResults.length - 1 && s.resultBorder]}
              onPress={() => router.push({
                pathname: '/screens/PlantDetailsAiGenerated',
                params: { plantName: item.commonName ?? item.scientificName },
              })}
              activeOpacity={0.7}
            >
              <PlantResultIcon imageUrl={item.imageUrl} theme={theme} />
              <View style={s.resultText}>
                <Text style={s.resultName}>{item.commonName ?? item.scientificName}</Text>
                {item.commonName && item.commonName !== item.scientificName && (
                  <Text style={s.plantResultSci} numberOfLines={1}>{item.scientificName}</Text>
                )}
              </View>
              <Text style={s.chevron}>›</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {query.trim().length === 0 && (
        <>
          {(trendingLoading || trending.length > 0) && (
            <View style={s.trendingSection}>
              <Text style={s.trendingHeading}>TRENDING PLANTS 🌿</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.trendingScroll}
              >
                {trendingLoading
                  ? [0, 1, 2].map(i => <View key={i} style={s.skeletonPill} />)
                  : trending.map(item => (
                      <TouchableOpacity
                        key={item.plant_name}
                        style={s.trendingPill}
                        onPress={() => router.push({
                          pathname: '/screens/PlantDetailsAiGenerated',
                          params: { plantName: item.plant_name },
                        })}
                        activeOpacity={0.75}
                      >
                        <Text style={s.pillName} numberOfLines={1}>{item.plant_name}</Text>
                        <Text style={s.pillCount}>
                          {item.collection_count} collector{item.collection_count !== 1 ? 's' : ''} · ❤️ {item.like_count}
                        </Text>
                      </TouchableOpacity>
                    ))}
              </ScrollView>
            </View>
          )}

          <TouchableOpacity
            testID="compare-plants-card"
            style={s.compareCard}
            onPress={() => router.push('/screens/compare')}
            activeOpacity={0.8}
          >
            <Text style={s.compareCardIcon}>⚖️</Text>
            <View style={s.compareCardText}>
              <Text style={s.compareCardTitle}>Compare Plants</Text>
              <Text style={s.compareCardSub}>Side-by-side AI care comparison</Text>
            </View>
            <Text style={s.compareCardChevron}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity
            testID="leaderboard-card"
            style={s.compareCard}
            onPress={() => router.push('/screens/leaderboard')}
            activeOpacity={0.8}
          >
            <Text style={s.compareCardIcon}>🏆</Text>
            <View style={s.compareCardText}>
              <Text style={s.compareCardTitle}>Leaderboard</Text>
              <Text style={s.compareCardSub}>Top plant parents ranked by score</Text>
            </View>
            <Text style={s.compareCardChevron}>›</Text>
          </TouchableOpacity>

          {(marketplaceLoading || marketplace.length > 0) && (
            <View testID="marketplace-section" style={s.marketplaceSection}>
              <Text style={s.marketplaceHeading}>MARKETPLACE 🌿</Text>
              <View style={s.marketplaceCard}>
                {marketplaceLoading
                  ? [0, 1, 2].map(i => <View key={i} style={[s.skeletonRow, i < 2 && s.skeletonRowBorder]} />)
                  : marketplace.map((item, i) => {
                      const username = item.profiles?.username ?? 'Plant Lover';
                      return (
                        <TouchableOpacity
                          key={item.id}
                          style={[s.marketplaceRow, i < marketplace.length - 1 && s.marketplaceRowBorder]}
                          onPress={() => router.push({ pathname: '/screens/publicProfile', params: { userId: item.user_id } })}
                          activeOpacity={0.7}
                        >
                          <View style={s.marketplaceLeft}>
                            <Text style={s.marketplacePlantName}>{item.plant_name}</Text>
                            <Text style={s.marketplaceUsername}>@{username}</Text>
                          </View>
                          <View style={s.marketplaceTypePill}>
                            <Text style={s.marketplaceTypePillText}>
                              {item.listing_type === 'trade' ? '🔄 Trade' :
                               item.listing_type === 'gift'  ? '🎁 Gift' :
                               `💰 ${item.price?.toFixed(2) ?? '?'}`}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })
                }
              </View>
            </View>
          )}

          <View testID="potw-section" style={s.potwSection}>
            <Text style={s.potwHeading}>PLANT OF THE WEEK 🏆</Text>
            <View style={s.potwCard}>
              {potwLoading
                ? [0, 1, 2].map(i => <View key={i} style={[s.skeletonRow, i < 2 && s.skeletonRowBorder]} />)
                : potwNominations.length === 0
                  ? (
                    <View style={s.potwEmptyBox}>
                      <Text style={s.potwEmptyText}>No nominations yet this week.</Text>
                    </View>
                  )
                  : potwNominations.map((nom, i) => (
                    <View key={nom.id} style={[s.potwRow, i < potwNominations.length - 1 && s.potwRowBorder]}>
                      <TouchableOpacity
                        style={s.potwLeft}
                        onPress={() => router.push({
                          pathname: '/screens/PlantDetailsAiGenerated',
                          params: { plantName: nom.plant_name },
                        })}
                        activeOpacity={0.7}
                      >
                        <View style={s.potwRankIcon}>
                          {i === 0 ? <Text style={s.potwTrophy}>🏆</Text> : null}
                        </View>
                        <View style={s.potwTextBlock}>
                          <Text style={s.potwPlantName}>{nom.plant_name}</Text>
                          <Text style={s.potwNominator} numberOfLines={2}>
                            {'by @'}{nom.username ?? 'unknown'}
                            {nom.reason
                              ? ` · "${nom.reason.length > 60 ? nom.reason.slice(0, 60) + '…' : nom.reason}"`
                              : ''}
                          </Text>
                        </View>
                      </TouchableOpacity>
                      <View style={s.potwRight}>
                        <Text style={s.potwVoteCount}>{nom.vote_count}</Text>
                        <TouchableOpacity
                          style={[s.voteBtn, (userAlreadyVotedThisWeek || !viewerId) && s.voteBtnDisabled]}
                          disabled={userAlreadyVotedThisWeek || !viewerId}
                          onPress={() => handleVote(nom.id)}
                        >
                          <Text style={s.voteBtnText}>{nom.hasVoted ? '✓' : '👍'}</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))
              }
            </View>

            {!potwLoading && (
              myNomination ? (
                <Text style={s.potwMyNomText}>
                  {'You nominated: '}<Text style={s.potwMyNomPlant}>{myNomination.plant_name}</Text>
                </Text>
              ) : viewerId ? (
                <TouchableOpacity style={s.nominateBtn} onPress={() => setShowNominateModal(true)}>
                  <Text style={s.nominateBtnText}>+ Nominate a plant</Text>
                </TouchableOpacity>
              ) : null
            )}
          </View>

          {showSuggested && (
            <View style={s.suggestedSection}>
              <Text style={s.suggestedHeading}>SUGGESTED FOR YOU 👥</Text>
              <View style={s.suggestedCard}>
                {suggestedLoading
                  ? [0, 1, 2].map(i => (
                      <View key={i} style={[s.skeletonSugRow, i < 2 && s.skeletonSugBorder]} />
                    ))
                  : suggested.map((user, i) => {
                      const name = user.username ?? 'Plant Lover';
                      return (
                        <View key={user.id} style={[s.sugRow, i < suggested.length - 1 && s.sugRowBorder]}>
                          <TouchableOpacity
                            style={s.sugLeft}
                            onPress={() => router.push({ pathname: '/screens/publicProfile', params: { userId: user.id } })}
                            activeOpacity={0.7}
                          >
                            <Avatar url={user.avatar_url} name={name} size={44} style={s.sugAvatar} />
                            <View>
                              <Text style={s.sugName}>{name}</Text>
                              <Text style={s.sugMeta}>
                                {user.plant_count} plant{user.plant_count !== 1 ? 's' : ''} · {user.follower_count} follower{user.follower_count !== 1 ? 's' : ''}
                              </Text>
                            </View>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={s.followBtn}
                            onPress={() => handleFollowSuggested(user.id)}
                          >
                            <Text style={s.followBtnText}>Follow</Text>
                          </TouchableOpacity>
                        </View>
                      );
                    })
                }
              </View>
            </View>
          )}

          {(activityLoading || activity.length > 0) && (
            <View style={s.activitySection}>
              <Text style={s.activityHeading}>FOLLOWING ACTIVITY 🌱</Text>
              <View style={s.activityCard}>
                {activityLoading
                  ? [0, 1].map(i => <View key={i} style={[s.skeletonRow, i === 0 && s.skeletonRowBorder]} />)
                  : activity.map((item, i) => (
                      <View key={item.id} style={i < activity.length - 1 ? s.activityRowBorder : undefined}>
                        <FeedItemRow item={item} />
                      </View>
                    ))
                }
              </View>
              {!activityLoading && activity.length > 0 && (
                <TouchableOpacity style={s.seeAllBtn} onPress={() => router.push('/screens/feed')}>
                  <Text style={s.seeAllText}>See all activity →</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </>
      )}
    </ScrollView>
      <Modal
        testID="potw-nominate-modal"
        visible={showNominateModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowNominateModal(false)}
      >
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <Text style={s.modalTitle}>Nominate a Plant</Text>

            <Text style={s.modalLabel}>PLANT NAME</Text>
            <TextInput
              style={s.modalInput}
              value={nominatePlantName}
              onChangeText={handleNominateNameChange}
              placeholder="e.g. Monstera Deliciosa"
              placeholderTextColor={theme.textMuted}
              autoCapitalize="words"
            />
            {nominateSuggestions.length > 0 && (
              <View style={s.suggestionBox}>
                {nominateSuggestions.map((sug, i) => (
                  <TouchableOpacity
                    key={sug}
                    style={[s.suggestionRow, i < nominateSuggestions.length - 1 && s.suggestionRowBorder]}
                    onPress={() => {
                      setNominatePlantName(sug);
                      setNominateSuggestions([]);
                    }}
                  >
                    <Text style={s.suggestionText}>{sug}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <Text style={[s.modalLabel, { marginTop: 16 }]}>REASON (optional)</Text>
            <TextInput
              style={[s.modalInput, s.modalInputMultiline]}
              value={nominateReason}
              onChangeText={t => setNominateReason(t.slice(0, 150))}
              placeholder="Why this plant deserves the spotlight..."
              placeholderTextColor={theme.textMuted}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              maxLength={150}
            />
            <Text style={s.charCount}>{nominateReason.length}/150</Text>

            <TouchableOpacity
              style={[s.modalSaveBtn, submittingNomination && s.btnDisabled]}
              onPress={handleNominate}
              disabled={submittingNomination}
            >
              {submittingNomination
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={s.modalSaveBtnText}>Nominate</Text>
              }
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                setShowNominateModal(false);
                setNominatePlantName('');
                setNominateReason('');
                setNominateSuggestions([]);
              }}
              style={s.modalCancelBtn}
            >
              <Text style={s.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScreenLayout>
  );
}

const styles = (t: Theme) => StyleSheet.create({
  container:    { flex: 1, backgroundColor: t.background },
  content:      { padding: 24, paddingTop: 60, paddingBottom: 80 },
  title:        { fontSize: 28, fontWeight: '900', color: t.textTitle, marginBottom: 24 },

  trendingSection:  { marginBottom: 24 },
  trendingHeading:  { fontSize: 12, fontWeight: '800', letterSpacing: 1.2, color: t.textMuted, marginBottom: 12 },
  trendingScroll:   { gap: 10, paddingRight: 4 },
  trendingPill:     { backgroundColor: t.surface, borderRadius: 24, paddingHorizontal: 16, paddingVertical: 10, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.07, shadowRadius: 3, maxWidth: 210 },
  pillName:         { fontSize: 14, fontWeight: '700', color: t.textPrimary },
  pillCount:        { fontSize: 12, color: t.accent, marginTop: 2, fontWeight: '600' },
  skeletonPill:     { width: 110, height: 52, borderRadius: 24, backgroundColor: t.border, opacity: 0.6 },

  compareCard:        { flexDirection: 'row', alignItems: 'center', backgroundColor: t.surface, borderRadius: 20, padding: 18, marginBottom: 24, borderWidth: 1, borderColor: t.border, gap: 12 },
  compareCardIcon:    { fontSize: 28 },
  compareCardText:    { flex: 1 },
  compareCardTitle:   { fontSize: 16, fontWeight: '800', color: t.textTitle },
  compareCardSub:     { fontSize: 13, color: t.textMuted, marginTop: 2 },
  compareCardChevron: { fontSize: 24, color: t.accent, fontWeight: '700' },

  marketplaceSection:      { marginBottom: 24 },
  marketplaceHeading:      { fontSize: 12, fontWeight: '800', letterSpacing: 1.2, color: t.textMuted, marginBottom: 12 },
  marketplaceCard:         { backgroundColor: t.surface, borderRadius: 20, overflow: 'hidden', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3 },
  marketplaceRow:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 14 },
  marketplaceRowBorder:    { borderBottomWidth: 1, borderBottomColor: t.border },
  marketplaceLeft:         { flex: 1 },
  marketplacePlantName:    { fontSize: 15, fontWeight: '700', color: t.textPrimary },
  marketplaceUsername:     { fontSize: 12, color: t.textMuted, marginTop: 2 },
  marketplaceTypePill:     { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 100, backgroundColor: t.surfaceGreen },
  marketplaceTypePillText: { fontSize: 12, fontWeight: '700' as const, color: t.accentDark },

  suggestedSection:  { marginBottom: 24 },
  suggestedHeading:  { fontSize: 12, fontWeight: '800', letterSpacing: 1.2, color: t.textMuted, marginBottom: 12 },
  suggestedCard:     { backgroundColor: t.surface, borderRadius: 20, overflow: 'hidden', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3 },
  sugRow:            { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  sugRowBorder:      { borderBottomWidth: 1, borderBottomColor: t.border },
  sugLeft:           { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  sugAvatar:         { backgroundColor: t.border },
  sugName:           { fontSize: 15, fontWeight: '700', color: t.textPrimary },
  sugMeta:           { fontSize: 12, color: t.textMuted, marginTop: 2 },
  followBtn:         { backgroundColor: t.accent, paddingHorizontal: 16, paddingVertical: 7, borderRadius: 100 },
  followBtnText:     { color: '#fff', fontWeight: '700', fontSize: 13 },
  skeletonSugRow:    { height: 68, backgroundColor: t.border, opacity: 0.5 },
  skeletonSugBorder: { borderBottomWidth: 1, borderBottomColor: t.background },

  activitySection:    { marginBottom: 24 },
  activityHeading:    { fontSize: 12, fontWeight: '800', letterSpacing: 1.2, color: t.textMuted, marginBottom: 12 },
  activityCard:       { backgroundColor: t.surface, borderRadius: 20, overflow: 'hidden', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3 },
  activityRowBorder:  { borderBottomWidth: 1, borderBottomColor: t.border },
  skeletonRow:        { height: 52, backgroundColor: t.border, opacity: 0.5 },
  skeletonRowBorder:  { borderBottomWidth: 1, borderBottomColor: t.background },
  seeAllBtn:          { marginTop: 10, alignSelf: 'flex-end' },
  seeAllText:         { fontSize: 13, fontWeight: '700', color: t.accent },

  inputCard:    { backgroundColor: t.surface, borderRadius: 20, paddingHorizontal: 18, paddingVertical: 4, marginBottom: 12, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4 },
  input:        { fontSize: 17, color: t.textPrimary, paddingVertical: 14 },
  spinner:      { marginTop: 24 },
  hint:         { fontSize: 14, color: t.textMuted, textAlign: 'center', marginTop: 12 },

  typeToggleRow:        { flexDirection: 'row', gap: 8, marginBottom: 16 },
  typeTogglePill:       { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 100, borderWidth: 1.5, borderColor: t.border, backgroundColor: t.surface },
  typeTogglePillActive: { borderColor: t.accent, backgroundColor: t.surfaceGreenSubtle },
  typeToggleText:       { fontSize: 14, fontWeight: '700', color: t.textMuted },
  typeToggleTextActive: { color: t.accentDark },

  plantResultIcon:  { width: 44, height: 44, borderRadius: 22, backgroundColor: t.surfaceGreenSubtle, justifyContent: 'center', alignItems: 'center' },
  plantResultEmoji: { fontSize: 20 },
  plantResultSci:   { fontSize: 13, color: t.textSecondary, marginTop: 2 },

  aiSearchBtn:      { marginTop: 16, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 100, borderWidth: 1.5, borderColor: t.accent, backgroundColor: t.surfaceGreenSubtle },
  aiSearchBtnText:  { color: t.accentDark, fontWeight: '700' as const, fontSize: 13 },

  resultsList:  { backgroundColor: t.surface, borderRadius: 20, overflow: 'hidden', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3 },
  resultRow:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  resultBorder: { borderBottomWidth: 1, borderBottomColor: t.border },
  avatar:       { backgroundColor: t.border },
  resultText:   { flex: 1 },
  resultName:   { fontSize: 16, fontWeight: '700', color: t.textPrimary },
  resultBio:    { fontSize: 13, color: t.textSecondary, marginTop: 2 },
  chevron:      { fontSize: 20, color: t.textMuted },

  emptyState:   { alignItems: 'center', marginTop: 48 },
  emptyIcon:    { fontSize: 40, marginBottom: 12 },
  emptyText:    { fontSize: 15, color: t.textMuted, textAlign: 'center' },

  potwSection:      { marginBottom: 24 },
  potwHeading:      { fontSize: 12, fontWeight: '800', letterSpacing: 1.2, color: t.textMuted, marginBottom: 12 },
  potwCard:         { backgroundColor: t.surface, borderRadius: 20, overflow: 'hidden', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3 },
  potwRow:          { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 14 },
  potwRowBorder:    { borderBottomWidth: 1, borderBottomColor: t.border },
  potwLeft:         { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  potwRankIcon:     { width: 22, alignItems: 'center' },
  potwTrophy:       { fontSize: 16 },
  potwTextBlock:    { flex: 1 },
  potwPlantName:    { fontSize: 15, fontWeight: '700', color: t.textPrimary },
  potwNominator:    { fontSize: 12, color: t.textMuted, marginTop: 2 },
  potwRight:        { flexDirection: 'row', alignItems: 'center', gap: 10, marginLeft: 12 },
  potwVoteCount:    { fontSize: 14, fontWeight: '800', color: t.textPrimary, minWidth: 24, textAlign: 'right' },
  voteBtn:          { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 100, borderWidth: 1.5, borderColor: t.accent, alignItems: 'center' },
  voteBtnDisabled:  { borderColor: t.border, opacity: 0.5 },
  voteBtnText:      { fontSize: 13, fontWeight: '700', color: t.accent },
  potwEmptyBox:     { padding: 20, alignItems: 'center' },
  potwEmptyText:    { fontSize: 14, color: t.textMuted, fontStyle: 'italic' },
  potwMyNomText:    { fontSize: 13, color: t.textMuted, marginTop: 12, paddingHorizontal: 4 },
  potwMyNomPlant:   { fontWeight: '700', color: t.accent },
  nominateBtn:      { marginTop: 12, alignSelf: 'flex-start', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 100, borderWidth: 1.5, borderColor: t.accent, backgroundColor: t.surfaceGreenSubtle },
  nominateBtnText:  { color: t.accentDark, fontWeight: '700', fontSize: 13 },

  modalOverlay:        { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalBox:            { backgroundColor: t.surface, borderRadius: 24, padding: 24, width: '100%', maxWidth: 400 },
  modalTitle:          { fontSize: 18, fontWeight: '800', color: t.textTitle, marginBottom: 20 },
  modalLabel:          { fontSize: 12, fontWeight: '700', color: t.textMuted, letterSpacing: 0.8, marginBottom: 6 },
  modalInput:          { backgroundColor: t.background, borderWidth: 1.5, borderColor: t.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, color: t.textPrimary },
  modalInputMultiline: { minHeight: 80, textAlignVertical: 'top' },
  charCount:           { fontSize: 12, color: t.textMuted, textAlign: 'right', marginTop: 4 },
  btnDisabled:         { opacity: 0.5 },
  modalSaveBtn:        { backgroundColor: t.accent, padding: 14, borderRadius: 16, alignItems: 'center', marginTop: 16 },
  modalSaveBtnText:    { color: '#fff', fontWeight: '700', fontSize: 15 },
  modalCancelBtn:      { alignItems: 'center', paddingVertical: 12 },
  modalCancelText:     { color: t.textMuted, fontSize: 14, fontWeight: '600' },
  suggestionBox:       { backgroundColor: t.surface, borderWidth: 1, borderColor: t.border, borderRadius: 12, marginTop: 4, overflow: 'hidden' },
  suggestionRow:       { paddingHorizontal: 14, paddingVertical: 10 },
  suggestionRowBorder: { borderBottomWidth: 1, borderBottomColor: t.border },
  suggestionText:      { fontSize: 14, color: t.textPrimary },
});
