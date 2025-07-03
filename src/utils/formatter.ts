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
  const from = shortenAddress(whale.fromAddress);
  const to = shortenAddress(whale.toAddress);
  
  return `${EMOJI.WHALE} *Whale Alert!*

${EMOJI.MONEY} *Amount:* ${amount} SOL
${EMOJI.ARROW} *From:* \`${from}\`
${EMOJI.ARROW} *To:* \`${to}\`
${EMOJI.INFO} *Block:* ${whale.blockHeight.toLocaleString()}
${EMOJI.INFO} *Time:* ${new Date(whale.timestamp).toLocaleString()}
${EMOJI.INFO} *Signature:* \`${shortenAddress(whale.signature, 8)}\`

[View on Solscan](https://solscan.io/tx/${whale.signature})`;
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

export function escapeMarkdown(text: string): string {
  return text.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');
}