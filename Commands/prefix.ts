import { ContainerBuilder } from "discord.js";
import { UserDB } from "../Database/UserDB";
import { HybridInteraction } from "../Utils/HybridInteraction";
import { getConfig } from "../Utils/ConfigLoader";

const config = getConfig();
const OWNER_ID = config.bot.owner_id;

export async function prefixCommand(
  hybrid: HybridInteraction,
  userDB: UserDB,
): Promise<void> {
  if (hybrid.user.id !== OWNER_ID) {
    const c = new ContainerBuilder().addTextDisplayComponents((t) =>
      t.setContent("❌ Seul le propriétaire du bot peut changer le préfixe."),
    );
    await hybrid.send(c);
    return;
  }

  let newPrefix: string | undefined;

  if (hybrid.isSlash) {
    newPrefix = (hybrid.source as any).options.getString("new_prefix");
  } else {
    newPrefix = hybrid.prefixArgs[0];
  }

  if (!newPrefix || newPrefix.length > 5) {
    const c = new ContainerBuilder().addTextDisplayComponents((t) =>
      t.setContent("❌ Le préfixe doit faire entre 1 et 5 caractères."),
    );
    await hybrid.send(c);
    return;
  }

  await userDB.setPrefix(newPrefix);

  const c = new ContainerBuilder().addTextDisplayComponents((t) =>
    t.setContent(` Le préfixe du bot a été changé en : \`${newPrefix}\``),
  );
  await hybrid.send(c);
}
