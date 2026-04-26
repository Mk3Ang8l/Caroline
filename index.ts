import { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes, ChannelType, TextChannel } from 'discord.js';
import { Pool } from 'pg';
import { UserDB } from './Database/UserDB';
import { HybridInteraction } from './Utils/HybridInteraction';
import { Logger } from './Utils/Logger';
import { ErrorHandler } from './Utils/ErrorHandler';
import { profileCommand } from './Commands/profile';
import { leaderboardCommand } from './Commands/leaderboard';
import { dailyCommand } from './Commands/daily';
import { workCommand } from './Commands/work';
import { payCommand } from './Commands/pay';
import { bankCommand } from './Commands/bank';
import { helpCommand } from './Commands/help';
import { rouletteCommand } from './Commands/roulette';
import { russeRouletteCommand } from './Commands/russeroulette';
import { dicerollCommand } from './Commands/diceroll';
import { summonCommand } from './Commands/summon';
import { collectionCommand } from './Commands/collection';
import { tradeCommand } from './Commands/trade';
import { bankerGiveCommand } from './Commands/banker';
import { stealCommand } from './Commands/steal';
import { prefixCommand } from './Commands/prefix';
import { spawnChest, spawnChestCommand } from './Commands/chest';
import { CharacterDB } from './Database/CharacterDB';
import { User, GameResult } from './Database/types';
import * as dotenv from 'dotenv';

dotenv.config();

process.on('unhandledRejection', (reason) => {
  Logger.error('Unhandled Promise Rejection', reason, 'PROCESS');
});

process.on('uncaughtException', (error) => {
  Logger.error('Uncaught Exception', error, 'PROCESS');
});

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.on('error', (err) => {
  Logger.error('Erreur inattendue sur le pool PostgreSQL', err, 'DATABASE');
});

export class BotClient extends Client {
  public userDB!: UserDB;

  constructor() {
    super({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
      ],
    });
  }
}

export const client = new BotClient();
const userDB = new UserDB(pool);
const characterDB = new CharacterDB(pool);

let currentPrefix = '!';
let lastChestTime = 0;
const channelActivity = new Map<string, number>();
const activeUsers = new Set<string>();
const CHEST_COOLDOWN = 10 * 60 * 1000;
const ACTIVITY_THRESHOLD = 15;
const MIN_USERS = 5;

