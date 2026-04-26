//commande roulette une des plus chiante a faire

import {
  ContainerBuilder,
  MediaGalleryBuilder,
  MessageFlags,
} from "discord.js";
import { UserDB } from "../Database/UserDB";
import { HybridInteraction } from "../Utils/HybridInteraction";

// Numéros rouges sur une vraie roulette
const RED_NUMBERS = new Set([
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
]);
const ROULETTE_SIZE = 37; // 0–36

type BetType =
  | { kind: "color"; value: "rouge" | "noir" | "vert" }
  | { kind: "number"; value: number };

function parseBet(raw: string): BetType | null {
  const lower = raw.toLowerCase().trim();
  if (lower === "rouge" || lower === "r")
    return { kind: "color", value: "rouge" };
  if (lower === "noir" || lower === "n")
    return { kind: "color", value: "noir" };
  if (lower === "vert" || lower === "v")
    return { kind: "color", value: "vert" };
  const n = parseInt(lower, 10);
  if (!isNaN(n) && n >= 0 && n <= 36) return { kind: "number", value: n };
  return null;
}

function getMultiplier(bet: BetType): number {
  if (bet.kind === "color") {
    if (bet.value === "vert") return 14;
    return 1.9;
  }

  if (bet.value === 0) return 5;
  return 5;
}

function spinRoulette(
  bet: BetType,
  betAmount: number,
): {
  result: number;
  color: "rouge" | "noir" | "vert";
  win: boolean;
  multiplier: number;
  payout: number;
} {
  const lossBias = Math.min(0.3, betAmount / 100_000);

  const result = Math.floor(Math.random() * ROULETTE_SIZE);
  const color: "rouge" | "noir" | "vert" =
    result === 0 ? "vert" : RED_NUMBERS.has(result) ? "rouge" : "noir";

  let win = false;
  if (bet.kind === "color") {
    win = bet.value === color;
  } else {
    win = bet.value === result;
  }

  if (win && Math.random() < lossBias) {
    win = false;
  }

  const multiplier = getMultiplier(bet);
  const payout = win ? Math.floor(betAmount * multiplier) : 0;

  return { result, color, win, multiplier, payout };
}

function colorLabel(c: "rouge" | "noir" | "vert"): string {
  const map = { rouge: "Rouge", noir: "Noir", vert: "Vert" };
  return map[c];
}

export async function rouletteCommand(
  hybrid: HybridInteraction,
  userDB: UserDB,
): Promise<void> {
  let betStr = "";
  let amountStr = "";

  if (hybrid.isSlash) {
    const src = hybrid.source as any;
    betStr = src.options.getString("bet", true);
    amountStr = String(src.options.getInteger("amount", true));
  } else {
    const args = hybrid.prefixArgs;
    betStr = args[0] ?? "";
    amountStr = args[1] ?? "";
  }

  const bet = parseBet(betStr);
  const amount = parseInt(amountStr, 10);

  if (!bet) {
    const c = new ContainerBuilder().addTextDisplayComponents((t) =>
      t.setContent(
        "Pari invalide. Utilise : `rouge`, `noir`, `vert`, ou un numéro entre 0 et 36.",
      ),
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
        `La roulette tourne...\n**Mise :** $${amount.toLocaleString("fr-FR")} sur **${betStr}**`,
      ),
    )
    .addMediaGalleryComponents((g) =>
      g.addItems((i) => i.setURL("attachment://roulette.gif")),
    );

  const msg = await hybrid.send(suspenseContainer, [
    { attachment: "./Images/roulette.gif", name: "roulette.gif" },
  ]);

  await new Promise((r) => setTimeout(r, 3000));

  const { result, color, win, multiplier, payout } = spinRoulette(bet, amount);

  if (win) {
    user.balance += payout - amount;
    user.totalWins++;
  } else {
    user.balance -= amount;
    user.totalLosses++;
  }
  if (user.balance < 0) {
    user.balance = 0;
    user.bankruptcies++;
  }
  await userDB.updateUser(user);

  const betLabel =
    bet.kind === "color" ? colorLabel(bet.value) : `Numéro ${bet.value}`;
  const resultLine = win
    ? `Gagné ! Tu remportes **$${payout.toLocaleString("fr-FR")}** (x${multiplier})`
    : `Perdu. Tu as perdu **$${amount.toLocaleString("fr-FR")}**`;

  const resultContainer = new ContainerBuilder()
    .addTextDisplayComponents((t) =>
      t.setContent(
        `**Roulette — ${result} (${colorLabel(color)})**\n` +
          `Pari : **${betLabel}** — Mise : **$${amount.toLocaleString("fr-FR")}**\n` +
          `${resultLine}\n` +
          `Nouveau solde : **$${user.balance.toLocaleString("fr-FR")}**`,
      ),
    )
    .addMediaGalleryComponents((g) =>
      g.addItems((i) => i.setURL("attachment://roulette.gif")),
    );

  try {
    if (hybrid.isSlash) {
      await (hybrid.source as any).editReply({
        components: [resultContainer],
        flags: MessageFlags.IsComponentsV2,
        files: [{ attachment: "./Images/roulette.gif", name: "roulette.gif" }],
      });
    } else {
      await (msg as any).edit({
        components: [resultContainer],
        flags: MessageFlags.IsComponentsV2,
        files: [{ attachment: "./Images/roulette.gif", name: "roulette.gif" }],
      });
    }
  } catch {
    await hybrid.send(resultContainer, [
      { attachment: "./Images/roulette.gif", name: "roulette.gif" },
    ]);
  }
}
