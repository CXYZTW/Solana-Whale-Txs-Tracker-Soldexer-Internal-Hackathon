import { WhaleTransaction, WhaleStats } from '../types';
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
  
  // Check if signature looks like a real transaction hash
  const hasRealSignature = whale.signature && whale.signature.length > 20 && !whale.signature.includes('block_') && !whale.signature.includes('balance_change_');
  
  const timeAgo = formatTimeAgo(whale.timestamp);
  
  // Calculate USD value using actual SOL price
  const usdValue = priceService.formatUsdValue(parseFloat(amount.replace(/,/g, '')));
  
  let message = `🐋 **WHALE: ${Math.round(parseFloat(amount.replace(/,/g, '')))} SOL**\n\n`;
  
  message += `💰 **Amount:** ${amount} SOL\n`;
  message += `💵 **Value:** ${usdValue}\n`;
  
  // Always show the account that had the balance change
  message += `📍 **Account:** \`${shortenAddress(mainAddress)}\`\n`;
  
  // Always try to show transaction link if we have a real signature
  if (hasRealSignature) {
    message += `\n🔗 [View Transaction](https://solscan.io/tx/${whale.signature})`;
  } else {
    // If no real signature, show account link but label it as transaction for consistency
    message += `\n🔗 [View Transaction](https://solscan.io/account/${mainAddress})`;
  }
  
  message += `\n⏰ ${timeAgo}`;
  
  return message;
}

export function formatStats(stats: WhaleStats): string {
  if (stats.totalWhales === 0) {
    return '**Whale Activity**\n\nNo whale transactions detected yet.\nI\'m monitoring the blockchain for large transfers.';
  }
  
  
  let message = '**Whale Activity Summary**\n\n';
  
  // Recent activity (most important)
  message += '**Last 24 Hours**\n';
  message += `Whale Transactions: ${stats.last24hWhales.toLocaleString()}\n`;
  message += `Total Volume: ${stats.last24hVolume.toLocaleString()} SOL\n`;
  message += `USD Value: ${priceService.formatUsdValue(stats.last24hVolume)}\n\n`;
  
  // Activity rate
  const avgPerHour = Math.round(stats.last24hWhales / 24 * 10) / 10;
  message += `Average: ${avgPerHour} whales per hour\n\n`;
  
  // Largest recent whale
  if (stats.largestWhale) {
    message += '**Biggest Recent Whale**\n';
    message += `${formatSolAmount(stats.largestWhale.amountLamports)} SOL\n`;
    message += `${priceService.formatUsdValue(stats.largestWhale.amountSol)}\n\n`;
  }
  
  // All-time stats
  message += '**All-Time Stats**\n';
  message += `Total Detected: ${stats.totalWhales.toLocaleString()}\n`;
  message += `Average Size: ${Math.round(stats.averageWhaleSizeSol).toLocaleString()} SOL\n`;
  message += `Average Value: ${priceService.formatUsdValue(stats.averageWhaleSizeSol)}`;
  
  return message;
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