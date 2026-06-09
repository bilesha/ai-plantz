import * as Location from 'expo-location';
import { supabase } from '../lib/supabase';

export type UserLocation = {
  latitude: number;
  longitude: number;
};

async function getUserId(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id ?? null;
}

export async function requestAndSaveLocation(): Promise<UserLocation | null> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') return null;

  const position = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });
  const { latitude, longitude } = position.coords;

  const userId = await getUserId();
  if (!userId) return null;

  await supabase
    .from('profiles')
    .update({ latitude, longitude, location_updated_at: new Date().toISOString() })
    .eq('id', userId);

  return { latitude, longitude };
}

export async function getSavedLocation(): Promise<UserLocation | null> {
  const userId = await getUserId();
  if (!userId) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('latitude, longitude')
    .eq('id', userId)
    .maybeSingle();

  if (error || !data || data.latitude == null || data.longitude == null) return null;
  return { latitude: data.latitude as number, longitude: data.longitude as number };
}

export type WeatherData = {
  temp: number;
  humidity: number;
  description: string;
  isFreezing: boolean;
  isHot: boolean;
  isHumid: boolean;
};

export async function getCurrentWeather(latitude: number, longitude: number): Promise<WeatherData | null> {
  const apiKey = process.env.EXPO_PUBLIC_OPENWEATHER_API_KEY;
  if (!apiKey) return null;

  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&units=metric&appid=${apiKey}`;
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = await response.json();
    const temp: number = data.main?.temp ?? 0;
    const humidity: number = data.main?.humidity ?? 0;
    const description: string = data.weather?.[0]?.description ?? '';
    return {
      temp,
      humidity,
      description,
      isFreezing: temp < 2,
      isHot:      temp > 30,
      isHumid:    humidity > 75,
    };
  } catch {
    return null;
  }
}

export function getHemisphere(latitude: number): 'northern' | 'southern' {
  return latitude < 0 ? 'southern' : 'northern';
}

export function getCurrentSeason(latitude: number): 'spring' | 'summer' | 'autumn' | 'winter' {
  const month = new Date().getMonth(); // 0=Jan … 11=Dec
  const northern: ('spring' | 'summer' | 'autumn' | 'winter')[] = [
    'winter', 'winter', 'spring', 'spring', 'spring',
    'summer', 'summer', 'summer', 'autumn', 'autumn', 'autumn', 'winter',
  ];
  const flip: Record<string, 'spring' | 'summer' | 'autumn' | 'winter'> = {
    winter: 'summer', summer: 'winter', spring: 'autumn', autumn: 'spring',
  };
  const season = northern[month];
  return latitude < 0 ? flip[season] : season;
}
