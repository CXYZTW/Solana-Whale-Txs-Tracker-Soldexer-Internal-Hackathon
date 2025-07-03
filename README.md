# Solana Whale Tracker Telegram Bot

A real-time Telegram bot that monitors and alerts users about large SOL transfers (whale transactions) on Solana.

## Features

- 🐋 Real-time whale transaction detection
- 💰 Support for both SOL and USD thresholds
- 👤 User-specific threshold settings
- 📊 Comprehensive whale statistics
- 🔔 Instant Telegram notifications
- 🔄 Automatic reconnection and error handling

## Prerequisites

- Node.js 18+ and npm
- Telegram Bot Token (get from [@BotFather](https://t.me/botfather))
- Access to Soldexer/Portal API

## Installation

1. Clone the repository:

```bash
git clone <repository-url>
cd tg-bot
```

2. Install dependencies:

```bash
npm install
```

3. Create `.env` file:

```bash
cp .env.example .env
```

4. Configure your `.env` file:

```env
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
SOLDEXER_API_URL=https://portal.sqd.dev/datasets/solana-mainnet
WHALE_THRESHOLD=50000
ENABLE_ALERTS=true
ALERT_COOLDOWN_MINUTES=5
```

### Available Scripts

- `npm run dev` - Run in development mode with hot reload
- `npm run build` - Build TypeScript to JavaScript
- `npm start` - Run the built application
- `npm run lint` - Check TypeScript types

## Telegram Bot Commands

### User Commands

- `/start` - Start the bot and subscribe to whale alerts
- `/threshold` - View your current whale threshold
- `/setsol <amount>` - Set threshold in SOL (e.g., `/setsol 100`)
- `/setusd <amount>` - Set threshold in USD (e.g., `/setusd 15000`)
- `/refresh` - View how often you get updates
- `/setrefresh <seconds>` - Set update speed (5-300s)
- `/alerts` - Toggle your alerts on/off
- `/stats` - View whale statistics
- `/help` - Show help message

### Examples

- `/setsol 50` - Get alerts for transactions ≥ 50 SOL
- `/setusd 10000` - Get alerts for transactions ≥ $10,000 USD
- `/setrefresh 5` - Get updates every 5 seconds
- `/setrefresh 60` - Get updates every minute

## Architecture

- **Soldexer/Portal API Client**: Streams real-time blockchain data
- **Whale Detector**: Processes transactions and identifies whales
- **Telegram Bot**: Handles user interactions and sends notifications
- **Configuration**: Environment-based configuration with validation

## Configuration Options

| Variable               | Description                         | Default                                        |
| ---------------------- | ----------------------------------- | ---------------------------------------------- |
| TELEGRAM_BOT_TOKEN     | Your Telegram bot token             | Required                                       |
| SOLDEXER_API_URL       | Soldexer/Portal API endpoint        | https://portal.sqd.dev/datasets/solana-mainnet |
| WHALE_THRESHOLD        | Default threshold for new users     | 50000                                          |
| WHALE_THRESHOLD_TYPE   | Default threshold type (SOL or USD) | USD                                            |
| DEFAULT_POLLING_INTERVAL_SECONDS | Default refresh interval | 15 |
| ENABLE_ALERTS          | Global alert toggle                 | true                                           |
| ALERT_COOLDOWN_MINUTES | Cooldown between similar alerts     | 5                                              |

## Error Handling

The bot includes:

- Automatic reconnection to Soldexer/Portal API
- Graceful shutdown handling
- Comprehensive error logging
- Invalid configuration validation

## Performance

- Sub-second whale detection latency
- Efficient memory usage with automatic cleanup
- Handles high-throughput blockchain data streaming
