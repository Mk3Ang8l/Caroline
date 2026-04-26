import { ContainerBuilder, MediaGalleryBuilder } from "discord.js";
import { UserDB } from "../Database/UserDB";
import { HybridInteraction } from "../Utils/HybridInteraction";

export async function payCommand(
  hybrid: HybridInteraction,
  userDB: UserDB,
): Promise<void> {
  const targetUser = hybrid.getUser("user", true);
  const amount = hybrid.getInteger("amount", true);

  if (targetUser.id === hybrid.user.id) {
    const container = new ContainerBuilder().addTextDisplayComponents(
      (textDisplay) =>
        textDisplay.setContent("Tu ne peux pas te payer toi-même."),
    );
    await hybrid.send(container);
    return;
  }

  if (amount <= 0) {
    const container = new ContainerBuilder().addTextDisplayComponents(
      (textDisplay) =>
        textDisplay.setContent("Le montant doit être positif."),
    );
    await hybrid.send(container);
    return;
  }

  const sender = await userDB.getUserOrCreate(hybrid.user.id, hybrid.user.username);

  if (sender.balance < amount) {
    const container = new ContainerBuilder().addTextDisplayComponents(
      (textDisplay) =>
        textDisplay.setContent(
          `Solde insuffisant. Tu as **$${sender.balance.toLocaleString("fr-FR")}** et essaies d'envoyer **$${amount.toLocaleString("fr-FR")}**.`,
        ),
    );
    await hybrid.send(container);
    return;
  }

  const receiver = await userDB.getUserOrCreate(targetUser.id, targetUser.username);

  sender.balance -= amount;
  receiver.balance += amount;

  await userDB.updateUser(sender);
  await userDB.updateUser(receiver);

  const container = new ContainerBuilder()
    .addTextDisplayComponents(
      (textDisplay) =>
        textDisplay.setContent(
          `Tu as envoyé **$${amount.toLocaleString("fr-FR")}** à **${targetUser.username}** !\nTon nouveau solde : **$${sender.balance.toLocaleString("fr-FR")}**`,
        ),
    )
    .addMediaGalleryComponents((gallery) =>
      gallery.addItems((item) => item.setURL("attachment://addmoney.gif")),
    );

  await hybrid.send(container, [{ attachment: "./Images/addmoney.gif", name: "addmoney.gif" }]);
}
