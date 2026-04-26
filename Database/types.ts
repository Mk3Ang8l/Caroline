export interface User {
  id: string;
  username: string;
  balance: number;
  bankBalance: number;
  bankruptcies: number;
  totalWins: number;
  totalLosses: number;
  createdAt: number;
  lastDaily: number | null;
  lastSteal: number | null;
}

export interface GameResult {
  win: boolean;
  amount: number;
  game: string;
  timestamp: number;
}

export type CharacterRarity = 'commune' | 'rare' | 'épique' | 'légendaire';
export type CharacterType = 'anime' | 'jeux';

export interface Character {
  id: number;
  name: string;
  series: string;
  type: CharacterType;
  rarity: CharacterRarity;
  basePrice: number;
  imageUrl: string;
}

export interface UserCharacter {
  cardId: number;
  userId: string;
  characterId: number;
  acquiredAt: number;
  character?: Character;
}

export interface MarketListing {
  listingId: number;
  sellerId: string;
  sellerName: string;
  cardId: number;
  price: number;
  listedAt: number;
  character?: Character;
}
