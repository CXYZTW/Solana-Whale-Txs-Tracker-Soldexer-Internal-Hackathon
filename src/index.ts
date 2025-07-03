import { SQDApiClient } from './services/sqdApi';
import { WhaleDetector } from './services/whaleDetector';
import { TelegramBot } from './bot/telegramBot';
import { config, validateConfig } from './utils/config';
import { startHealthServer } from './server';

async function main() {
  try {
    validateConfig();
    
    console.log('Starting Solana Whale Tracker Bot...');
    
    // Start health server for Railway
    startHealthServer();
    console.log(`Default whale threshold: ${config.whaleThresholdType === 'USD' ? '$' + config.whaleThreshold.toLocaleString() : config.whaleThreshold + ' SOL'}`);
    console.log(`Default refresh interval: ${config.defaultPollingIntervalSeconds} seconds`);
    console.log(`Telegram token configured: ${config.telegramToken ? 'Yes' : 'No'}`);
    
    const sqdClient = new SQDApiClient(config.sqdApiUrl);
    const whaleDetector = new WhaleDetector(config.whaleThreshold);
    const telegramBot = new TelegramBot(config.telegramToken, whaleDetector);
    
    sqdClient.on('balanceChange', (event) => {
      whaleDetector.processBalanceChange(event);
    });
    
    sqdClient.on('error', (error) => {
      console.error('SQD API Error:', error);
    });
    
    sqdClient.on('streamEnd', () => {
      console.log('Stream ended, will reconnect...');
    });
    
    
    console.log('Starting Telegram bot...');
    await telegramBot.start();
    
    console.log('Fetching SQD API metadata...');
    const metadata = await sqdClient.getMetadata();
    console.log('Dataset info:', {
      dataset: metadata.dataset,
      startBlock: metadata.start_block,
      realTime: metadata.real_time
    });
    
    console.log('Fetching latest block...');
    const latestBlock = await sqdClient.getLatestBlock();
    console.log(`Latest block: ${latestBlock.number}`);
    
    console.log(`Starting 15-second polling from block ${latestBlock.number}`);
    sqdClient.startPolling(latestBlock.number).catch((error) => {
      console.error('Polling error:', error);
    });
    
    console.log('Bot is running. Press Ctrl+C to stop.');
    
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

async function shutdown() {
  console.log('\nShutting down gracefully...');
  process.exit(0);
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the application
main().catch((error) => {
  console.error('Failed to start:', error);
  process.exit(1);
});