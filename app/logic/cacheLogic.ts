import AsyncStorage from "@react-native-async-storage/async-storage";
import { PlantDetails } from "../types";

export const getPlantDetailsFromCache = async (plantName: string): Promise<PlantDetails | null> => {
  const cached = await AsyncStorage.getItem(`cache_${plantName}`);
  return cached ? JSON.parse(cached) : null;
};

export const savePlantDetailsToCache = async (plantName: string, data: PlantDetails): Promise<void> => {
  await AsyncStorage.setItem(`cache_${plantName}`, JSON.stringify(data));
};

const NO_IMAGE_SENTINEL = '__no_image__';

// Returns undefined if not yet cached, null if cached as "no image", or a URL string.
export const getPlantImageFromCache = async (plantName: string): Promise<string | null | undefined> => {
  const cached = await AsyncStorage.getItem(`image_${plantName}`);
  if (cached === null) return undefined;
  return cached === NO_IMAGE_SENTINEL ? null : cached;
};

export const savePlantImageToCache = async (plantName: string, url: string | null): Promise<void> => {
  await AsyncStorage.setItem(`image_${plantName}`, url ?? NO_IMAGE_SENTINEL);
};
