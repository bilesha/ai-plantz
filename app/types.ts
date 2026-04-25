export type PlantDetails = {
  watering: string;
  light: string;
  fertilizer: string;
};

export type PlantEntry = {
  name: string;
  summary: string;
  details?: PlantDetails;
  isFavorite: boolean;
  lastViewed: number;
};
