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

  if (hybrid.isSlash) {
    nameQuery = (hybrid.source as any).options.getString("name");
  } else {
    nameQuery = hybrid.prefixArgs.join(" ");
  }

  if (!nameQuery) {
    // Si pas de nom, on prend un personnage aléatoire du catalogue existant (ancien comportement)
    const character = await characterDB.getRandomCharacter();
    await displaySummon(hybrid, userDB, characterDB, character);
    return;
  }

  const allChars = await characterDB.getAllCharacters();
  const localChar = allChars.find((c) =>
    c.name.toLowerCase().includes(nameQuery!.toLowerCase()),
  );

  if (localChar) {
    await displaySummon(hybrid, userDB, characterDB, localChar);
    return;
  }

  try {
    const res = await fetch(
      `https://api.jikan.moe/v4/characters?q=${encodeURIComponent(nameQuery)}&limit=1`,
    );
    const data = (await res.json()) as any;

    if (data && data.data && data.data.length > 0) {
      const malChar = data.data[0];
      const rarity = getRandomRarity();

      // Créer le personnage dans le catalogue local pour le futur
      const newChar = await characterDB.createCharacter({
        name: malChar.name,
        series: "Anime / Manga",
        type: "anime",
        rarity: rarity,
        basePrice: RARITY_PRICES[rarity],
        imageUrl: malChar.images.jpg.image_url,
      });

      await displaySummon(hybrid, userDB, characterDB, newChar);
    } else {
      const c = new ContainerBuilder().addTextDisplayComponents((t) =>
        t.setContent(`Aucun personnage trouvé pour "${nameQuery}".`),
      );
      await hybrid.send(c);
    }
  } catch (error) {
    console.error(error);
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
  character: Character,
) {
  const owner = await characterDB.getCharacterOwner(character.id);
  const totalWealth = await userDB.getTotalWealth();
  const dynamicPrice = Math.floor(character.basePrice + totalWealth * config.summon.inflation_rate);

  const buyButton = new ButtonBuilder()
    .setCustomId(`buy_summon_${character.id}_${dynamicPrice}`)
    .setLabel(
      owner
        ? "Déjà possédé"
        : `Acheter pour $${dynamicPrice.toLocaleString("fr-FR")}`,
    )
    .setStyle(ButtonStyle.Success)
    .setDisabled(owner !== undefined);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(buyButton);

  const container = new ContainerBuilder()
    .addTextDisplayComponents((t) =>
      t.setContent(
        `## Invocation : ${character.name}\n` +
          `Série : *${character.series}*\n` +
          `Rareté : **${RARITY_LABEL[character.rarity]}**\n` +
          `Prix dynamique : **$${dynamicPrice.toLocaleString("fr-FR")}**\n\n` +
          (owner
            ? ` Ce personnage est unique et appartient déjà à <@${owner.userId}>.`
            : ` Ce personnage est disponible !`),
      ),
    )
    .addMediaGalleryComponents((gallery) =>
      gallery.addItems((item) => item.setURL(`attachment://character.jpg`)),
    );

  const msg = await hybrid.send(
    container,
    [{ attachment: character.imageUrl, name: "character.jpg" }],
    [row],
  );

  const collector = msg.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 30_000,
  });

  collector.on("collect", async (btn: ButtonInteraction) => {
    if (btn.user.id !== hybrid.user.id) {
      await btn.reply({
        content: "Cette invocation n'est pas pour toi.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await btn.deferUpdate();

    const user = await userDB.getUserOrCreate(
      hybrid.user.id,
      hybrid.user.username,
    );
    if (user.balance < dynamicPrice) {
      await btn.followUp({
        content: "Solde insuffisant.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    user.balance -= dynamicPrice;
    await userDB.updateUser(user);
    const card = await characterDB.giveCard(hybrid.user.id, character.id);

    const success = new ContainerBuilder()
      .addTextDisplayComponents((t) =>
        t.setContent(
          `**Achat réussi !**\n` +
            `**${character.name}** a été ajouté à ta collection.\n` +
            `ID carte : \`#${card.cardId}\`\n` +
            `Nouveau solde : **$${user.balance.toLocaleString("fr-FR")}**`,
        ),
      )
      .addMediaGalleryComponents((gallery) =>
        gallery.addItems((item) => item.setURL(`attachment://character.jpg`)),
      );

    await btn.editReply({
      components: [success],
      files: [{ attachment: character.imageUrl, name: "character.jpg" }],
      flags: MessageFlags.IsComponentsV2,
    });
    collector.stop();
  });

  collector.on("end", async (_, reason) => {
    if (reason === "time") {
      const disabledRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        ButtonBuilder.from(buyButton).setDisabled(true).setLabel("Expiré"),
      );
      try {
        if (hybrid.isSlash)
          await (hybrid.source as any).editReply({
            components: [container, disabledRow],
          });
        else await msg.edit({ components: [container, disabledRow] });
      } catch {}
    }
  });
}
