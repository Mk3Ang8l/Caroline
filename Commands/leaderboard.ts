// commande du classement des joueurs

import { ContainerBuilder, SeparatorBuilder } from "discord.js";
import { UserDB } from "../Database/UserDB";
import { HybridInteraction } from "../Utils/HybridInteraction";

export async function leaderboardCommand(
  hybrid: HybridInteraction,
  userDB: UserDB,
): Promise<void> {
  const allUsers = await userDB.getAllUsers();
  const top10 = allUsers.sort((a, b) => b.balance - a.balance).slice(0, 10);

  const rows = top10
    .map((u, i) => {
      const medal =
        i === 0 ? "1." : i === 1 ? "2." : i === 2 ? "3." : `${i + 1}.`;
      return `**${medal}** **${u.username}** — $${u.balance.toLocaleString("fr-FR")}`;
    })
    .join("\n");

  const container = new ContainerBuilder()
    .addTextDisplayComponents((textDisplay) =>
      textDisplay.setContent("## Classement des richesses"),
    )
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents((textDisplay) =>
      textDisplay.setContent(rows || "_Aucun joueur enregistré._"),
    );

  await hybrid.send(container);
}
