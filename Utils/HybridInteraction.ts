import {
  ChatInputCommandInteraction,
  Message,
  ContainerBuilder,
  MessageFlags,
  User,
} from "discord.js";

export type HybridSource = ChatInputCommandInteraction | Message;

export class HybridInteraction {
  public readonly source: HybridSource;
  public readonly isSlash: boolean;
  public readonly user: User;
  public readonly prefixArgs: string[];

  constructor(source: HybridSource, prefixArgs: string[] = []) {
    this.source = source;
    this.isSlash = source instanceof ChatInputCommandInteraction;
    this.prefixArgs = prefixArgs;
    this.user = this.isSlash
      ? (source as ChatInputCommandInteraction).user
      : (source as Message).author;
  }

  getUser(name: string, required: true): User;
  getUser(name: string, required?: false): User | null;
  getUser(name: string, required = false): User | null {
    if (this.isSlash) {
      return (this.source as ChatInputCommandInteraction).options.getUser(
        name,
        required as any,
      );
    }
    const msg = this.source as Message;
    const mentioned = msg.mentions.users.first() ?? null;
    if (!mentioned && required) throw new Error("Argument utilisateur manquant.");
    return mentioned;
  }

  getInteger(name: string, required: true): number;
  getInteger(name: string, required?: false): number | null;
  getInteger(name: string, required = false): number | null {
    if (this.isSlash) {
      return (this.source as ChatInputCommandInteraction).options.getInteger(
        name,
        required as any,
      );
    }
    for (const arg of this.prefixArgs) {
      const n = parseInt(arg, 10);
      if (!isNaN(n)) return n;
    }
    if (required) throw new Error("Argument numérique manquant.");
    return null;
  }

  async send(container: ContainerBuilder, files: any[] = [], rows: any[] = []): Promise<Message> {
    const components = [container, ...rows];
    if (this.isSlash) {
      return (await (this.source as ChatInputCommandInteraction).editReply({
        components,
        flags: MessageFlags.IsComponentsV2,
        files,
      })) as Message;
    } else {
      return await (this.source as Message).reply({
        components,
        flags: MessageFlags.IsComponentsV2,
        files,
      });
    }
  }
}
