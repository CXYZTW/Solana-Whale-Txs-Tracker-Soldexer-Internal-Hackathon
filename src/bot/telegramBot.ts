import { Telegraf, Context } from 'telegraf';
import { WhaleDetector } from '../services/whaleDetector';
import { WhaleTransaction } from '../types';
import { formatWhaleAlert, formatStats } from '../utils/formatter';
import { MESSAGES } from '../utils/constants';
import { config } from '../utils/config';
import { userSettingsService } from '../services/userSettings';
import { priceService } from '../services/priceService';

export class TelegramBot {
  private bot: Telegraf;
  private whaleDetector: WhaleDetector;
  private alertsEnabled: boolean = true;
  private subscribedChats: Set<number> = new Set();
  private adminIds: Set<number> = new Set();

  constructor(token: string, whaleDetector: WhaleDetector) {
    this.bot = new Telegraf(token);
    this.whaleDetector = whaleDetector;
    
    this.setupCommands();
    this.setupWhaleListener();
  }

  private setupCommands() {
    this.bot.command('start', (ctx) => this.handleStart(ctx));
    this.bot.command('stats', (ctx) => this.handleStats(ctx));
    this.bot.command('threshold', (ctx) => this.handleThreshold(ctx));
    this.bot.command('setthreshold', (ctx) => this.handleSetThreshold(ctx));
    this.bot.command('setsol', (ctx) => this.handleSetSolThreshold(ctx));
    this.bot.command('setusd', (ctx) => this.handleSetUsdThreshold(ctx));
    this.bot.command('alerts', (ctx) => this.handleAlerts(ctx));
    this.bot.command('help', (ctx) => this.handleHelp(ctx));
    
    this.bot.on('text', (ctx) => {
      if (ctx.message.text && !ctx.message.text.startsWith('/')) {
        ctx.reply('Unknown command. Use /help to see available commands.');
      }
    });
  }

  private setupWhaleListener() {
    this.whaleDetector.on('whale', (whale: WhaleTransaction) => {
      if (this.alertsEnabled && config.enableAlerts) {
        this.broadcastWhaleAlert(whale);
      }
    });
  }

  private async handleStart(ctx: Context) {
    const chatId = ctx.chat?.id;
    if (chatId) {
      this.subscribedChats.add(chatId);
      
      // Check if user is admin (you can add your admin user IDs here)
      const userId = ctx.from?.id;
      if (userId && this.isAdmin(userId)) {
        this.adminIds.add(userId);
      }
    }
    
    await ctx.reply(MESSAGES.WELCOME, { parse_mode: 'Markdown' });
  }

  private async handleStats(ctx: Context) {
    const stats = this.whaleDetector.getStats();
    const formattedStats = formatStats(stats);
    await ctx.reply(formattedStats, { parse_mode: 'Markdown' });
  }

  private async handleThreshold(ctx: Context) {
    const userId = ctx.from?.id;
    if (!userId) {
      await ctx.reply('Unable to identify user.');
      return;
    }
    
    const settings = userSettingsService.getUserSettings(userId);
    const thresholdStr = userSettingsService.formatThreshold(userId);
    const solPrice = priceService.getSolPrice();
    
    let message = `🎯 Your current whale threshold: **${thresholdStr}**\n\n`;
    if (settings.thresholdType === 'SOL') {
      const usdEquivalent = settings.threshold * solPrice;
      message += `≈ $${usdEquivalent.toLocaleString()} USD at current price`;
    } else {
      const solEquivalent = settings.threshold / solPrice;
      message += `≈ ${solEquivalent.toFixed(2)} SOL at current price`;
    }
    
    await ctx.reply(message, { parse_mode: 'Markdown' });
  }

  private async handleSetThreshold(ctx: Context) {
    await ctx.reply(
      '⚠️ This command is deprecated. Please use:\n\n' +
      '• `/setsol <amount>` - Set threshold in SOL\n' +
      '• `/setusd <amount>` - Set threshold in USD\n\n' +
      'Example: `/setsol 100` or `/setusd 10000`',
      { parse_mode: 'Markdown' }
    );
  }
  
