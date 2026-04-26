// commande qui donne 500$ a un utilisateur par jour

import { ContainerBuilder, MediaGalleryBuilder } from "discord.js";
import { UserDB } from "../Database/UserDB";
import { HybridInteraction } from "../Utils/HybridInteraction";

const DAILY_AMOUNT = 500;
const COOLDOWN_MS = 24 * 60 * 60 * 1000;

export async function dailyCommand(
  hybrid: HybridInteraction,
  userDB: UserDB,
): Promise<void> {
  const user = await userDB.getUserOrCreate(
    hybrid.user.id,
    hybrid.user.username,
  );

  const now = Date.now();
  const lastDaily = user.lastDaily ?? 0;
  const diff = now - lastDaily;

  if (diff < COOLDOWN_MS) {
    const remaining = COOLDOWN_MS - diff;
    const hours = Math.floor(remaining / 3_600_000);
    const minutes = Math.floor((remaining % 3_600_000) / 60_000);

    const container = new ContainerBuilder().addTextDisplayComponents(
      (textDisplay) =>
        textDisplay.setContent(
          `Tu as déjà réclamé ton daily ! Reviens dans **${hours}h ${minutes}min**.`,
        ),
    );

    await hybrid.send(container);
    return;
  }

  user.balance += DAILY_AMOUNT;
  user.lastDaily = now;
  await userDB.updateUser(user);

  const container = new ContainerBuilder()
    .addTextDisplayComponents((textDisplay) =>
      textDisplay.setContent(
        `**Daily réclamé !**\nTu as reçu **$${DAILY_AMOUNT.toLocaleString("fr-FR")}**.\nNouveau solde : **$${user.balance.toLocaleString("fr-FR")}**`,
      ),
    )
    .addMediaGalleryComponents((gallery) =>
      gallery.addItems((item) => item.setURL("attachment://addmoney.gif")),
    );

  await hybrid.send(container, [
    { attachment: "./Images/addmoney.gif", name: "addmoney.gif" },
  ]);
}
