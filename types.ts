export type PlantDetails = {
  watering: string;
  light: string;
  fertilizer: string;
  careLevel?: 'easy' | 'medium' | 'hard';
  funFact?: string;
  toxicity?: string;
  seasonalCare?: string;
  compatibility?: string;
  pairingPlants?: string;
  propagation?: string;
  troubleshooting?: string;
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
