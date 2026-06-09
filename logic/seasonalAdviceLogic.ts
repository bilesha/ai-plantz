import { getSavedLocation, getHemisphere, getCurrentSeason, getCurrentWeather, type WeatherData } from './locationLogic';
import type { PlantDetails } from '../types';

export type SeasonalAdvice = {
  season: 'spring' | 'summer' | 'autumn' | 'winter';
  hemisphere: 'northern' | 'southern';
  advice: string[];
  weather?: WeatherData;
};

const GENERIC_ADVICE: Record<'spring' | 'summer' | 'autumn' | 'winter', string[]> = {
  spring: [
    'Resume regular watering as growth picks up',
    'Begin fertilising monthly',
    'Good time to repot if rootbound',
    'Watch for new pests as temperatures rise',
  ],
  summer: [
    'Water more frequently — check soil every 2-3 days',
    'Shield from intense afternoon sun',
    'Mist leaves in dry heat',
    'Peak growing season — fertilise every 2 weeks',
  ],
  autumn: [
    'Reduce watering frequency as growth slows',
    'Stop fertilising by mid-autumn',
    'Move frost-sensitive plants indoors',
    'Great time to take cuttings before winter',
  ],
  winter: [
    'Water sparingly — most plants are dormant',
    'Keep away from cold drafts and radiators',
    'No fertiliser needed until spring',
    'Increase humidity with a pebble tray',
  ],
};

export async function getSeasonalAdvice(plantDetails?: PlantDetails): Promise<SeasonalAdvice | null> {
  const location = await getSavedLocation();
  if (!location) return null;

  const hemisphere = getHemisphere(location.latitude);
  const season = getCurrentSeason(location.latitude);
  const base = [...GENERIC_ADVICE[season]];

  if (plantDetails?.seasonalCare?.trim()) {
    base[0] = plantDetails.seasonalCare.trim();
  }

  const weather = await getCurrentWeather(location.latitude, location.longitude);

  if (weather) {
    const weatherAdvice: string[] = [];
    if (weather.isFreezing) weatherAdvice.push('Temperatures near freezing — bring sensitive plants inside tonight');
    if (weather.isHot)      weatherAdvice.push('Heat alert — water in the early morning or evening to reduce evaporation');
    if (weather.isHumid)    weatherAdvice.push('High humidity — watch for fungal issues and ensure good air circulation');
    if (weatherAdvice.length === 0) weatherAdvice.push('Current conditions look good for your plants 🌿');
    base.push(...weatherAdvice);
  }

  return { season, hemisphere, advice: base, weather: weather ?? undefined };
}

export function getSeasonEmoji(season: string): '🌱' | '☀️' | '🍂' | '❄️' {
  const map: Record<string, '🌱' | '☀️' | '🍂' | '❄️'> = {
    spring: '🌱',
    summer: '☀️',
    autumn: '🍂',
    winter: '❄️',
  };
  return map[season] ?? '🌱';
}
