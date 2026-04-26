export class Logger {
  private static get timestamp(): string {
    return new Date().toLocaleString('fr-FR');
  }

  static info(message: string, context?: string) {
    console.log(`[${this.timestamp}] [INFO] ${context ? `[${context}] ` : ''}${message}`);
  }

  static warn(message: string, context?: string) {
    console.warn(`[${this.timestamp}] [WARN] ${context ? `[${context}] ` : ''}${message}`);
  }

  static error(message: string, error?: any, context?: string) {
    console.error(`[${this.timestamp}] [ERROR] ${context ? `[${context}] ` : ''}${message}`);
    if (error) console.error(error);
  }

  static debug(message: string, context?: string) {
    if (process.env.DEBUG === 'true') {
      console.log(`[${this.timestamp}] [DEBUG] ${context ? `[${context}] ` : ''}${message}`);
    }
  }
}
