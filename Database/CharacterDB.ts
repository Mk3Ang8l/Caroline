import { Pool } from 'pg';
import { Character, UserCharacter, MarketListing } from './types';

export class CharacterDB {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async ensureSchema(): Promise<void> {
    // Table des personnages (catalogue)
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS characters (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        series VARCHAR(100) NOT NULL,
        type VARCHAR(20) NOT NULL,
        rarity VARCHAR(20) NOT NULL,
        base_price INT NOT NULL,
        image_url TEXT NOT NULL,
        mal_id INT
      )
    `);

    // Migration : Ajouter mal_id si absent
    await this.pool.query(`
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='characters' AND column_name='mal_id') THEN
          ALTER TABLE characters ADD COLUMN mal_id INT;
        END IF;
      END $$;
    `);

    // Table des cartes possédées par les joueurs
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS user_characters (
        card_id SERIAL PRIMARY KEY,
        user_id VARCHAR(30) NOT NULL,
        character_id INT NOT NULL REFERENCES characters(id),
        acquired_at BIGINT NOT NULL
      )
    `);

    // Table du marché joueur-à-joueur
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS market_listings (
        listing_id SERIAL PRIMARY KEY,
        seller_id VARCHAR(30) NOT NULL,
        seller_name VARCHAR(100) NOT NULL,
        card_id INT NOT NULL REFERENCES user_characters(card_id),
        price INT NOT NULL,
        listed_at BIGINT NOT NULL
      )
    `);
  }

  // --- CATALOGUE ---
  async getAllCharacters(): Promise<Character[]> {
    const res = await this.pool.query('SELECT * FROM characters ORDER BY base_price DESC');
    return res.rows.map(this.rowToCharacter);
  }

  async getCharacterById(id: number): Promise<Character | undefined> {
    const res = await this.pool.query('SELECT * FROM characters WHERE id = $1', [id]);
    return res.rows[0] ? this.rowToCharacter(res.rows[0]) : undefined;
  }

  async getCharacterByName(name: string): Promise<Character | undefined> {
    const searchName = name.trim();
    const res = await this.pool.query('SELECT * FROM characters WHERE name ILIKE $1 LIMIT 1', [`%${searchName}%`]);
    return res.rows[0] ? this.rowToCharacter(res.rows[0]) : undefined;
  }

  async getRandomCharacter(): Promise<Character> {
    const res = await this.pool.query('SELECT * FROM characters ORDER BY RANDOM() LIMIT 1');
    return this.rowToCharacter(res.rows[0]);
  }

  async getCharacterByMalId(malId: number): Promise<Character | undefined> {
    const res = await this.pool.query('SELECT * FROM characters WHERE mal_id = $1', [malId]);
    return res.rows[0] ? this.rowToCharacter(res.rows[0]) : undefined;
  }

  async createCharacter(c: Omit<Character, 'id'>): Promise<Character> {
    const res = await this.pool.query(
      `INSERT INTO characters (name, series, type, rarity, base_price, image_url, mal_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [c.name, c.series, c.type, c.rarity, c.basePrice, c.imageUrl, c.malId || null]
    );
    return this.rowToCharacter(res.rows[0]);
  }

  // --- COLLECTION JOUEUR ---
  async getUserCollection(userId: string): Promise<UserCharacter[]> {
    const res = await this.pool.query(`
      SELECT uc.card_id, uc.user_id, uc.character_id, uc.acquired_at,
             c.name, c.series, c.type, c.rarity, c.base_price, c.image_url
      FROM user_characters uc
      JOIN characters c ON c.id = uc.character_id
      WHERE uc.user_id = $1
      ORDER BY uc.acquired_at DESC
    `, [userId]);
    return res.rows.map(this.rowToUserCharacter);
  }

  async getUserCard(cardId: number): Promise<UserCharacter | undefined> {
    const res = await this.pool.query(`
      SELECT uc.card_id, uc.user_id, uc.character_id, uc.acquired_at,
             c.name, c.series, c.type, c.rarity, c.base_price, c.image_url
      FROM user_characters uc
      JOIN characters c ON c.id = uc.character_id
      WHERE uc.card_id = $1
    `, [cardId]);
    return res.rows[0] ? this.rowToUserCharacter(res.rows[0]) : undefined;
  }

  async getUserCardByCharacterId(characterId: number): Promise<UserCharacter | undefined> {
    const res = await this.pool.query(`
      SELECT uc.card_id, uc.user_id, uc.character_id, uc.acquired_at,
             c.name, c.series, c.type, c.rarity, c.base_price, c.image_url
      FROM user_characters uc
      JOIN characters c ON c.id = uc.character_id
      WHERE uc.character_id = $1
    `, [characterId]);
    return res.rows[0] ? this.rowToUserCharacter(res.rows[0]) : undefined;
  }

  async giveCard(userId: string, characterId: number): Promise<UserCharacter> {
    const res = await this.pool.query(
      `INSERT INTO user_characters (user_id, character_id, acquired_at)
       VALUES ($1, $2, $3) RETURNING card_id`,
      [userId, characterId, Date.now()]
    );
    const card = await this.getUserCard(res.rows[0].card_id);
    return card!;
  }

  async removeCard(cardId: number): Promise<void> {
    await this.pool.query('DELETE FROM user_characters WHERE card_id = $1', [cardId]);
  }

  async transferCard(cardId: number, newUserId: string): Promise<void> {
    await this.pool.query(
      'UPDATE user_characters SET user_id = $1, acquired_at = $2 WHERE card_id = $3',
      [newUserId, Date.now(), cardId]
    );
  }

  async getCharacterOwner(characterId: number): Promise<{ userId: string } | undefined> {
    const res = await this.pool.query('SELECT user_id FROM user_characters WHERE character_id = $1 LIMIT 1', [characterId]);
    return res.rows[0] ? { userId: res.rows[0].user_id } : undefined;
  }

  // --- MARCHÉ ---
  async createListing(sellerId: string, sellerName: string, cardId: number, price: number): Promise<MarketListing> {
    const res = await this.pool.query(
      `INSERT INTO market_listings (seller_id, seller_name, card_id, price, listed_at)
       VALUES ($1, $2, $3, $4, $5) RETURNING listing_id`,
      [sellerId, sellerName, cardId, price, Date.now()]
    );
    const listing = await this.getListingById(res.rows[0].listing_id);
    return listing!;
  }

  async getListingById(listingId: number): Promise<MarketListing | undefined> {
    const res = await this.pool.query(`
      SELECT ml.listing_id, ml.seller_id, ml.seller_name, ml.card_id, ml.price, ml.listed_at,
             c.name, c.series, c.type, c.rarity, c.base_price, c.image_url
      FROM market_listings ml
      JOIN user_characters uc ON uc.card_id = ml.card_id
      JOIN characters c ON c.id = uc.character_id
      WHERE ml.listing_id = $1
    `, [listingId]);
    return res.rows[0] ? this.rowToListing(res.rows[0]) : undefined;
  }

  async getAllListings(): Promise<MarketListing[]> {
    const res = await this.pool.query(`
      SELECT ml.listing_id, ml.seller_id, ml.seller_name, ml.card_id, ml.price, ml.listed_at,
             c.name, c.series, c.type, c.rarity, c.base_price, c.image_url
      FROM market_listings ml
      JOIN user_characters uc ON uc.card_id = ml.card_id
      JOIN characters c ON c.id = uc.character_id
      ORDER BY ml.listed_at DESC
      LIMIT 20
    `);
    return res.rows.map(this.rowToListing);
  }

  async getListingByCardId(cardId: number): Promise<MarketListing | undefined> {
    const res = await this.pool.query('SELECT listing_id FROM market_listings WHERE card_id = $1', [cardId]);
    if (!res.rows[0]) return undefined;
    return this.getListingById(res.rows[0].listing_id);
  }

  async removeListing(listingId: number): Promise<void> {
    await this.pool.query('DELETE FROM market_listings WHERE listing_id = $1', [listingId]);
  }

  // --- HELPERS ---
  private rowToCharacter(row: any): Character {
    return {
      id: row.id,
      name: row.name,
      series: row.series,
      type: row.type,
      rarity: row.rarity,
      basePrice: Number(row.base_price),
      imageUrl: row.image_url,
      malId: row.mal_id ? Number(row.mal_id) : null,
    };
  }

  private rowToUserCharacter(row: any): UserCharacter {
    return {
      cardId: row.card_id,
      userId: row.user_id,
      characterId: row.character_id,
      acquiredAt: Number(row.acquired_at),
      character: row.name ? {
        id: row.character_id,
        name: row.name,
        series: row.series,
        type: row.type,
        rarity: row.rarity,
        basePrice: Number(row.base_price),
        imageUrl: row.image_url,
        malId: row.mal_id ? Number(row.mal_id) : null,
      } : undefined,
    };
  }

  private rowToListing(row: any): MarketListing {
    return {
      listingId: row.listing_id,
      sellerId: row.seller_id,
      sellerName: row.seller_name,
      cardId: row.card_id,
      price: Number(row.price),
      listedAt: Number(row.listed_at),
      character: row.name ? {
        id: row.character_id ?? 0,
        name: row.name,
        series: row.series,
        type: row.type,
        rarity: row.rarity,
        basePrice: Number(row.base_price),
        imageUrl: row.image_url,
        malId: row.mal_id ? Number(row.mal_id) : null,
      } : undefined,
    };
  }
}