  private async handleSetSolThreshold(ctx: Context) {
    const userId = ctx.from?.id;
    if (!userId) {
      await ctx.reply('Unable to identify user.');
      return;
    }

    const text = ctx.message && 'text' in ctx.message ? ctx.message.text : '';
    const parts = text.split(' ');
    
    if (parts.length !== 2) {
      await ctx.reply('❌ Usage: `/setsol <amount>`\nExample: `/setsol 100`', { parse_mode: 'Markdown' });
      return;
    }

    const newThreshold = parseFloat(parts[1]);
    if (isNaN(newThreshold) || newThreshold <= 0) {
      await ctx.reply('❌ Please provide a valid positive number.');
      return;
    }

    userSettingsService.setThreshold(userId, newThreshold, 'SOL');
    await ctx.reply(
      `✅ Whale threshold set to **${newThreshold} SOL**\n\n` +
      `You'll receive alerts for transactions ≥ ${newThreshold} SOL`,
      { parse_mode: 'Markdown' }
    );
  }
  
  private async handleSetUsdThreshold(ctx: Context) {
    const userId = ctx.from?.id;
    if (!userId) {
      await ctx.reply('Unable to identify user.');
      return;
    }

    const text = ctx.message && 'text' in ctx.message ? ctx.message.text : '';
    const parts = text.split(' ');
    
    if (parts.length !== 2) {
      await ctx.reply('❌ Usage: `/setusd <amount>`\nExample: `/setusd 10000`', { parse_mode: 'Markdown' });
      return;
    }

    const newThreshold = parseFloat(parts[1]);
    if (isNaN(newThreshold) || newThreshold <= 0) {
      await ctx.reply('❌ Please provide a valid positive number.');
      return;
    }

    userSettingsService.setThreshold(userId, newThreshold, 'USD');
    await ctx.reply(
      `✅ Whale threshold set to **$${newThreshold.toLocaleString()} USD**\n\n` +
      `You'll receive alerts for transactions ≥ $${newThreshold.toLocaleString()} USD`,
      { parse_mode: 'Markdown' }
    );
  }

  private async handleAlerts(ctx: Context) {
    const userId = ctx.from?.id;
    if (!userId) {
      await ctx.reply('Unable to identify user.');
      return;
    }
    
    const enabled = userSettingsService.toggleAlerts(userId);
    const status = enabled ? 'enabled' : 'disabled';
    const message = `🔔 Whale alerts **${status}** for your account.`;
    await ctx.reply(message, { parse_mode: 'Markdown' });
  }

  private async handleHelp(ctx: Context) {
    const helpText = `
🐋 **Solana Whale Tracker Bot**

**Available Commands:**

🎯 **Threshold Settings**
• /threshold - View your current whale threshold
• /setsol <amount> - Set threshold in SOL (e.g., /setsol 100)
• /setusd <amount> - Set threshold in USD (e.g., /setusd 15000)

📊 **Information**
• /stats - View whale statistics
• /alerts - Toggle alerts on/off
• /help - Show this help message

**Examples:**
🔹 /setsol 50 - Get alerts for transactions ≥ 50 SOL
🔹 /setusd 10000 - Get alerts for transactions ≥ $10,000
`;
    
    await ctx.reply(helpText, { parse_mode: 'Markdown' });
  }

  private async broadcastWhaleAlert(whale: WhaleTransaction) {
    const solPrice = priceService.getSolPrice();
    const activeUsers = userSettingsService.getAllActiveUsers();
    
    // Check each user's threshold settings
    for (const userId of activeUsers) {
      if (userSettingsService.isWhaleTransaction(userId, whale.amountSol, solPrice)) {
        const alert = formatWhaleAlert(whale);
        
        try {
          await this.bot.telegram.sendMessage(userId, alert, { 
            parse_mode: 'Markdown'
          });
        } catch (error) {
          console.error(`Failed to send alert to user ${userId}:`, error);
        }
      }
    }
  }

  private isAdmin(userId: number): boolean {
    // Add your admin user IDs here
    const adminUserIds: number[] = [
      // Example: 123456789
    ];
    
    return adminUserIds.includes(userId) || this.adminIds.has(userId);
  }

  async start() {
    try {
      console.log('Launching Telegram bot...');
      
      // First, test the connection
      const me = await this.bot.telegram.getMe();
      console.log(`Bot connected as @${me.username}`);
      
      // Start polling without blocking
      this.bot.launch({
        allowedUpdates: [],
        dropPendingUpdates: true
      }).then(() => {
        console.log('Telegram bot polling started');
      }).catch((error) => {
        console.error('Telegram bot polling error:', error);
      });
      
      console.log('Telegram bot started successfully');
      
      // Don't add process handlers here - they're already in main
    } catch (error) {
      console.error('Failed to start Telegram bot:', error);
      throw error;
    }
  }

  async stop() {
    this.bot.stop();
    console.log('Telegram bot stopped');
  }
}