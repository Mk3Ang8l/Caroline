import * as fs from 'fs';
import * as path from 'path';
import yaml from 'js-yaml';

export interface BotConfig {
  bot: {
    owner_id: string;
    banker_id: string;
    default_prefix: string;
  };
  economy: {
    daily_reward: number;
    work_min: number;
    work_max: number;
  };
  summon: {
    prices: Record<string, number>;
    inflation_rate: number;
    chances: Record<string, number>;
  };
  steal: {
    cooldown_hours: number;
    success_chance: number;
    min_victim_balance: number;
  };
}

let config: BotConfig | null = null;

export function getConfig(): BotConfig {
  if (config) return config;

  try {
    const configPath = path.resolve(__dirname, '../config/config.yaml');
    const fileContents = fs.readFileSync(configPath, 'utf8');
    config = yaml.load(fileContents) as BotConfig;
    return config;
  } catch (e) {
    console.error('Erreur lors du chargement de config.yaml:', e);
    // Retourner une config par défaut ou lever une erreur
    throw e;
  }
}
