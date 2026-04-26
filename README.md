# Caroline - Discord Economy Bot

Caroline est un bot Discord d'economie et de collection de personnages base sur Jikan API.

## Fonctionnalites

- Economie : Daily, Work, Pay, Bank.
- Collection : Invocation de personnages (summon), Collection personnelle, Echange entre joueurs (trade).
- Jeux : Roulette, Roulette Russe, Dice Roll.
- Administration : Modification du prefixe, Donation d'argent (Banquier).
- Deploiement : Support Docker et Docker Compose.

## Installation

### Via Docker (Recommande)

1. Clonez le depot.
2. Creez un fichier .env avec votre DISCORD_TOKEN.
3. Lancez la commande suivante :
   docker-compose up -d --build

### Installation Manuelle

1. Installez les dependances :
   npm install
2. Configurez votre base de donnees PostgreSQL dans le fichier .env (DATABASE_URL).
3. Lancez le bot :
   npm start

## Configuration

Les parametres du bot (prix, chances de drop, ID de l'owner) se trouvent dans le dossier config/config.yaml.

## Soutenir le projet

Si vous souhaitez soutenir le developpement de ce bot, vous pouvez faire un don via le lien suivant :
https://www.paypal.me/MicaPaul138
