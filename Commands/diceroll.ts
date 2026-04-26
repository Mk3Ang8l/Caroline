// commande de lancer de dés pas grand chose a dire sur celle ci

import { ContainerBuilder, MessageFlags } from "discord.js";
import { UserDB } from "../Database/UserDB";
import { HybridInteraction } from "../Utils/HybridInteraction";

const MULTIPLIER = 1.5;

function rollDice(): number {
  return Math.floor(Math.random() * 6) + 1; // 1–6
}

export async function dicerollCommand(
  hybrid: HybridInteraction,
  userDB: UserDB,
): Promise<void> {
  let choice: string;
  let amount: number;

  if (hybrid.isSlash) {
    choice = (hybrid.source as any).options
      .getString("choice", true)
      .toLowerCase();
    amount = (hybrid.source as any).options.getInteger("amount", true);
  } else {
    const args = hybrid.prefixArgs;
    choice = (args[0] ?? "").toLowerCase();
    amount = parseInt(args[1] ?? "", 10);
  }

  if (choice !== "pair" && choice !== "impair") {
    const c = new ContainerBuilder().addTextDisplayComponents((t) =>
      t.setContent("Choix invalide. Utilise `pair` ou `impair`."),
    );
    await hybrid.send(c);
    return;
  }

  if (isNaN(amount) || amount < 1) {
    const c = new ContainerBuilder().addTextDisplayComponents((t) =>
      t.setContent("Mise invalide. Indique un montant positif."),
    );
    await hybrid.send(c);
    return;
  }

  const user = await userDB.getUserOrCreate(
    hybrid.user.id,
    hybrid.user.username,
  );

  if (user.balance < amount) {
    const c = new ContainerBuilder().addTextDisplayComponents((t) =>
      t.setContent(
        `Solde insuffisant. Tu as **$${user.balance.toLocaleString("fr-FR")}**.`,
      ),
    );
    await hybrid.send(c);
    return;
  }

  const suspenseContainer = new ContainerBuilder()
    .addTextDisplayComponents((t) =>
      t.setContent(
        `**Lancer de dés**\n` +
          `Ton pari : **${choice}** — Mise : **$${amount.toLocaleString("fr-FR")}**\n\n` +
          `*Les dés roulent...*`,
      ),
    )
    .addMediaGalleryComponents((g) =>
      g.addItems((i) => i.setURL("attachment://diceroll.gif")),
    );

  const msg = await hybrid.send(suspenseContainer, [
    { attachment: "./Images/diceroll.gif", name: "diceroll.gif" },
  ]);

  await new Promise((r) => setTimeout(r, 3000));

  const roll = rollDice();
  const isEven = roll % 2 === 0;
  const resultLabel = isEven ? "pair" : "impair";
  const win = choice === resultLabel;

  const payout = win ? Math.floor(amount * MULTIPLIER) : 0;

  if (win) {
    user.balance += payout - amount;
    user.totalWins++;
  } else {
    user.balance -= amount;
    user.totalLosses++;
    if (user.balance < 0) {
      user.balance = 0;
      user.bankruptcies++;
    }
  }
  await userDB.updateUser(user);

  const dieFaces = ["", "1", "2", "3", "4", "5", "6"];
  const resultLine = win
    ? `Gagné ! Tu remportes **$${payout.toLocaleString("fr-FR")}** (x${MULTIPLIER})`
    : `Perdu. Tu as perdu **$${amount.toLocaleString("fr-FR")}**`;

  const resultContainer = new ContainerBuilder()
    .addTextDisplayComponents((t) =>
      t.setContent(
        `**Lancer de dés — ${dieFaces[roll]} (${resultLabel})**\n` +
          `Ton pari : **${choice}** — Mise : **$${amount.toLocaleString("fr-FR")}**\n` +
          `${resultLine}\n` +
          `Nouveau solde : **$${user.balance.toLocaleString("fr-FR")}**`,
      ),
    )
    .addMediaGalleryComponents((g) =>
      g.addItems((i) => i.setURL("attachment://diceroll.gif")),
    );

  try {
    if (hybrid.isSlash) {
      await (hybrid.source as any).editReply({
        components: [resultContainer],
        flags: MessageFlags.IsComponentsV2,
        files: [{ attachment: "./Images/diceroll.gif", name: "diceroll.gif" }],
      });
    } else {
      await (msg as any).edit({
        components: [resultContainer],
        flags: MessageFlags.IsComponentsV2,
        files: [{ attachment: "./Images/diceroll.gif", name: "diceroll.gif" }],
      });
    }
  } catch {
    await hybrid.send(resultContainer, [
      { attachment: "./Images/diceroll.gif", name: "diceroll.gif" },
    ]);
  }
}
