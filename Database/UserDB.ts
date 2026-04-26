import { Pool } from 'pg';
import { User } from './types';

export class UserDB {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async ensureSchema(): Promise<void> {
    const columns = [
      { name: 'bank_balance', type: 'BIGINT DEFAULT 0' },
      { name: 'bankruptcies', type: 'INT DEFAULT 0' },
      { name: 'total_wins', type: 'INT DEFAULT 0' },
      { name: 'total_losses', type: 'INT DEFAULT 0' },
      { name: 'last_steal', type: 'BIGINT DEFAULT 0' },
      { name: 'discount_until', type: 'BIGINT DEFAULT 0' },
      { name: 'luck_until', type: 'BIGINT DEFAULT 0' }
    ];

    for (const col of columns) {
      await this.pool.query(`
        DO $$ 
        BEGIN 
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='${col.name}') THEN
            ALTER TABLE users ADD COLUMN ${col.name} ${col.type};
          END IF;
        END $$;
      `);
    }

    // Table pour les paramètres globaux (préfixe, etc.)
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS settings (
        key VARCHAR(50) PRIMARY KEY,
        value TEXT NOT NULL
      )
    `);

    // Initialiser le préfixe si inexistant
    await this.pool.query(`
      INSERT INTO settings (key, value) VALUES ('prefix', '!') ON CONFLICT DO NOTHING
    `);
  }

  async getPrefix(): Promise<string> {
    const res = await this.pool.query("SELECT value FROM settings WHERE key = 'prefix'");
    return res.rows[0]?.value ?? '!';
  }

  async setPrefix(newPrefix: string): Promise<void> {
    await this.pool.query("UPDATE settings SET value = $1 WHERE key = 'prefix'", [newPrefix]);
  }
  async createUser(id: string, username: string): Promise<User> {
    const user: User = {
      id,
      username,
      balance: 1000,
      bankBalance: 0,
      bankruptcies: 0,
      totalWins: 0,
      totalLosses: 0,
      createdAt: Date.now(),
      lastDaily: null,
      lastSteal: null,
      discountUntil: null,
      luckUntil: null,
    };

    await this.pool.query(
      `INSERT INTO users (id, username, balance, bank_balance, bankruptcies, total_wins, total_losses, created_at, last_daily, last_steal, discount_until, luck_until)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [user.id, user.username, user.balance, user.bankBalance, user.bankruptcies, user.totalWins, user.totalLosses, user.createdAt, user.lastDaily, user.lastSteal, user.discountUntil, user.luckUntil]
    );

    return user;
  }

  private rowToUser(row: any): User {
    return {
      id: row.id,
      username: row.username,
      balance: Number(row.balance),
      bankBalance: Number(row.bank_balance || 0),
      bankruptcies: Number(row.bankruptcies),
      totalWins: Number(row.total_wins),
      totalLosses: Number(row.total_losses),
      createdAt: Number(row.created_at),
      lastDaily: row.last_daily ? Number(row.last_daily) : null,
      lastSteal: row.last_steal ? Number(row.last_steal) : null,
      discountUntil: row.discount_until ? Number(row.discount_until) : null,
      luckUntil: row.luck_until ? Number(row.luck_until) : null,
    };
  }

  async getUser(id: string): Promise<User | undefined> {
    const result = await this.pool.query('SELECT * FROM users WHERE id = $1', [id]);
    if (result.rows.length === 0) return undefined;
    return this.rowToUser(result.rows[0]);
  }

  async getUserOrCreate(id: string, username: string): Promise<User> {
    return (await this.getUser(id)) ?? (await this.createUser(id, username));
  }

  async updateUser(user: User): Promise<void> {
    await this.pool.query(
      `UPDATE users SET username = $2, balance = $3, bank_balance = $4, bankruptcies = $5, total_wins = $6, total_losses = $7, last_daily = $8, last_steal = $9, discount_until = $10, luck_until = $11
       WHERE id = $1`,
      [user.id, user.username, user.balance, user.bankBalance, user.bankruptcies, user.totalWins, user.totalLosses, user.lastDaily, user.lastSteal, user.discountUntil, user.luckUntil]
    );
  }

  async getAllUsers(): Promise<User[]> {
    const result = await this.pool.query('SELECT * FROM users');
    return result.rows.map((row: any) => this.rowToUser(row));
  }

  async addBalance(id: string, amount: number): Promise<User | undefined> {
    const user = await this.getUser(id);
    if (!user) return undefined;
    user.balance += amount;
    await this.updateUser(user);
    return user;
  }

  async removeBalance(id: string, amount: number): Promise<User | undefined> {
    const user = await this.getUser(id);
    if (!user || user.balance < amount) return undefined;
    user.balance -= amount;
    await this.updateUser(user);
    return user;
  }

  async recordWin(id: string): Promise<User | undefined> {
    const user = await this.getUser(id);
    if (!user) return undefined;
    user.totalWins++;
    await this.updateUser(user);
    return user;
  }

  async recordLoss(id: string): Promise<User | undefined> {
    const user = await this.getUser(id);
    if (!user) return undefined;
    user.totalLosses++;
    await this.updateUser(user);
    return user;
  }

  async getTotalWealth(): Promise<number> {
    const result = await this.pool.query('SELECT SUM(balance + COALESCE(bank_balance, 0)) as total FROM users');
    return Number(result.rows[0].total || 0);
  }
}