// commande de boulot basique

import { ContainerBuilder, MediaGalleryBuilder } from "discord.js";
import { UserDB } from "../Database/UserDB";
import { HybridInteraction } from "../Utils/HybridInteraction";

const WORK_COOLDOWN_MS = 60 * 60 * 1000;
const JOBS = [
  "développeur",
  "cuisinier",
  "chauffeur",
  "médecin",
  "détective",
  "pilote",
  "architecte",
  "avocat",
];

const workCooldowns = new Map<string, number>();

export async function workCommand(
  hybrid: HybridInteraction,
  userDB: UserDB,
): Promise<void> {
  const userId = hybrid.user.id;
  const now = Date.now();
  const last = workCooldowns.get(userId) ?? 0;
  const diff = now - last;

  if (diff < WORK_COOLDOWN_MS) {
    const remaining = WORK_COOLDOWN_MS - diff;
    const minutes = Math.ceil(remaining / 60_000);

    const container = new ContainerBuilder().addTextDisplayComponents(
      (textDisplay) =>
        textDisplay.setContent(
          `Tu es fatigué ! Reviens travailler dans **${minutes} minute(s)**.`,
        ),
    );
    await hybrid.send(container);
    return;
  }

  const earnings = Math.floor(Math.random() * 151) + 50;
  const job = JOBS[Math.floor(Math.random() * JOBS.length)];

  workCooldowns.set(userId, now);

  const user = await userDB.getUserOrCreate(
    hybrid.user.id,
    hybrid.user.username,
  );
  user.balance += earnings;
  await userDB.updateUser(user);

  const container = new ContainerBuilder()
    .addTextDisplayComponents((textDisplay) =>
      textDisplay.setContent(
        `Tu as travaillé comme **${job}** et gagné **$${earnings}** !\nSolde actuel : **$${user.balance.toLocaleString("fr-FR")}**`,
      ),
    )
    .addMediaGalleryComponents((gallery) =>
      gallery.addItems((item) => item.setURL("attachment://addmoney.gif")),
    );

  await hybrid.send(container, [
    { attachment: "./Images/addmoney.gif", name: "addmoney.gif" },
  ]);
}
