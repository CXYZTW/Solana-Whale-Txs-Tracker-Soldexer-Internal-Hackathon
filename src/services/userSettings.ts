import { UserSettings } from '../types';
import { config } from '../utils/config';

export class UserSettingsService {
  private userSettings: Map<number, UserSettings> = new Map();

  constructor() {
    // Default settings for all users
    this.defaultSettings = {
      threshold: config.whaleThreshold,
      thresholdType: config.whaleThresholdType,
      alertsEnabled: true,
      pollingIntervalSeconds: config.defaultPollingIntervalSeconds
    };
  }

  private defaultSettings: Omit<UserSettings, 'userId'>;

  getUserSettings(userId: number): UserSettings {
    const settings = this.userSettings.get(userId);
    if (!settings) {
      const newSettings: UserSettings = {
        userId,
        ...this.defaultSettings
      };
      this.userSettings.set(userId, newSettings);
      return newSettings;
    }
    return settings;
  }

  setThreshold(userId: number, threshold: number, type: 'SOL' | 'USD'): UserSettings {
    const settings = this.getUserSettings(userId);
    settings.threshold = threshold;
    settings.thresholdType = type;
    this.userSettings.set(userId, settings);
    return settings;
  }

  setPollingInterval(userId: number, intervalSeconds: number): UserSettings {
    if (intervalSeconds < 1 || intervalSeconds > 300) {
      throw new Error('Refresh interval must be between 1 and 300 seconds');
    }
    
    const settings = this.getUserSettings(userId);
    settings.pollingIntervalSeconds = intervalSeconds;
    this.userSettings.set(userId, settings);
    return settings;
  }

  toggleAlerts(userId: number): boolean {
    const settings = this.getUserSettings(userId);
    settings.alertsEnabled = !settings.alertsEnabled;
    this.userSettings.set(userId, settings);
    return settings.alertsEnabled;
  }

  getAllActiveUsers(): number[] {
    return Array.from(this.userSettings.entries())
      .filter(([_, settings]) => settings.alertsEnabled)
      .map(([userId, _]) => userId);
  }

  isWhaleTransaction(userId: number, amountSol: number, solPrice: number): boolean {
    const settings = this.getUserSettings(userId);
    
    if (settings.thresholdType === 'SOL') {
      return amountSol >= settings.threshold;
    } else {
      // USD threshold
      const amountUsd = amountSol * solPrice;
      return amountUsd >= settings.threshold;
    }
  }

  formatThreshold(userId: number): string {
    const settings = this.getUserSettings(userId);
    if (settings.thresholdType === 'SOL') {
      return `${settings.threshold} SOL`;
    } else {
      return `$${settings.threshold.toLocaleString()} USD`;
    }
  }

  getPollingInterval(userId: number): number {
    const settings = this.getUserSettings(userId);
    return settings.pollingIntervalSeconds;
  }

  getOptimalPollingInterval(): number {
    if (this.userSettings.size === 0) {
      return config.defaultPollingIntervalSeconds;
    }
    
    const intervals = Array.from(this.userSettings.values())
      .filter(settings => settings.alertsEnabled)
      .map(settings => settings.pollingIntervalSeconds);
    
    if (intervals.length === 0) {
      return config.defaultPollingIntervalSeconds;
    }
    
    return Math.min(...intervals);
  }
}

export const userSettingsService = new UserSettingsService();