// Commande bank qui permet a lutilisateur de garder son argent pour le
// proteger des vols

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  ContainerBuilder,
  MessageFlags,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  StringSelectMenuInteraction,
  ButtonInteraction,
  SectionBuilder,
  ThumbnailBuilder,
  TextDisplayBuilder,
  MediaGalleryBuilder,
} from "discord.js";
import { UserDB } from "../Database/UserDB";
import { HybridInteraction } from "../Utils/HybridInteraction";

export async function bankCommand(
  hybrid: HybridInteraction,
  userDB: UserDB,
): Promise<void> {
  const user = await userDB.getUserOrCreate(
    hybrid.user.id,
    hybrid.user.username,
  );

  // Afficher le menu initial avec les boutons
  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId("bank_action")
    .setPlaceholder("Choisir une action bancaire")
    .addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel("Déposer de l'argent")
        .setDescription("Mettre de l'argent à la banque")
        .setValue("deposit"),
      new StringSelectMenuOptionBuilder()
        .setLabel("Retirer de l'argent")
        .setDescription("Retirer de l'argent de la banque")
        .setValue("withdraw"),
    );

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    selectMenu,
  );

  const container = new ContainerBuilder()
    .addSectionComponents((section) =>
      section
        .addTextDisplayComponents((textDisplay) =>
          textDisplay.setContent(
            `## Banque\n**Solde en poche :** $${user.balance.toLocaleString("fr-FR")}\n**Solde à la banque :** $${user.bankBalance.toLocaleString("fr-FR")}`,
          ),
        )
        .setThumbnailAccessory((thumbnail) =>
          thumbnail.setURL(hybrid.user.displayAvatarURL({ size: 128 })),
        ),
    )
    .addMediaGalleryComponents((gallery) =>
      gallery.addItems((item) => item.setURL("attachment://bank.gif")),
    );

  let message;
  if (hybrid.isSlash) {
    message = await (hybrid.source as any).editReply({
      components: [container, row],
      flags: MessageFlags.IsComponentsV2,
      files: [{ attachment: "./Images/bank.gif", name: "bank.gif" }],
    });
  } else {
    message = await (hybrid.source as any).reply({
      components: [container, row],
      flags: MessageFlags.IsComponentsV2,
      files: [{ attachment: "./Images/bank.gif", name: "bank.gif" }],
    });
  }

  // Attendre la sélection de l'utilisateur
  const collector = message.createMessageComponentCollector({
    componentType: ComponentType.StringSelect,
    time: 60_000,
  });

  collector.on(
    "collect",
    async (selectInteraction: StringSelectMenuInteraction) => {
      if (selectInteraction.user.id !== hybrid.user.id) {
        await selectInteraction.reply({
          content: "Tu ne peux pas utiliser ce menu.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const action = selectInteraction.values[0];

      if (action === "deposit") {
        await handleDeposit(selectInteraction, userDB, hybrid.user.id);
      } else if (action === "withdraw") {
        await handleWithdraw(selectInteraction, userDB, hybrid.user.id);
      }

      collector.stop();
    },
  );

  collector.on("end", () => {
    // Menu expiré
  });
}

async function handleDeposit(
  interaction: StringSelectMenuInteraction,
  userDB: UserDB,
  userId: string,
): Promise<void> {
  await interaction.deferUpdate();

  const user = await userDB.getUserOrCreate(userId, "");

  if (user.balance === 0) {
    const container = new ContainerBuilder().addTextDisplayComponents(
      (textDisplay) =>
        textDisplay.setContent("Tu n'as pas d'argent à déposer."),
    );

    await interaction.editReply({
      components: [container],
      flags: MessageFlags.IsComponentsV2,
    });
    return;
  }

  // Boutons pour les montants prédéfinis
  const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("deposit_25")
      .setLabel("25%")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("deposit_50")
      .setLabel("50%")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("deposit_75")
      .setLabel("75%")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("deposit_100")
      .setLabel("100%")
      .setStyle(ButtonStyle.Danger),
  );

  const container = new ContainerBuilder().addTextDisplayComponents(
    (textDisplay) =>
      textDisplay.setContent(
        `Quel pourcentage veux-tu déposer ?\n**Solde :** $${user.balance.toLocaleString("fr-FR")}`,
      ),
  );

  const message = await interaction.editReply({
    components: [container, buttons],
    flags: MessageFlags.IsComponentsV2,
  });

  const collector = message.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 30_000,
  });

  collector.on("collect", async (buttonInteraction: ButtonInteraction) => {
    if (buttonInteraction.user.id !== userId) {
      await buttonInteraction.reply({
        content: "Tu ne peux pas utiliser ce bouton.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await buttonInteraction.deferUpdate();

    const freshUser = await userDB.getUserOrCreate(userId, "");
    let percentage = 0;

    if (buttonInteraction.customId === "deposit_25") percentage = 0.25;
    else if (buttonInteraction.customId === "deposit_50") percentage = 0.5;
    else if (buttonInteraction.customId === "deposit_75") percentage = 0.75;
    else if (buttonInteraction.customId === "deposit_100") percentage = 1.0;

    const depositAmount = Math.floor(freshUser.balance * percentage);

    freshUser.balance -= depositAmount;
    freshUser.bankBalance += depositAmount;

    await userDB.updateUser(freshUser);

    const successContainer = new ContainerBuilder().addTextDisplayComponents(
      (textDisplay) =>
        textDisplay.setContent(
          `Tu as déposé **$${depositAmount.toLocaleString("fr-FR")}** à la banque !\n\n**Solde en poche :** $${freshUser.balance.toLocaleString("fr-FR")}\n**Solde à la banque :** $${freshUser.bankBalance.toLocaleString("fr-FR")}`,
        ),
    );

    await buttonInteraction.editReply({
      components: [successContainer],
      flags: MessageFlags.IsComponentsV2,
    });

    collector.stop();
  });

  collector.on("end", () => {
    // Menu expiré
  });
}

async function handleWithdraw(
  interaction: StringSelectMenuInteraction,
  userDB: UserDB,
  userId: string,
): Promise<void> {
  await interaction.deferUpdate();

  const user = await userDB.getUserOrCreate(userId, "");

  if (user.bankBalance === 0) {
    const container = new ContainerBuilder().addTextDisplayComponents(
      (textDisplay) =>
        textDisplay.setContent("Tu n'as pas d'argent à retirer."),
    );

    await interaction.editReply({
      components: [container],
      flags: MessageFlags.IsComponentsV2,
    });
    return;
  }

  // Boutons pour les montants prédéfinis
  const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("withdraw_5")
      .setLabel("5%")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("withdraw_25")
      .setLabel("25%")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("withdraw_50")
      .setLabel("50%")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("withdraw_75")
      .setLabel("75%")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("withdraw_100")
      .setLabel("100%")
      .setStyle(ButtonStyle.Danger),
  );

  const container = new ContainerBuilder().addTextDisplayComponents(
    (textDisplay) =>
      textDisplay.setContent(
        `Quel pourcentage veux-tu retirer ?\n**Solde à la banque :** $${user.bankBalance.toLocaleString("fr-FR")}`,
      ),
  );

  const message = await interaction.editReply({
    components: [container, buttons],
    flags: MessageFlags.IsComponentsV2,
  });

  const collector = message.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 30_000,
  });

  collector.on("collect", async (buttonInteraction: ButtonInteraction) => {
    if (buttonInteraction.user.id !== userId) {
      await buttonInteraction.reply({
        content: "Tu ne peux pas utiliser ce bouton.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await buttonInteraction.deferUpdate();

    const freshUser = await userDB.getUserOrCreate(userId, "");
    let percentage = 0;

    if (buttonInteraction.customId === "withdraw_5") percentage = 0.05;
    else if (buttonInteraction.customId === "withdraw_25") percentage = 0.25;
    else if (buttonInteraction.customId === "withdraw_50") percentage = 0.5;
    else if (buttonInteraction.customId === "withdraw_75") percentage = 0.75;
    else if (buttonInteraction.customId === "withdraw_100") percentage = 1.0;

    const withdrawAmount = Math.floor(freshUser.bankBalance * percentage);

    freshUser.bankBalance -= withdrawAmount;
    freshUser.balance += withdrawAmount;

    await userDB.updateUser(freshUser);

    const successContainer = new ContainerBuilder().addTextDisplayComponents(
      (textDisplay) =>
        textDisplay.setContent(
          `Tu as retiré **$${withdrawAmount.toLocaleString("fr-FR")}** de la banque !\n\n**Solde en poche :** $${freshUser.balance.toLocaleString("fr-FR")}\n**Solde à la banque :** $${freshUser.bankBalance.toLocaleString("fr-FR")}`,
        ),
    );

    await buttonInteraction.editReply({
      components: [successContainer],
      flags: MessageFlags.IsComponentsV2,
    });

    collector.stop();
  });

  collector.on("end", () => {
    // Menu expiré
  });
}
