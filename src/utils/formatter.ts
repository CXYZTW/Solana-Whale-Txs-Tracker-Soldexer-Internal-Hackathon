import { WhaleTransaction, WhaleStats } from '../types';
import { EMOJI, MESSAGES } from './constants';
import { priceService } from '../services/priceService';

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
  const hasRealSignature = whale.signature && whale.signature.length > 20 && !whale.signature.includes('block_') && !whale.signature.includes('balance_change_');
  
  const timeAgo = formatTimeAgo(whale.timestamp);
  
  // Calculate USD value using actual SOL price
  const usdValue = priceService.formatUsdValue(parseFloat(amount.replace(/,/g, '')));
  
  let message = `🐋 **WHALE: ${Math.round(parseFloat(amount.replace(/,/g, '')))} SOL**\n\n`;
  
  message += `💰 **Amount:** ${amount} SOL\n`;
  message += `💵 **Value:** ${usdValue}\n`;
  message += `📍 **${direction === 'RECEIVED' ? 'Receiver' : 'Account'}:** \`${shortenAddress(mainAddress)}\`\n`;
  
  if (hasRealSignature) {
    message += `\n🔗 [View Transaction](https://solscan.io/tx/${whale.signature})`;
  } else {
    message += `\n🔗 [View Account](https://solscan.io/account/${mainAddress})`;
  }
  
  message += `\n⏰ ${timeAgo}`;
  
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
  
  // Format CET time
  const date = new Date(timestamp);
  const cetTime = date.toLocaleString('en-GB', {
    timeZone: 'Europe/Berlin',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    day: '2-digit',
    month: '2-digit'
  });
  
  let timeAgo = '';
  if (diffHours > 0) {
    timeAgo = `${diffHours}h ${diffMinutes % 60}m ago`;
  } else if (diffMinutes > 0) {
    timeAgo = `${diffMinutes}m ago`;
  } else {
    timeAgo = `${diffSeconds}s ago`;
  }
  
  return `${timeAgo} (${cetTime} CET)`;
}

export function escapeMarkdown(text: string): string {
  return text.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');
}