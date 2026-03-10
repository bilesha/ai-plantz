import AsyncStorage from "@react-native-async-storage/async-storage";

export const getPlantDetailsFromCache = async (plantName: string) => {
  const cached = await AsyncStorage.getItem(`cache_${plantName}`);
  return cached ? JSON.parse(cached) : null;
};

export const savePlantDetailsToCache = async (plantName: string, data: any) => {
  await AsyncStorage.setItem(`cache_${plantName}`, JSON.stringify(data));
};