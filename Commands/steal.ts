// commande de vol

import { ContainerBuilder } from "discord.js";
import { UserDB } from "../Database/UserDB";
import { HybridInteraction } from "../Utils/HybridInteraction";
import { getConfig } from "../Utils/ConfigLoader";

const config = getConfig();
const STEAL_COOLDOWN = config.steal.cooldown_hours * 60 * 60 * 1000;
const SUCCESS_CHANCE = config.steal.success_chance;

export async function stealCommand(
  hybrid: HybridInteraction,
  userDB: UserDB,
): Promise<void> {
  const stealer = await userDB.getUserOrCreate(
    hybrid.user.id,
    hybrid.user.username,
  );
  const targetUser = hybrid.getUser("user");

  if (!targetUser) {
    const c = new ContainerBuilder().addTextDisplayComponents((t) =>
      t.setContent("❌ Tu dois mentionner une victime ! `!steal @user`"),
    );
    await hybrid.send(c);
    return;
  }

  if (targetUser.id === hybrid.user.id) {
    const c = new ContainerBuilder().addTextDisplayComponents((t) =>
      t.setContent(
        "❌ Tu ne peux pas te voler toi-même... essaie de travailler plutôt !",
      ),
    );
    await hybrid.send(c);
    return;
  }

  if (targetUser.bot) {
    const c = new ContainerBuilder().addTextDisplayComponents((t) =>
      t.setContent("❌ Les bots n'ont pas de poches, tu ne trouveras rien."),
    );
    await hybrid.send(c);
    return;
  }

  // Vérification du cooldown
  const now = Date.now();
  if (stealer.lastSteal && now - stealer.lastSteal < STEAL_COOLDOWN) {
    const remaining = STEAL_COOLDOWN - (now - stealer.lastSteal);
    const hours = Math.floor(remaining / (60 * 60 * 1000));
    const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
    const c = new ContainerBuilder().addTextDisplayComponents((t) =>
      t.setContent(
        `Trop de risques pour l'instant ! Reviens dans **${hours}h ${minutes}m** pour un autre casse.`,
      ),
    );
    await hybrid.send(c);
    return;
  }

  const victim = await userDB.getUserOrCreate(
    targetUser.id,
    targetUser.username,
  );

  if (victim.balance < 100) {
    const c = new ContainerBuilder().addTextDisplayComponents((t) =>
      t.setContent(
        `❌ <@${targetUser.id}> est trop pauvre en liquide, ça n'en vaut pas la peine.`,
      ),
    );
    await hybrid.send(c);
    return;
  }

  stealer.lastSteal = now;
  const success = Math.random() < SUCCESS_CHANCE;

  if (success) {
    const percentage = 0.1 + Math.random() * 0.15;
    const stolenAmount = Math.floor(victim.balance * percentage);

    victim.balance -= stolenAmount;
    stealer.balance += stolenAmount;

    await userDB.updateUser(victim);
    await userDB.updateUser(stealer);

    const c = new ContainerBuilder().addTextDisplayComponents((t) =>
      t.setContent(
        `🥷 **Casse réussi !**\n\n` +
          `Tu as fait les poches de <@${targetUser.id}> et tu as trouvé **$${stolenAmount.toLocaleString("fr-FR")}** !\n` +
          `Tout cet argent était en liquide, rien n'a été touché à sa banque.`,
      ),
    );
    await hybrid.send(c);
  } else {
    const penalty = Math.floor(stealer.balance * 0.05);
    stealer.balance = Math.max(0, stealer.balance - penalty);
    await userDB.updateUser(stealer);

    const c = new ContainerBuilder().addTextDisplayComponents((t) =>
      t.setContent(
        `**Alerte !**\n\n` +
          `Tu t'es fait repérer en essayant de voler <@${targetUser.id}> !\n` +
          `Tu as dû abandonner **$${penalty.toLocaleString("fr-FR")}** pour t'échapper sans finir en prison.`,
      ),
    );
    await hybrid.send(c);
  }
}
