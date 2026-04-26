import {
  ContainerBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  MessageFlags,
  ButtonInteraction,
  TextChannel,
  Message,
} from "discord.js";
import { UserDB } from "../Database/UserDB";
import { HybridInteraction } from "../Utils/HybridInteraction";
import { Logger } from "../Utils/Logger";

export async function spawnChest(
  channel: TextChannel,
  userDB: UserDB,
): Promise<void> {
  const container = new ContainerBuilder()
    .addTextDisplayComponents((t) =>
      t.setContent(
        `## 🎁 UN COFFRE MYSTÈRE EST APPARU !\n` +
          `Soyez le premier à cliquer sur le bouton pour récupérer son contenu !`,
      ),
    )
    .addMediaGalleryComponents((gallery) =>
      gallery.addItems((item) => item.setURL(`attachment://chest.gif`)),
    );

  const claimButton = new ButtonBuilder()
    .setCustomId("claim_chest")
    .setLabel("Ouvrir le coffre")
    .setStyle(ButtonStyle.Primary);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(claimButton);

  const msg = await channel.send({
    components: [container, row],
    files: [{ attachment: "Images/chest.gif", name: "chest.gif" }],
    flags: MessageFlags.IsComponentsV2,
  });

  const collector = msg.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 300_000,
    max: 1,
  });

  collector.on("collect", async (btn: ButtonInteraction) => {
    await btn.deferUpdate();

    const user = await userDB.getUserOrCreate(btn.user.id, btn.user.username);

    const rand = Math.random() * 100;
    let rewardText = "";

    if (rand < 70) {
      const amount = Math.floor(Math.random() * 10000) + 1;
      user.balance += amount;
      rewardText = ` Tu as trouvé **$${amount.toLocaleString("fr-FR")}** !`;
    } else if (rand < 85) {
      user.luckUntil = Date.now() + 3600_000;
      rewardText = ` Tu as obtenu un **Luck Boost** ! (Tes chances de personnages rares sont augmentées pendant 1h)`;
    } else {
      user.discountUntil = Date.now() + 3600_000;
      rewardText = ` Tu as obtenu une **Réduction de 20%** ! (Valable sur tes prochaines invocations pendant 1h)`;
    }

    await userDB.updateUser(user);

    const resultContainer = new ContainerBuilder().addTextDisplayComponents(
      (t) =>
        t.setContent(
          `## 🔓 Coffre ouvert par ${btn.user.username} !\n\n` +
            `${rewardText}\n\n` +
            `Ton nouveau solde : **$${user.balance.toLocaleString("fr-FR")}**`,
        ),
    );

    await btn.editReply({
      components: [resultContainer],
      files: [],
    });
  });

  collector.on("end", async (collected, reason) => {
    if (reason === "time" && collected.size === 0) {
      const expired = new ContainerBuilder().addTextDisplayComponents((t) =>
        t.setContent(
          `⌛ Le coffre a disparu... Personne ne l'a ouvert à temps.`,
        ),
      );
      try {
        await msg.edit({ components: [expired], files: [] });
      } catch {}
    }
  });
}

export async function spawnChestCommand(
  hybrid: HybridInteraction,
  userDB: UserDB,
): Promise<void> {
  const ownerId = "1278669161584922658";
  if (hybrid.user.id !== ownerId) {
    await hybrid.send(
      new ContainerBuilder().addTextDisplayComponents((t) =>
        t.setContent("❌ Seul le propriétaire peut forcer un coffre."),
      ),
    );
    return;
  }

  await hybrid.send(
    new ContainerBuilder().addTextDisplayComponents((t) =>
      t.setContent(" Coffre généré !"),
    ),
  );
  await spawnChest(hybrid.source.channel as TextChannel, userDB);
}