const commands = [
  new SlashCommandBuilder()
    .setName('profile')
    .setDescription('Voir le profil dun utilisateur')
    .addUserOption((option) =>
      option.setName('user').setDescription('Utilisateur à voir').setRequired(false)
    )
    .toJSON(),

  new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Voir le classement des joueurs les plus riches')
    .toJSON(),

  new SlashCommandBuilder()
    .setName('daily')
    .setDescription('Réclamer ta récompense quotidienne')
    .toJSON(),

  new SlashCommandBuilder()
    .setName('work')
    .setDescription('Travailler pour gagner de l\'argent')
    .toJSON(),

  new SlashCommandBuilder()
    .setName('pay')
    .setDescription('Envoyer de l\'argent à un joueur')
    .addUserOption((opt) =>
      opt.setName('user').setDescription('Joueur à payer').setRequired(true)
    )
    .addIntegerOption((opt) =>
      opt.setName('amount').setDescription('Montant à envoyer').setRequired(true).setMinValue(1)
    )
    .toJSON(),

  new SlashCommandBuilder()
    .setName('bank')
    .setDescription('Gérer ton compte bancaire - déposer ou retirer de l\'argent')
    .toJSON(),

  new SlashCommandBuilder()
    .setName('help')
    .setDescription('Afficher la liste des commandes disponibles')
    .toJSON(),

  new SlashCommandBuilder()
    .setName('roulette')
    .setDescription('Parier sur un numéro ou une couleur')
    .addStringOption(opt =>
      opt.setName('bet').setDescription('rouge, noir, vert, ou un numéro 0-36').setRequired(true)
    )
    .addIntegerOption(opt =>
      opt.setName('amount').setDescription('Montant à miser').setRequired(true).setMinValue(1)
    )
    .toJSON(),

  new SlashCommandBuilder()
    .setName('russeroulette')
    .setDescription('Roulette russe — plus de balles = plus de gains, mais plus de risques')
    .addIntegerOption(opt =>
      opt.setName('amount').setDescription('Montant à miser').setRequired(true).setMinValue(1)
    )
    .toJSON(),

  new SlashCommandBuilder()
    .setName('diceroll')
    .setDescription('Parier sur pair ou impair — x1.5 la mise')
    .addStringOption(opt =>
      opt.setName('choice').setDescription('pair ou impair').setRequired(true)
        .addChoices(
          { name: 'Pair', value: 'pair' },
          { name: 'Impair', value: 'impair' },
        )
    )
    .addIntegerOption(opt =>
      opt.setName('amount').setDescription('Montant à miser').setRequired(true).setMinValue(1)
    )
    .toJSON(),
  new SlashCommandBuilder()
    .setName('collection')
    .setDescription('Voir ta collection de personnages')
    .addUserOption(opt =>
      opt.setName('user').setDescription('Joueur à consulter').setRequired(false)
    )
    .toJSON(),

  new SlashCommandBuilder()
    .setName('trade')
    .setDescription('Proposer d\'acheter un personnage à un autre joueur')
    .addStringOption(opt => opt.setName('name').setDescription('Nom du personnage visé').setRequired(true))
    .addIntegerOption(opt => opt.setName('offer').setDescription('Montant proposé').setRequired(true).setMinValue(100))
    .toJSON(),

  new SlashCommandBuilder()
    .setName('summon')
    .setDescription('Invoquer un personnage spécifique ou aléatoire')
    .addStringOption(opt =>
      opt.setName('name').setDescription('Nom du personnage à chercher').setRequired(false)
    )
    .addStringOption(opt =>
      opt.setName('anime').setDescription('Filtrer par nom d\'anime/manga').setRequired(false)
    )
    .toJSON(),

  new SlashCommandBuilder()
    .setName('spawnchest')
    .setDescription('Forcer l\'apparition d\'un coffre (Admin)')
    .toJSON(),

  new SlashCommandBuilder()
    .setName('give')
    .setDescription('Donner de l\'argent (Réservé au Banquier)')
    .addUserOption(opt => opt.setName('user').setDescription('Utilisateur').setRequired(true))
    .addIntegerOption(opt => opt.setName('amount').setDescription('Montant').setRequired(true).setMinValue(1))
    .toJSON(),

  new SlashCommandBuilder()
    .setName('steal')
    .setDescription('Tenter de voler l\'argent d\'un autre joueur (cash uniquement)')
    .addUserOption(opt => opt.setName('user').setDescription('La victime').setRequired(true))
    .toJSON(),

  new SlashCommandBuilder()
    .setName('prefix')
    .setDescription('Changer le préfixe du bot (Owner uniquement)')
    .addStringOption(opt => opt.setName('new_prefix').setDescription('Le nouveau préfixe').setRequired(true))
    .toJSON(),
];

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN as string);

client.on('clientReady', async () => {
  Logger.info(`Bot démarré: ${client.user?.tag}`, 'CLIENT');

  currentPrefix = await userDB.getPrefix();
  
  try {
    Logger.info('Enregistrement des commandes slash...', 'REST');
    await rest.put(Routes.applicationCommands(client.user!.id), { body: commands });
    Logger.info('Commandes slash enregistrées avec succès', 'REST');
  } catch (error) {
    ErrorHandler.handle(error, 'REST_REGISTRATION');
  }

  startChestScheduler();
  
  setInterval(() => {
    channelActivity.forEach((val, key) => {
      if (val > 0) channelActivity.set(key, Math.floor(val * 0.8));
    });
    activeUsers.clear();
  }, 5 * 60 * 1000);
});

async function triggerChest(channel: any) {
  if (Date.now() - lastChestTime < CHEST_COOLDOWN) return;
  if (activeUsers.size < MIN_USERS) return;

  lastChestTime = Date.now();
  await spawnChest(channel, userDB);
}

