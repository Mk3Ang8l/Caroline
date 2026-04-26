import { ContainerBuilder, SeparatorBuilder, SectionBuilder, ThumbnailBuilder, MediaGalleryBuilder } from "discord.js";
import { UserDB } from "../Database/UserDB";
import { HybridInteraction } from "../Utils/HybridInteraction";

export async function profileCommand(
  hybrid: HybridInteraction,
  userDB: UserDB,
): Promise<void> {
  const targetUser = hybrid.getUser("user") ?? hybrid.user;
  const user = await userDB.getUserOrCreate(targetUser.id, targetUser.username);

  const winRate =
    user.totalWins + user.totalLosses > 0
      ? Math.round((user.totalWins / (user.totalWins + user.totalLosses)) * 100)
      : 0;

  const memberSince = new Date(user.createdAt).toLocaleDateString("fr-FR");

  const totalBalance = Number(user.balance) + Number(user.bankBalance);
  const gifFile = totalBalance < 1000000 ? "normal.gif" : "millionaire.gif";

  const container = new ContainerBuilder()
    .addSectionComponents((section) =>
      section
        .addTextDisplayComponents((textDisplay) =>
          textDisplay.setContent(
            `## ${targetUser.username}\n` +
            `*Membre depuis le ${memberSince}*\n\n` +
            `**Argent :** $${Number(user.balance).toLocaleString("fr-FR")} ($${Number(user.bankBalance).toLocaleString("fr-FR")} banque)\n` +
            `**Stats :** ${user.totalWins}V / ${user.totalLosses}D (${winRate}% winrate)`,
          ),
        )
        .setThumbnailAccessory((thumbnail) =>
          thumbnail.setURL(targetUser.displayAvatarURL({ size: 128 })),
        ),
    )
    .addMediaGalleryComponents((gallery) =>
      gallery.addItems((item) => item.setURL(`attachment://${gifFile}`)),
    );

  await hybrid.send(container, [
    { attachment: `./Images/${gifFile}`, name: gifFile },
  ]);
}
