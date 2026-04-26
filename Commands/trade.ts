//commande dechange

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

const MIN_TRADE_PRICE = 100;

export async function tradeCommand(
  hybrid: HybridInteraction,
  userDB: UserDB,
  characterDB: CharacterDB,
): Promise<void> {
  let characterName: string;
  let offer: number;

  if (hybrid.isSlash) {
    characterName = (hybrid.source as any).options.getString("name", true);
    offer = (hybrid.source as any).options.getInteger("offer", true);
  } else {
    const args = hybrid.prefixArgs;
    if (args.length < 2) {
      const c = new ContainerBuilder().addTextDisplayComponents((t) =>
        t.setContent(
          `Usage : \`!trade <nom_personnage> <offre>\` (ex: \`!trade saitama 5000\`)`,
        ),
      );
      await hybrid.send(c);
      return;
    }
    offer = parseInt(args.pop() ?? "", 10);
    characterName = args.join(" ");
  }

  if (!characterName || isNaN(offer) || offer < MIN_TRADE_PRICE) {
    const c = new ContainerBuilder().addTextDisplayComponents((t) =>
      t.setContent(
        `Usage : \`!trade <nom_personnage> <offre>\` (minimum $${MIN_TRADE_PRICE})`,
      ),
    );
    await hybrid.send(c);
    return;
  }

  const character = await characterDB.getCharacterByName(characterName);
  if (!character) {
    const c = new ContainerBuilder().addTextDisplayComponents((t) =>
      t.setContent(
        `Personnage "${characterName}" introuvable dans le catalogue.`,
      ),
    );
    await hybrid.send(c);
    return;
  }

  const card = await characterDB.getUserCardByCharacterId(character.id);
  if (!card) {
    const c = new ContainerBuilder().addTextDisplayComponents((t) =>
      t.setContent(
        `Personnage **${character.name}** n'est possédé par personne. Utilise \`!summon\` pour l'obtenir !`,
      ),
    );
    await hybrid.send(c);
    return;
  }

  if (card.userId === hybrid.user.id) {
    const c = new ContainerBuilder().addTextDisplayComponents((t) =>
      t.setContent(`Tu possèdes déjà **${character.name}** !`),
    );
    await hybrid.send(c);
    return;
  }

  const buyer = await userDB.getUserOrCreate(
    hybrid.user.id,
    hybrid.user.username,
  );
  if (buyer.balance < offer) {
    const c = new ContainerBuilder().addTextDisplayComponents((t) =>
      t.setContent(
        `Tu n'as pas assez d'argent pour cette offre ($${offer.toLocaleString("fr-FR")}).`,
      ),
    );
    await hybrid.send(c);
    return;
  }

  const ownerId = card.userId;
  const cardId = card.cardId;

  const acceptBtn = new ButtonBuilder()
    .setCustomId("trade_accept")
    .setLabel("Accepter")
    .setStyle(ButtonStyle.Success);
  const refuseBtn = new ButtonBuilder()
    .setCustomId("trade_refuse")
    .setLabel("Refuser")
    .setStyle(ButtonStyle.Danger);
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    acceptBtn,
    refuseBtn,
  );

  const container = new ContainerBuilder()
    .addTextDisplayComponents((t) =>
      t.setContent(
        `### 🤝 Proposition d'échange\n` +
          `<@${hybrid.user.id}> souhaite acheter **${character.name}** à <@${ownerId}>.\n\n` +
          `**Offre :** $${offer.toLocaleString("fr-FR")}\n` +
          `**ID Carte :** \`#${cardId}\`\n\n` +
          `<@${ownerId}>, acceptes-tu cette offre ?`,
      ),
    )
    .addMediaGalleryComponents((gallery) =>
      gallery.addItems((item) => item.setURL(`attachment://trade_char.jpg`)),
    );

  const msg = await hybrid.send(
    container,
    [{ attachment: character.imageUrl, name: "trade_char.jpg" }],
    [row],
  );

  const collector = msg.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 60_000,
  });

  collector.on("collect", async (btn: ButtonInteraction) => {
    if (btn.user.id !== ownerId) {
      await btn.reply({
        content: "Seul le propriétaire de la carte peut répondre.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await btn.deferUpdate();

    if (btn.customId === "trade_refuse") {
      const refused = new ContainerBuilder().addTextDisplayComponents((t) =>
        t.setContent(
          `❌ <@${ownerId}> a refusé l'offre pour **${character.name}**.`,
        ),
      );
      await btn.editReply({ components: [refused], files: [] });
      collector.stop();
      return;
    }

    const currentBuyer = await userDB.getUserOrCreate(
      hybrid.user.id,
      hybrid.user.username,
    );
    if (currentBuyer.balance < offer) {
      await btn.followUp({
        content: `L'acheteur n'a plus assez d'argent ($${offer.toLocaleString("fr-FR")}). Transaction annulée.`,
        flags: MessageFlags.Ephemeral,
      });
      collector.stop();
      return;
    }

    const currentCard = await characterDB.getUserCard(cardId);
    if (!currentCard || currentCard.userId !== ownerId) {
      await btn.followUp({
        content: `Le vendeur ne possède plus cette carte. Transaction annulée.`,
        flags: MessageFlags.Ephemeral,
      });
      collector.stop();
      return;
    }

    const seller = await userDB.getUserOrCreate(ownerId, ""); // On a déjà son ID

    currentBuyer.balance -= offer;
    seller.balance += offer;

    await userDB.updateUser(currentBuyer);
    await userDB.updateUser(seller);
    await characterDB.transferCard(cardId, hybrid.user.id);

    const success = new ContainerBuilder()
      .addTextDisplayComponents((t) =>
        t.setContent(
          ` **Transaction effectuée !**\n` +
            `**${character.name}** appartient désormais à <@${hybrid.user.id}>.\n` +
            `**Prix payé :** $${offer.toLocaleString("fr-FR")}`,
        ),
      )
      .addMediaGalleryComponents((gallery) =>
        gallery.addItems((item) => item.setURL(`attachment://trade_char.jpg`)),
      );

    await btn.editReply({
      components: [success],
      files: [{ attachment: character.imageUrl, name: "trade_char.jpg" }],
      flags: MessageFlags.IsComponentsV2,
    });
    collector.stop();
  });

  collector.on("end", async (_, reason) => {
    if (reason === "time") {
      const timeout = new ContainerBuilder().addTextDisplayComponents((t) =>
        t.setContent(`⏰ L'offre pour **${character.name}** a expiré.`),
      );
      try {
        if (hybrid.isSlash)
          await (hybrid.source as any).editReply({
            components: [timeout],
            files: [],
          });
        else await msg.edit({ components: [timeout], files: [] });
      } catch {}
    }
  });
}
