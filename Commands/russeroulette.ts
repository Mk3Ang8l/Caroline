// commande de roulette russe

import { ContainerBuilder, MessageFlags } from "discord.js";
import { UserDB } from "../Database/UserDB";
import { HybridInteraction } from "../Utils/HybridInteraction";

const chambers = new Map<string, number>();
const CHAMBER_SIZE = 6;

function getBullets(userId: string): number {
  return chambers.get(userId) ?? 1;
}

function advanceBullets(userId: string): number {
  const current = getBullets(userId);
  const next = current >= 5 ? 1 : current + 1;
  chambers.set(userId, next);
  return next;
}

function pullTrigger(bullets: number): boolean {
  const chance = (CHAMBER_SIZE - bullets) / CHAMBER_SIZE;
  return Math.random() < chance;
}

const MULTIPLIERS: Record<number, number> = {
  1: 1.2,
  2: 1.5,
  3: 2.0,
  4: 3.0,
  5: 5.0,
};

export async function russeRouletteCommand(
  hybrid: HybridInteraction,
  userDB: UserDB,
): Promise<void> {
  let amount: number;

  if (hybrid.isSlash) {
    amount = (hybrid.source as any).options.getInteger("amount", true);
  } else {
    const args = hybrid.prefixArgs;
    amount = parseInt(args[0] ?? "", 10);
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

  const bullets = getBullets(hybrid.user.id);
  const multiplier = MULTIPLIERS[bullets] ?? 1.2;
  const barrelDisplay = "◼".repeat(bullets) + "◻".repeat(5 - bullets);

  const suspenseContainer = new ContainerBuilder()
    .addTextDisplayComponents((t) =>
      t.setContent(
        `**Roulette Russe**\n` +
          `Barillet : \`[${barrelDisplay}]\` — ${bullets} balle(s) sur ${CHAMBER_SIZE}\n` +
          `Mise : **$${amount.toLocaleString("fr-FR")}** — Gain potentiel : **$${Math.floor(amount * multiplier).toLocaleString("fr-FR")}** (x${multiplier})\n\n` +
          `*Clic...*`,
      ),
    )
    .addMediaGalleryComponents((g) =>
      g.addItems((i) => i.setURL("attachment://russeroulette.gif")),
    );

  const msg = await hybrid.send(suspenseContainer, [
    { attachment: "./Images/russeroulette.gif", name: "russeroulette.gif" },
  ]);

  await new Promise((r) => setTimeout(r, 3000));

  const survived = pullTrigger(bullets);

  // Faire avancer les balles pour la prochaine fois
  const nextBullets = advanceBullets(hybrid.user.id);

  let resultText: string;

  if (survived) {
    const payout = Math.floor(amount * multiplier);
    user.balance += payout - amount;
    user.totalWins++;
    resultText =
      `**Tu as survécu.**\n` +
      `Tu remportes **$${payout.toLocaleString("fr-FR")}** (x${multiplier})\n` +
      `Prochain tour : **${nextBullets} balle(s)** dans le barillet.`;
  } else {
    user.balance -= amount;
    user.totalLosses++;
    if (user.balance < 0) {
      user.balance = 0;
      user.bankruptcies++;
    }
    chambers.set(hybrid.user.id, 1);
    resultText =
      `**BANG.**\n` +
      `Tu perds **$${amount.toLocaleString("fr-FR")}**.\n` +
      `Le barillet a été réinitialisé à 1 balle.`;
  }

  await userDB.updateUser(user);

  const resultContainer = new ContainerBuilder()
    .addTextDisplayComponents((t) =>
      t.setContent(
        `**Roulette Russe — Résultat**\n` +
          `${resultText}\n` +
          `Nouveau solde : **$${user.balance.toLocaleString("fr-FR")}**`,
      ),
    )
    .addMediaGalleryComponents((g) =>
      g.addItems((i) => i.setURL("attachment://russeroulette.gif")),
    );

  try {
    if (hybrid.isSlash) {
      await (hybrid.source as any).editReply({
        components: [resultContainer],
        flags: MessageFlags.IsComponentsV2,
        files: [
          {
            attachment: "./Images/russeroulette.gif",
            name: "russeroulette.gif",
          },
        ],
      });
    } else {
      await (msg as any).edit({
        components: [resultContainer],
        flags: MessageFlags.IsComponentsV2,
        files: [
          {
            attachment: "./Images/russeroulette.gif",
            name: "russeroulette.gif",
          },
        ],
      });
    }
  } catch {
    await hybrid.send(resultContainer, [
      { attachment: "./Images/russeroulette.gif", name: "russeroulette.gif" },
    ]);
  }
}
