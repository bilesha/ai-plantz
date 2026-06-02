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

export type OwnershipStatus = 'own' | 'want' | 'tried';

export type CollectionEntry = {
  name: string;
  summary: string;
  details?: PlantDetails;
  addedAt: number;
  status: OwnershipStatus;
  rating?: number;
  notes?: string;
};
