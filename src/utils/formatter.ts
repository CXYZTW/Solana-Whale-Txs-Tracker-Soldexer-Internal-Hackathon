import { WhaleTransaction, WhaleStats } from '../types';
import { EMOJI, MESSAGES } from './constants';

export function formatSolAmount(lamports: bigint): string {
  const sol = Number(lamports) / 1_000_000_000;
  return sol.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

export function shortenAddress(address: string, length: number = 6): string {
  if (address.length <= length * 2) return address;
  return `${address.slice(0, length)}...${address.slice(-length)}`;
}

export function formatWhaleAlert(whale: WhaleTransaction): string {
  const amount = formatSolAmount(BigInt(whale.amountLamports));
  const isReceiving = whale.fromAddress === 'Unknown';
  const mainAddress = isReceiving ? whale.toAddress : whale.fromAddress;
  const direction = isReceiving ? 'RECEIVED' : 'SENT';
  
  // Check if signature looks like a real transaction hash
  const hasRealSignature = whale.signature && whale.signature.length > 20 && !whale.signature.includes('block_');
  
  let message = `🐋 **WHALE DETECTED: ${amount} SOL**\n\n`;
  
  message += `💸 **${direction}**\n`;
  message += `Account: \`${shortenAddress(mainAddress)}\`\n`;
  message += `Amount: **${amount} SOL**\n`;
  
  if (hasRealSignature) {
    message += `\n🔗 **Transaction**\n`;
    message += `[View on Solscan](https://solscan.io/tx/${whale.signature})`;
  } else {
    message += `\n📍 **Account Details**\n`;
    message += `[View on Solscan](https://solscan.io/account/${mainAddress})`;
  }
  
  const timeAgo = formatTimeAgo(whale.timestamp);
  message += `\n\n⏰ ${timeAgo}`;
  
  return message;
}

export function formatStats(stats: WhaleStats): string {
  if (stats.totalWhales === 0) {
    return MESSAGES.STATS_HEADER + MESSAGES.NO_STATS;
  }
  
  return `${MESSAGES.STATS_HEADER}
${EMOJI.WHALE} *Total Whales:* ${stats.totalWhales.toLocaleString()}
${EMOJI.MONEY} *Total Volume:* ${stats.totalVolumeSol.toLocaleString()} SOL
${EMOJI.CHART} *Average Size:* ${stats.averageWhaleSizeSol.toLocaleString()} SOL

*Last 24 Hours:*
${EMOJI.WHALE} *Whales:* ${stats.last24hWhales.toLocaleString()}
${EMOJI.MONEY} *Volume:* ${stats.last24hVolume.toLocaleString()} SOL

${stats.largestWhale ? `*Largest Whale Today:*
${EMOJI.MONEY} ${formatSolAmount(stats.largestWhale.amountLamports)} SOL
${EMOJI.INFO} \`${shortenAddress(stats.largestWhale.signature, 8)}\`` : ''}`;
}

export function formatTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  
  if (diffHours > 0) {
    return `${diffHours}h ${diffMinutes % 60}m ago`;
  } else if (diffMinutes > 0) {
    return `${diffMinutes}m ago`;
  } else {
    return `${diffSeconds}s ago`;
  }
}

export function escapeMarkdown(text: string): string {
  return text.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');
}