function startChestScheduler() {
  const minTime = 1 * 60 * 1000;
  const maxTime = 30 * 60 * 1000;
  const randomDelay = Math.floor(Math.random() * (maxTime - minTime + 1)) + minTime;

  setTimeout(async () => {
    try {
      const guild = client.guilds.cache.first();
      if (guild && activeUsers.size >= MIN_USERS) {
        let mostActiveChannelId = '';
        let maxAct = -1;
        
        channelActivity.forEach((val, id) => {
          if (val > maxAct) {
            maxAct = val;
            mostActiveChannelId = id;
          }
        });

        const channel = (mostActiveChannelId 
          ? guild.channels.cache.get(mostActiveChannelId) 
          : guild.channels.cache.find(c => c.type === ChannelType.GuildText)) as any;

        if (channel) {
          await triggerChest(channel);
        }
      }
    } catch (err) {
      Logger.error('Erreur spawn auto coffre', err, 'CHEST_EVENT');
    }
    startChestScheduler();
  }, randomDelay);
}

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  activeUsers.add(interaction.user.id);

  try {
    await interaction.deferReply();
    const hybrid = new HybridInteraction(interaction);

    switch (interaction.commandName) {
      case 'profile': await profileCommand(hybrid, userDB); break;
      case 'leaderboard': await leaderboardCommand(hybrid, userDB); break;
      case 'daily': await dailyCommand(hybrid, userDB); break;
      case 'work': await workCommand(hybrid, userDB); break;
      case 'pay': await payCommand(hybrid, userDB); break;
      case 'bank': await bankCommand(hybrid, userDB); break;
      case 'help': await helpCommand(hybrid, userDB); break;
      case 'roulette': await rouletteCommand(hybrid, userDB); break;
      case 'russeroulette': await russeRouletteCommand(hybrid, userDB); break;
      case 'diceroll': await dicerollCommand(hybrid, userDB); break;
      case 'collection': await collectionCommand(hybrid, userDB, characterDB); break;
      case 'trade': await tradeCommand(hybrid, userDB, characterDB); break;
      case 'summon': await summonCommand(hybrid, userDB, characterDB); break;
      case 'give': await bankerGiveCommand(hybrid, userDB); break;
      case 'steal': await stealCommand(hybrid, userDB); break;
      case 'spawnchest': await spawnChestCommand(hybrid, userDB); break;
      case 'prefix': 
        await prefixCommand(hybrid, userDB);
        currentPrefix = await userDB.getPrefix();
        break;
    }
  } catch (error) {
    ErrorHandler.handle(error, `COMMAND_SLASH_${interaction.commandName.toUpperCase()}`);
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: '❌ Une erreur est survenue lors de l\'exécution.' });
    }
  }
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  
  const activity = (channelActivity.get(message.channel.id) || 0) + 1;
  channelActivity.set(message.channel.id, activity);
  activeUsers.add(message.author.id);

  if (activity >= ACTIVITY_THRESHOLD) {
    await triggerChest(message.channel);
  }

  if (!message.content.startsWith(currentPrefix)) return;
  if (message.channel.type === ChannelType.DM) return;

  const args = message.content.slice(currentPrefix.length).trim().split(/\s+/);
  const commandName = args.shift()?.toLowerCase();

  if (!commandName) return;

  Logger.debug(`Commande préfixe reçue: ${commandName} par ${message.author.tag}`, 'MESSAGE');

  const hybrid = new HybridInteraction(message, args);

  try {
    switch (commandName) {
      case 'profile':
      case 'p':
      case 'prof': await profileCommand(hybrid, userDB); break;
      case 'leaderboard': await leaderboardCommand(hybrid, userDB); break;
      case 'daily': await dailyCommand(hybrid, userDB); break;
      case 'work': await workCommand(hybrid, userDB); break;
      case 'pay': await payCommand(hybrid, userDB); break;
      case 'bank':
      case 'b':
      case 'banque': await bankCommand(hybrid, userDB); break;
      case 'help': await helpCommand(hybrid, userDB); break;
      case 'roulette':
      case 'r': await rouletteCommand(hybrid, userDB); break;
      case 'russeroulette':
      case 'rr': await russeRouletteCommand(hybrid, userDB); break;
      case 'diceroll':
      case 'dice':
      case 'd': await dicerollCommand(hybrid, userDB); break;
      case 'collection':
      case 'col':
      case 'c': await collectionCommand(hybrid, userDB, characterDB); break;
      case 'trade':
      case 't': await tradeCommand(hybrid, userDB, characterDB); break;
      case 'summon': await summonCommand(hybrid, userDB, characterDB); break;
      case 'give': await bankerGiveCommand(hybrid, userDB); break;
      case 'steal': await stealCommand(hybrid, userDB); break;
      case 'spawnchest': await spawnChestCommand(hybrid, userDB); break;
      case 'prefix':
        await prefixCommand(hybrid, userDB);
        currentPrefix = await userDB.getPrefix();
        break;
    }
  } catch (error) {
    ErrorHandler.handle(error, `COMMAND_PREFIX_${commandName.toUpperCase()}`);
    await message.reply({ content: '❌ Une erreur s\'est produite.' });
  }
});

client.on('error', (error) => ErrorHandler.handle(error, 'CLIENT_ERROR'));
client.on('warn', (msg) => Logger.warn(msg, 'CLIENT_WARN'));

const token = process.env.DISCORD_TOKEN as string;

async function startBot() {
  try {
    Logger.info('Initialisation de la base de données...', 'DATABASE');
    await userDB.ensureSchema();
    await characterDB.ensureSchema();

    await client.login(token);
  } catch (error) {
    Logger.error('Échec de la connexion au bot', error, 'LOGIN');
    process.exit(1);
  }
}

startBot();
