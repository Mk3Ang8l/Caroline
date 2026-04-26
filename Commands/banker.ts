// commande admin

import { ContainerBuilder } from "discord.js";
import { UserDB } from "../Database/UserDB";
import { HybridInteraction } from "../Utils/HybridInteraction";
import { getConfig } from "../Utils/ConfigLoader";

const config = getConfig();
const BANKER_ID = config.bot.banker_id;

export async function bankerGiveCommand(
  hybrid: HybridInteraction,
  userDB: UserDB,
): Promise<void> {
  if (hybrid.user.id !== BANKER_ID) {
    const c = new ContainerBuilder().addTextDisplayComponents((t) =>
      t.setContent("❌ Seul le Banquier a le pouvoir de générer de l'argent."),
    );
    await hybrid.send(c);
    return;
  }

  const targetUser = hybrid.getUser("user");
  let amount: number;

  if (hybrid.isSlash) {
    amount = (hybrid.source as any).options.getInteger("amount", true);
  } else {
    amount = parseInt(hybrid.prefixArgs[1] ?? "", 10);
  }

  if (!targetUser || isNaN(amount) || amount <= 0) {
    const c = new ContainerBuilder().addTextDisplayComponents((t) =>
      t.setContent("Usage : `!give @user <montant>`"),
    );
    await hybrid.send(c);
    return;
  }

  const user = await userDB.getUserOrCreate(targetUser.id, targetUser.username);
  user.balance += amount;
  await userDB.updateUser(user);

  const container = new ContainerBuilder().addTextDisplayComponents((t) =>
    t.setContent(
      `🏛️ **Transaction Bancaire**\n\n` +
        `Le Banquier a injecté **$${amount.toLocaleString("fr-FR")}** sur le compte de <@${targetUser.id}>.\n` +
        `Nouveau solde : **$${user.balance.toLocaleString("fr-FR")}**`,
    ),
  );

  await hybrid.send(container);
}
