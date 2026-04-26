//invoque les personnage avec une rareter aleatoire

import {
  ContainerBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  MessageFlags,
  ButtonInteraction,
} from "discord.js";
import { UserDB } from "../Database/UserDB";
import { CharacterDB } from "../Database/CharacterDB";
import { HybridInteraction } from "../Utils/HybridInteraction";
import { Logger } from "../Utils/Logger";
import { CharacterRarity, Character } from "../Database/types";

import { getConfig } from '../Utils/ConfigLoader';

const config = getConfig();

const RARITY_LABEL: Record<CharacterRarity, string> = {
  commune: "Commune",
  rare: "Rare",
  épique: "Epique",
  légendaire: "Legendaire",
};

const RARITY_PRICES: Record<CharacterRarity, number> = config.summon.prices as Record<CharacterRarity, number>;

function getRandomRarity(): CharacterRarity {
  const rand = Math.random() * 100;
  const chances = config.summon.chances;

  if (rand < chances.légendaire) return "légendaire";
  if (rand < chances.épique) return "épique";
  if (rand < chances.rare) return "rare";
  return "commune";
}

export async function summonCommand(
  hybrid: HybridInteraction,
  userDB: UserDB,
  characterDB: CharacterDB,
): Promise<void> {
  let nameQuery: string | undefined;
  let animeQuery: string | undefined;

  if (hybrid.isSlash) {
    nameQuery = (hybrid.source as any).options.getString("name");
    animeQuery = (hybrid.source as any).options.getString("anime");
  } else {
    const fullArgs = hybrid.prefixArgs.join(" ");
    if (fullArgs.includes("|")) {
      const parts = fullArgs.split("|");
      nameQuery = parts[0].trim();
      animeQuery = parts[1].trim();
    } else {
      nameQuery = fullArgs;
    }
  }

  if (!nameQuery) {
    // Personnage aléatoire du catalogue local
    const character = await characterDB.getRandomCharacter();
    await displaySummon(hybrid, userDB, characterDB, [character]);
    return;
  }

  try {
    let finalQuery = nameQuery;
    if (animeQuery) finalQuery += ` ${animeQuery}`;

    Logger.debug(`Recherche Jikan pour: ${finalQuery}`, 'SUMMON');
    const res = await fetch(
      `https://api.jikan.moe/v4/characters?q=${encodeURIComponent(finalQuery)}&limit=15`,
    );
    const data = (await res.json()) as any;

    if (data && data.data && data.data.length > 0) {
      const results = data.data.map((malChar: any) => {
        // Extraire le nom de la série (Anime ou Manga)
        let series = "Inconnu";
        if (malChar.anime && malChar.anime.length > 0) {
          series = malChar.anime[0].anime.title;
        } else if (malChar.manga && malChar.manga.length > 0) {
          series = malChar.manga[0].manga.title;
        }

        return {
          malId: malChar.mal_id,
          name: malChar.name,
          series: series,
          imageUrl: malChar.images.jpg.image_url,
        };
      });

      Logger.debug(`${results.length} résultats trouvés.`, 'SUMMON');
      await displaySummon(hybrid, userDB, characterDB, results);
    } else {
      const c = new ContainerBuilder().addTextDisplayComponents((t) =>
        t.setContent(`Aucun personnage trouvé pour "${finalQuery}".`),
      );
      await hybrid.send(c);
    }
  } catch (error) {
    Logger.error('Erreur lors du summon', error, 'SUMMON');
    const c = new ContainerBuilder().addTextDisplayComponents((t) =>
      t.setContent(`Erreur lors de la recherche du personnage.`),
    );
    await hybrid.send(c);
  }
}

