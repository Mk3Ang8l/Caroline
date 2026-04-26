import { DiscordAPIError, RESTJSONErrorCodes } from 'discord.js';
import { Logger } from './Logger';

export class ErrorHandler {
  static handle(error: any, context: string) {
    if (error instanceof DiscordAPIError) {
      switch (error.code) {
        case RESTJSONErrorCodes.MissingPermissions:
          Logger.error("Le bot manque de permissions pour effectuer cette action.", undefined, context);
          break;
        case RESTJSONErrorCodes.UnknownChannel:
          Logger.error("Le canal est inconnu ou a été supprimé.", undefined, context);
          break;
        case RESTJSONErrorCodes.CannotSendMessagesToThisUser:
          Logger.error("Impossible d'envoyer des messages à cet utilisateur (DMs fermés ou aucun serveur commun).", undefined, context);
          break;
        case RESTJSONErrorCodes.MissingAccess:
          Logger.error("Le bot n'a pas accès à ce canal.", undefined, context);
          break;
        default:
          Logger.error(`Erreur API Discord (${error.code}): ${error.message}`, undefined, context);
      }
    } else {
      Logger.error(`Erreur inattendue: ${error.message || error}`, error, context);
    }
  }
}
