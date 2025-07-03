import dotenv from 'dotenv';
import { BotConfig } from '../types';

dotenv.config();

export const config: BotConfig = {
  telegramToken: process.env.TELEGRAM_BOT_TOKEN || '',
  sqdApiUrl: process.env.SQD_API_URL || 'https://portal.sqd.dev/datasets/solana-mainnet',
  whaleThreshold: parseFloat(process.env.WHALE_THRESHOLD || '50000'),
  whaleThresholdType: (process.env.WHALE_THRESHOLD_TYPE as 'SOL' | 'USD') || 'USD',
  enableAlerts: process.env.ENABLE_ALERTS?.toLowerCase() === 'true',
  alertCooldownMinutes: parseInt(process.env.ALERT_COOLDOWN_MINUTES || '5', 10),
  defaultPollingIntervalSeconds: parseInt(process.env.DEFAULT_POLLING_INTERVAL_SECONDS || '15', 10),
};

export function validateConfig(): void {
  if (!config.telegramToken) {
    throw new Error('TELEGRAM_BOT_TOKEN is required in environment variables');
  }
  
  if (config.whaleThreshold <= 0) {
    throw new Error('WHALE_THRESHOLD must be a positive number');
  }
  
  if (config.alertCooldownMinutes < 0) {
    throw new Error('ALERT_COOLDOWN_MINUTES must be non-negative');
  }
  
  if (config.defaultPollingIntervalSeconds < 1 || config.defaultPollingIntervalSeconds > 300) {
    throw new Error('DEFAULT_POLLING_INTERVAL_SECONDS must be between 1 and 300 seconds');
  }
}