async function displaySummon(
  hybrid: HybridInteraction,
  userDB: UserDB,
  characterDB: CharacterDB,
  searchResults: any[],
) {
  let currentIndex = 0;

  const updateMessage = async (msg: any, index: number) => {
    try {
      const malChar = searchResults[index];

      let character: Character | undefined;
      if (malChar.id) {
        character = malChar;
      } else {
        character = await characterDB.getCharacterByMalId(malChar.malId);
      }

      // Si on n'a pas encore la série, on va la chercher sur Jikan (Full Details)
      if (!malChar.seriesFetched && !character) {
        try {
          const detailRes = await fetch(`https://api.jikan.moe/v4/characters/${malChar.malId}/full`);
          const detailData = await detailRes.json() as any;
          if (detailData && detailData.data) {
            let series = "Inconnu";
            if (detailData.data.anime && detailData.data.anime.length > 0) {
              series = detailData.data.anime[0].anime.title;
            } else if (detailData.data.manga && detailData.data.manga.length > 0) {
              series = detailData.data.manga[0].manga.title;
            }
            malChar.series = series;
            malChar.seriesFetched = true;
          }
        } catch (err) {
          Logger.error(`Erreur fetch détails Jikan pour ${malChar.malId}`, err, 'SUMMON');
        }
      }

      const tempRarity = getRandomRarity();
      const displayInfo = {
        name: character?.name || malChar.name,
        series: character?.series || malChar.series || "Inconnu",
        rarity: character?.rarity || tempRarity,
        imageUrl: character?.imageUrl || malChar.imageUrl,
        basePrice: character?.basePrice || RARITY_PRICES[tempRarity],
      };

      const owner = character ? await characterDB.getCharacterOwner(character.id) : undefined;
      const totalWealth = await userDB.getTotalWealth();
      const dynamicPrice = Math.floor(displayInfo.basePrice + totalWealth * config.summon.inflation_rate);

      const container = new ContainerBuilder()
        .addTextDisplayComponents((t) =>
          t.setContent(
            `## Invocation : ${displayInfo.name} (${index + 1}/${searchResults.length})\n` +
            `Série : *${displayInfo.series}*\n` +
            `Rareté : **${RARITY_LABEL[displayInfo.rarity as CharacterRarity]}**\n` +
            `Prix : **$${dynamicPrice.toLocaleString("fr-FR")}**\n\n` +
            (owner
              ? ` Ce personnage est unique et appartient déjà à <@${owner.userId}>.`
              : ` Ce personnage est disponible !`),
          ),
        )
        .addMediaGalleryComponents((gallery) =>
          gallery.addItems((item) => item.setURL(`attachment://character.jpg`)),
        );

      const buyButton = new ButtonBuilder()
        .setCustomId(`buy`)
        .setLabel(owner ? "Déjà possédé" : `Acheter ($${dynamicPrice.toLocaleString()})`)
        .setStyle(ButtonStyle.Success)
        .setDisabled(owner !== undefined);

      const prevButton = new ButtonBuilder()
        .setCustomId(`prev`)
        .setLabel("⬅️")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(index === 0);

      const nextButton = new ButtonBuilder()
        .setCustomId(`next`)
        .setLabel("➡️")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(index === searchResults.length - 1);

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(prevButton, nextButton, buyButton);

      const options = {
        components: [container, row],
        files: [{ attachment: displayInfo.imageUrl, name: "character.jpg" }],
        flags: MessageFlags.IsComponentsV2,
      };

      if (msg.edit) {
        return await msg.edit(options);
      } else {
        return await hybrid.send(container, options.files, [row]);
      }
    } catch (e) {
      Logger.error('Erreur updateMessage', e, 'SUMMON');
      throw e;
    }
  };

  let msg = await updateMessage({}, 0);

  const collector = msg.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 3600_000, // 1 heure
  });

  collector.on("collect", async (btn: ButtonInteraction) => {
    if (btn.user.id !== hybrid.user.id) {
      await btn.reply({ content: "Cette invocation n'est pas pour toi.", flags: MessageFlags.Ephemeral });
      return;
    }

    if (btn.customId === "prev") {
      currentIndex--;
      await btn.deferUpdate();
      await updateMessage(msg, currentIndex);
    } else if (btn.customId === "next") {
      currentIndex++;
      await btn.deferUpdate();
      await updateMessage(msg, currentIndex);
    } else if (btn.customId === "buy") {
      await btn.deferUpdate();

      const malChar = searchResults[currentIndex];
      let character: Character | undefined;

      if (malChar.id) {
        character = malChar;
      } else {
        character = await characterDB.getCharacterByMalId(malChar.malId);
        if (!character) {
          // Création à la volée s'il n'existe pas encore
          const rarity = getRandomRarity();
          character = await characterDB.createCharacter({
            name: malChar.name,
            series: "Anime / Manga",
            type: "anime",
            rarity: rarity,
            basePrice: RARITY_PRICES[rarity],
            imageUrl: malChar.imageUrl,
            malId: malChar.malId,
          });
        }
      }

      const totalWealth = await userDB.getTotalWealth();
      const dynamicPrice = Math.floor(character!.basePrice + totalWealth * config.summon.inflation_rate);
      const user = await userDB.getUserOrCreate(btn.user.id, btn.user.username);

      if (user.balance < dynamicPrice) {
        await btn.followUp({ content: "Solde insuffisant.", flags: MessageFlags.Ephemeral });
        return;
      }

      // Re-vérifier l'owner au dernier moment pour éviter les courses
      const owner = await characterDB.getCharacterOwner(character!.id);
      if (owner) {
        await btn.followUp({ content: "Désolé, ce personnage vient d'être acheté par quelqu'un d'autre !", flags: MessageFlags.Ephemeral });
        return;
      }

      user.balance -= dynamicPrice;
      await userDB.updateUser(user);
      const card = await characterDB.giveCard(btn.user.id, character!.id);

      const success = new ContainerBuilder()
        .addTextDisplayComponents((t) =>
          t.setContent(
            `**Achat réussi !**\n` +
            `**${character!.name}** a été ajouté à ta collection.\n` +
            `ID carte : \`#${card.cardId}\`\n` +
            `Nouveau solde : **$${user.balance.toLocaleString("fr-FR")}**`,
          ),
        )
        .addMediaGalleryComponents((gallery) =>
          gallery.addItems((item) => item.setURL(`attachment://character.jpg`)),
        );

      await btn.editReply({
        components: [success],
        files: [{ attachment: character!.imageUrl, name: "character.jpg" }],
        flags: MessageFlags.IsComponentsV2,
      });
      collector.stop();
    }
  });

  collector.on("end", async (_, reason) => {
    if (reason === "time") {
      try {
        const disabledContainer = new ContainerBuilder()
          .addTextDisplayComponents(t => t.setContent(`Invocation expirée. Tapez à nouveau la commande pour chercher.`));
        await msg.edit({ components: [disabledContainer], files: [] });
      } catch { }
    }
  });
}
