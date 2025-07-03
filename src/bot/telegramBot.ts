import { Telegraf, Context } from 'telegraf';
import { WhaleDetector } from '../services/whaleDetector';
import { WhaleTransaction } from '../types';
import { formatWhaleAlert, formatStats } from '../utils/formatter';
import { config } from '../utils/config';
import { userSettingsService } from '../services/userSettings';
import { priceService } from '../services/priceService';
import { resourceMonitor } from '../services/resourceMonitor';

export class TelegramBot {
  private bot: Telegraf;
  private whaleDetector: WhaleDetector;
  private alertsEnabled: boolean = true;
  private subscribedChats: Set<number> = new Set();
  private adminIds: Set<number> = new Set();
  private sentAlerts: Set<string> = new Set();

  constructor(token: string, whaleDetector: WhaleDetector) {
    this.bot = new Telegraf(token);
    this.whaleDetector = whaleDetector;
    
    this.setupCommands();
    this.setupWhaleListener();
  }

  private setupCommands() {
    this.bot.command('start', (ctx) => this.handleStart(ctx));
    this.bot.command('quick5', (ctx) => this.handleQuickSetup(ctx, 5000, 'USD'));
    this.bot.command('quick25', (ctx) => this.handleQuickSetup(ctx, 25000, 'USD'));
    this.bot.command('quick100', (ctx) => this.handleQuickSetup(ctx, 100000, 'USD'));
    this.bot.command('stats', (ctx) => this.handleStats(ctx));
    this.bot.command('threshold', (ctx) => this.handleThreshold(ctx));
    this.bot.command('setthreshold', (ctx) => this.handleSetThreshold(ctx));
    this.bot.command('setsol', (ctx) => this.handleSetSolThreshold(ctx));
    this.bot.command('setusd', (ctx) => this.handleSetUsdThreshold(ctx));
    this.bot.command('refresh', (ctx) => this.handleRefreshInterval(ctx));
    this.bot.command('setrefresh', (ctx) => this.handleSetRefreshInterval(ctx));
    this.bot.command('alerts', (ctx) => this.handleAlerts(ctx));
    this.bot.command('stop', (ctx) => this.handleStop(ctx));
    this.bot.command('reset', (ctx) => this.handleReset(ctx));
    this.bot.command('usage', (ctx) => this.handleUsage(ctx));
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
    const userId = ctx.from?.id;
    
    if (chatId) {
      this.subscribedChats.add(chatId);
      
      if (userId && this.isAdmin(userId)) {
        this.adminIds.add(userId);
      }
    }
    
    if (!userId) {
      await ctx.reply('Unable to identify user.');
      return;
    }
    
    // Check if user is new (using default settings)
    const settings = userSettingsService.getUserSettings(userId);
    const isNewUser = settings.threshold === config.whaleThreshold && settings.thresholdType === config.whaleThresholdType;
    
    if (isNewUser) {
      await this.handleNewUserOnboarding(ctx, userId);
    } else {
      await this.handleReturningUser(ctx, userId);
    }
  }
  
  private async handleNewUserOnboarding(ctx: Context, _userId: number) {
    const welcomeMessage = `🐋 **Welcome to Solana Whale Tracker!**

💰 I'll alert you when large SOL transactions happen on the blockchain.

**Quick Setup** (choose one):

🔥 /quick5 - Get alerts for $5,000+ transactions (active)
💪 /quick25 - Get alerts for $25,000+ transactions (balanced)
🐋 /quick100 - Get alerts for $100,000+ transactions (whales only)

Or customize manually:
• /setusd <amount> - Set your own USD threshold
• /setsol <amount> - Set your own SOL threshold

🚀 **Choose a quick option above to start immediately!**`;
    
    await ctx.reply(welcomeMessage, { parse_mode: 'Markdown' });
  }
  
