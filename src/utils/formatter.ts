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
  const date = new Date(whale.timestamp);
  
  // Calculate USD value using actual SOL price
  const usdValue = priceService.formatUsdValue(parseFloat(amount.replace(/,/g, '')));
  
  let message = `🐋 **WHALE TRANSACTION DETECTED: ${Math.round(parseFloat(amount.replace(/,/g, '')))} SOL**\n\n`;
  message += `==================================================\n\n`;
  message += `📋 **Transaction Details**\n\n`;
  message += `   Timestamp: ${timeAgo} (${date.toUTCString()})\n`;
  
  if (hasRealSignature) {
    message += `   Tx: \`${whale.signature}\`\n`;
    message += `   Link: [solscan.io/tx/${whale.signature}](https://solscan.io/tx/${whale.signature})\n\n`;
  } else {
    message += `\n`;
  }
  
  message += `💸 **Transfer**\n\n`;
  message += `   ${direction === 'RECEIVED' ? 'Receiver' : 'Account'}: \`${mainAddress}\`\n`;
  message += `   Link: [solscan.io/account/${mainAddress}](https://solscan.io/account/${mainAddress})\n`;
  message += `   Amount: ${amount} SOL\n`;
  message += `   USD Value: ${usdValue}\n\n`;
  message += `==========================================`;
  
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