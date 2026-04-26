// commande d'aide

import { ContainerBuilder, SeparatorBuilder } from "discord.js";
import { UserDB } from "../Database/UserDB";
import { HybridInteraction } from "../Utils/HybridInteraction";

export async function helpCommand(
  hybrid: HybridInteraction,
  userDB: UserDB,
): Promise<void> {
  const prefix = await userDB.getPrefix();

  const container = new ContainerBuilder()
    .addTextDisplayComponents((textDisplay) =>
      textDisplay.setContent(
        `## Aide de Caroline\nToutes les commandes fonctionnent en **Slash** (\`/\`) et en **Préfixe** (\`${prefix}\`).`,
      ),
    )
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents((textDisplay) =>
      textDisplay.setContent(
        `### 👤 Profil & Economie\n` +
          `**profile** \`[@user]\` — Ton profil (alias : \`p\`, \`prof\`)\n` +
          `**leaderboard** — Top 10 des plus riches\n` +
          `**daily** — Récompense quotidienne\n` +
          `**work** — Travailler (cooldown 1h)\n` +
          `**pay** \`@user <montant>\` — Envoyer de l'argent\n` +
          `**steal** \`@user\` — Voler du cash (cooldown 10h)\n` +
          `**bank** — Gérer ton compte bancaire (alias : \`b\`, \`banque\`)`
      ),
    )
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents((textDisplay) =>
      textDisplay.setContent(
        `### 🎴 Personnages & Collection\n` +
          `**summon** \`[nom]\` — Invoquer un personnage (ex: \`${prefix}summon saitama\`)\n` +
          `**collection** \`[@user]\` — Voir tes personnages (alias : \`c\`, \`col\`)\n` +
          `**trade** \`<nom> <offre>\` — Proposer un achat (alias : \`t\`)`
      ),
    )
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents((textDisplay) =>
      textDisplay.setContent(
        `### 🎰 Jeux & Gambling\n` +
          `**roulette** \`<rouge|noir|vert|0-36> <mise>\` — Roulette casino (alias : \`r\`)\n` +
          `**russeroulette** \`<mise>\` — Roulette russe (alias : \`rr\`)\n` +
          `**diceroll** \`<pair|impair> <mise>\` — Dé x1.5 (alias : \`d\`, \`dice\`)`
      ),
    )
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents((textDisplay) =>
      textDisplay.setContent(
        `### 🛠️ Administration\n` +
          `**give** \`@user <montant>\` — Donner de l'argent (Banquier uniquement)\n` +
          `**prefix** \`<nouveau>\` — Changer le préfixe (Owner uniquement)`
      ),
    );

  await hybrid.send(container);
}