  private async handleReturningUser(ctx: Context, userId: number) {
    const settings = userSettingsService.getUserSettings(userId);
    const thresholdStr = userSettingsService.formatThreshold(userId);
    const refreshInterval = userSettingsService.getPollingInterval(userId);
    
    const welcomeBackMessage = `🐋 **Welcome back!**

✅ **Your current settings:**
🎯 Threshold: ${thresholdStr}
⏱️ Updates: Every ${refreshInterval} seconds
🔔 Alerts: ${settings.alertsEnabled ? 'ON' : 'OFF'}

📊 Use /stats to see recent whale activity
⚙️ Use /help for all commands`;
    
    await ctx.reply(welcomeBackMessage, { parse_mode: 'Markdown' });
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
  
  private async handleRefreshInterval(ctx: Context) {
    const userId = ctx.from?.id;
    if (!userId) {
      await ctx.reply('Unable to identify user.');
      return;
    }
    
    const currentInterval = userSettingsService.getPollingInterval(userId);
    const optimalInterval = userSettingsService.getOptimalPollingInterval();
    
    const message = `⏱️ **Your refresh speed:** Every ${currentInterval} seconds\n\n` +
      `🏃 **Current bot speed:** Every ${optimalInterval} seconds (fastest user setting)\n\n` +
      `Use /setrefresh <seconds> to change how often you want updates (1-300s)`;
    
    await ctx.reply(message, { parse_mode: 'Markdown' });
  }
  
  private async handleSetRefreshInterval(ctx: Context) {
    const userId = ctx.from?.id;
    if (!userId) {
      await ctx.reply('Unable to identify user.');
      return;
    }

    const text = ctx.message && 'text' in ctx.message ? ctx.message.text : '';
    const parts = text.split(' ');
    
    if (parts.length !== 2) {
      await ctx.reply('❌ Usage: `/setrefresh <seconds>`\nExample: `/setrefresh 5`', { parse_mode: 'Markdown' });
      return;
    }

    const newInterval = parseInt(parts[1]);
    if (isNaN(newInterval) || newInterval < 1 || newInterval > 300) {
      await ctx.reply('❌ Please provide a number between 1 and 300 seconds.');
      return;
    }

    try {
      userSettingsService.setPollingInterval(userId, newInterval);
      await ctx.reply(
        `✅ Refresh speed set to **every ${newInterval} seconds**\n\n` +
        `⚡ Faster = more up-to-date alerts\n` +
        `🐌 Slower = less frequent checks`,
        { parse_mode: 'Markdown' }
      );
    } catch (error) {
      await ctx.reply('❌ ' + (error as Error).message);
    }
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
  
  private async handleStop(ctx: Context) {
    const userId = ctx.from?.id;
    if (!userId) {
      await ctx.reply('Unable to identify user.');
      return;
    }
    
    userSettingsService.toggleAlerts(userId, false);
    
    const message = `🛑 **Alerts Stopped**\n\nYou will no longer receive whale transaction alerts.\n\n💡 To resume: /alerts\n📊 View stats: /stats\n🔧 Change settings: /help`;
    await ctx.reply(message, { parse_mode: 'Markdown' });
  }
  
  private async handleReset(ctx: Context) {
    const userId = ctx.from?.id;
    if (!userId) {
      await ctx.reply('Unable to identify user.');
      return;
    }
    
    // Reset user to default settings
    userSettingsService.resetUserSettings(userId);
    
    const message = `🔄 **Settings Reset**\n\nYour settings have been reset to defaults:\n\n🎯 Threshold: $50,000 USD\n⏱️ Refresh: 15 seconds\n🔔 Alerts: Enabled\n\n🚀 Use quick setup commands to get started:\n• /quick5 - $5,000+ alerts\n• /quick25 - $25,000+ alerts\n• /quick100 - $100,000+ alerts`;
    await ctx.reply(message, { parse_mode: 'Markdown' });
  }

  private async handleUsage(ctx: Context) {
    const userId = ctx.from?.id;
    if (!userId || !this.isAdmin(userId)) {
      await ctx.reply('❌ This command is only available to administrators.');
      return;
    }
    
    const metrics = resourceMonitor.getMetrics();
    const priceMetrics = priceService.getResourceMetrics();
    
    const usageText = `📊 **Resource Usage Report**

🔧 **System Performance**
• API Calls: ${metrics.apiCallsPerMinute}/min
• Memory Usage: ${metrics.memoryUsageMB}MB
• Active Users: ${metrics.activeUsers}
• Whale Transactions: ${metrics.whaleTransactions}
• Uptime: ${Math.floor(metrics.uptime / 60)} minutes

💰 **Price Service**
• Total Fetches: ${priceMetrics.fetchCount}
• Cache Age: ${priceMetrics.cacheAge ? Math.floor(priceMetrics.cacheAge / 1000) : 'N/A'}s

⚠️ **Status**
• High Resource Usage: ${resourceMonitor.isResourceUsageHigh() ? 'YES' : 'NO'}
• Throttling Active: ${resourceMonitor.shouldThrottle() ? 'YES' : 'NO'}`;
    
    await ctx.reply(usageText, { parse_mode: 'Markdown' });
  }
  
  private async handleHelp(ctx: Context) {
    const helpText = `
🐋 **Solana Whale Tracker Bot**

**Available Commands:**

🎯 **Threshold Settings**
• /threshold - View your current whale threshold
• /setsol <amount> - Set threshold in SOL (e.g., /setsol 100)
• /setusd <amount> - Set threshold in USD (e.g., /setusd 15000)

⏱️ **Data Freshness**
• /refresh - View how often you get updates
• /setrefresh <seconds> - Set update speed (1-300s)

📊 **Information & Control**
• /stats - View whale statistics
• /alerts - Toggle alerts on/off
• /stop - Stop all alerts
• /reset - Reset to default settings
• /help - Show this help message

**Examples:**
🔹 /setsol 50 - Get alerts for transactions ≥ 50 SOL
🔹 /setusd 10000 - Get alerts for transactions ≥ $10,000
🔹 /setrefresh 5 - Get updates every 5 seconds (super fast)
`;
    
    await ctx.reply(helpText, { parse_mode: 'Markdown' });
  }
  
  private async handleQuickSetup(ctx: Context, amount: number, type: 'SOL' | 'USD') {
    const userId = ctx.from?.id;
    if (!userId) {
      await ctx.reply('Unable to identify user.');
      return;
    }

    try {
      userSettingsService.setThreshold(userId, amount, type);
      userSettingsService.setPollingInterval(userId, 15); // Set reasonable default
      
      const setupMessage = `✅ **Perfect! You're all set up!**

` +
        `💰 **Whale Alert Threshold:** $${amount.toLocaleString()} USD
` +
        `⏱️ **Update Speed:** Every 15 seconds
` +
        `🔔 **Alerts:** Enabled

` +
        `🚀 **You'll now receive alerts for transactions ≥ $${amount.toLocaleString()}**

` +
        `⚙️ Want to adjust? Use /setusd or /setrefresh
` +
        `📊 See activity with /stats`;
      
      await ctx.reply(setupMessage, { parse_mode: 'Markdown' });
    } catch (error) {
      await ctx.reply('❌ Setup failed: ' + (error as Error).message);
    }
  }

  private async broadcastWhaleAlert(whale: WhaleTransaction) {
    const alertKey = `${whale.signature}_${whale.blockHeight}`;
    
    // Prevent duplicate alerts
    if (this.sentAlerts.has(alertKey)) {
      console.log(`⏭️ Duplicate alert blocked: ${whale.signature}`);
      return;
    }
    this.sentAlerts.add(alertKey);
    
    // Clean old alerts (keep only last 1000)
    if (this.sentAlerts.size > 1000) {
      const alerts = Array.from(this.sentAlerts);
      alerts.slice(0, 500).forEach(key => this.sentAlerts.delete(key));
    }
    
    const solPrice = priceService.getSolPrice();
    const activeUsers = userSettingsService.getAllActiveUsers();
    
    console.log(`🚨 Broadcasting whale alert: ${whale.amountSol.toFixed(2)} SOL to ${activeUsers.length} users`);
    
    // Check each user's threshold settings
    for (const userId of activeUsers) {
      if (userSettingsService.isWhaleTransaction(userId, whale.amountSol, solPrice)) {
        const alert = formatWhaleAlert(whale);
        
        try {
          console.log(`📤 Sending alert to user ${userId}`);
          await this.bot.telegram.sendMessage(userId, alert, { 
            parse_mode: 'Markdown'
          });
          console.log(`✅ Alert sent to user ${userId}`);
        } catch (error) {
          console.error(`❌ Failed to send alert to user ${userId}:`, error);
        }
      } else {
        console.log(`⏭️ User ${userId} threshold not met for ${whale.amountSol.toFixed(2)} SOL`);
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