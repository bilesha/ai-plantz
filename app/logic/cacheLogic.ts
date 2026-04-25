import AsyncStorage from "@react-native-async-storage/async-storage";
import { PlantDetails } from "../types";

export const getPlantDetailsFromCache = async (plantName: string): Promise<PlantDetails | null> => {
  const cached = await AsyncStorage.getItem(`cache_${plantName}`);
  return cached ? JSON.parse(cached) : null;
};

export const savePlantDetailsToCache = async (plantName: string, data: PlantDetails): Promise<void> => {
  await AsyncStorage.setItem(`cache_${plantName}`, JSON.stringify(data));
};
