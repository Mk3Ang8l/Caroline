// commande de collection de personnage lajout dune option pour suprimer
// les personnage est prevue

import {
  ContainerBuilder,
  SeparatorBuilder,
  SectionBuilder,
  ThumbnailBuilder,
  MessageFlags,
} from "discord.js";
import { UserDB } from "../Database/UserDB";
import { CharacterDB } from "../Database/CharacterDB";
import { HybridInteraction } from "../Utils/HybridInteraction";
import { CharacterRarity } from "../Database/types";

const RARITY_LABEL: Record<CharacterRarity, string> = {
  commune: "Commune",
  rare: "Rare",
  épique: "Epique",
  légendaire: "Legendaire",
};

export async function collectionCommand(
  hybrid: HybridInteraction,
  userDB: UserDB,
  characterDB: CharacterDB,
): Promise<void> {
  const targetUser = hybrid.getUser("user") ?? hybrid.user;
  const cards = await characterDB.getUserCollection(targetUser.id);

  if (cards.length === 0) {
    const c = new ContainerBuilder().addTextDisplayComponents((t) =>
      t.setContent(
        targetUser.id === hybrid.user.id
          ? "Ta collection est vide. Visite la boutique avec `!shop`."
          : `**${targetUser.username}** n'a aucun personnage dans sa collection.`,
      ),
    );
    await hybrid.send(c);
    return;
  }

  // Grouper par rareté
  const grouped: Record<CharacterRarity, typeof cards> = {
    légendaire: [],
    épique: [],
    rare: [],
    commune: [],
  };
  for (const card of cards) {
    if (card.character) grouped[card.character.rarity].push(card);
  }

  const sections: string[] = [];
  for (const rarity of [
    "légendaire",
    "épique",
    "rare",
    "commune",
  ] as CharacterRarity[]) {
    const group = grouped[rarity];
    if (group.length === 0) continue;
    const lines = group
      .map(
        (card) =>
          `- **${card.character!.name}** *(${card.character!.series})* — Carte \`#${card.cardId}\``,
      )
      .join("\n");
    sections.push(`### ${RARITY_LABEL[rarity]}\n${lines}`);
  }

  const totalValue = cards.reduce(
    (sum, c) => sum + (c.character?.basePrice ?? 0),
    0,
  );
  const owner =
    targetUser.id === hybrid.user.id
      ? "Ta collection"
      : `Collection de ${targetUser.username}`;

  const container = new ContainerBuilder()
    .addSectionComponents((section) =>
      section
        .addTextDisplayComponents((t) =>
          t.setContent(
            `## ${owner}\n` +
              `**${cards.length} carte(s)** — Valeur estimee : **$${totalValue.toLocaleString("fr-FR")}**`,
          ),
        )
        .setThumbnailAccessory((thumbnail) =>
          thumbnail.setURL(
            `https://images.weserv.nl/?url=${encodeURIComponent(targetUser.displayAvatarURL({ size: 64 }))}`,
          ),
        ),
    )
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents((t) => t.setContent(sections.join("\n\n")));

  await hybrid.send(container);
}
