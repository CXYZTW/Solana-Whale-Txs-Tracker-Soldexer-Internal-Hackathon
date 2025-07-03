export const LAMPORTS_PER_SOL = 1_000_000_000;

export const MESSAGES = {
  WELCOME: `🐋 Welcome to Solana Whale Tracker Bot!

I monitor large SOL transfers on the Solana blockchain in real-time.

Available commands:
/start - Start the bot
/stats - View whale statistics
/threshold - Check current whale threshold
/setthreshold <amount> - Set whale threshold (admin only)
/alerts - Toggle alerts on/off
/help - Show this help message`,
  
  STATS_HEADER: '📊 *Whale Statistics*\n',
  NO_STATS: 'No whale transactions recorded yet.',
  ALERTS_ENABLED: '🔔 Alerts are now *enabled*',
  ALERTS_DISABLED: '🔕 Alerts are now *disabled*',
  THRESHOLD_SET: '✅ Whale threshold set to *{threshold} SOL*',
  THRESHOLD_CURRENT: '🎯 Current whale threshold: *{threshold} SOL*',
  ERROR_INVALID_THRESHOLD: '❌ Invalid threshold. Please provide a positive number.',
  ERROR_ADMIN_ONLY: '❌ This command is for administrators only.',
};

export const EMOJI = {
  WHALE: '🐋',
  MONEY: '💰',
  ARROW: '➡️',
  CHART: '📈',
  ALERT: '🚨',
  INFO: 'ℹ️',
};