import { EventEmitter } from 'events';
import { WhaleTransaction, WhaleStats } from '../types';
import { LAMPORTS_PER_SOL } from '../utils/constants';
import { config } from '../utils/config';

interface BalanceChangeEvent {
  account: string;
  change: bigint;
  preBalance: bigint;
  postBalance: bigint;
  signature: string;
  blockHeight: number;
  timestamp: number;
  transaction: any;
}

export class WhaleDetector extends EventEmitter {
  private whaleThreshold: number;
  private stats: WhaleStats;
  private recentWhales: Map<string, WhaleTransaction>;
  private cooldownMap: Map<string, number>;

  constructor(thresholdSol: number = config.whaleThreshold) {
    super();
    this.whaleThreshold = thresholdSol;
    this.stats = {
      totalWhales: 0,
      totalVolumeSol: 0,
      largestWhale: null,
      last24hWhales: 0,
      last24hVolume: 0,
      averageWhaleSizeSol: 0,
    };
    this.recentWhales = new Map();
    this.cooldownMap = new Map();
    
    this.startStatsCleanup();
  }

  processBalanceChange(event: BalanceChangeEvent) {
    const changeLamports = Math.abs(Number(event.change));
    const changeSol = changeLamports / LAMPORTS_PER_SOL;

    if (changeSol >= this.whaleThreshold) {
      const whale = this.createWhaleTransaction(event, changeLamports);
      
      if (this.shouldAlert(whale)) {
        this.updateStats(whale);
        this.emit('whale', whale);
      }
    }
  }

  private createWhaleTransaction(event: BalanceChangeEvent, amountLamports: number): WhaleTransaction {
    const isReceiving = event.change > 0n;
    
    return {
      signature: event.signature,
      blockHeight: event.blockHeight,
      timestamp: event.timestamp,
      fromAddress: isReceiving ? 'Unknown' : event.account,
      toAddress: isReceiving ? event.account : 'Unknown',
      amountLamports: BigInt(amountLamports),
      amountSol: amountLamports / LAMPORTS_PER_SOL,
      preBalanceFrom: isReceiving ? undefined : event.preBalance,
      postBalanceFrom: isReceiving ? undefined : event.postBalance,
      preBalanceTo: isReceiving ? event.preBalance : undefined,
      postBalanceTo: isReceiving ? event.postBalance : undefined,
      type: this.detectTransactionType(event.transaction),
    };
  }

  private detectTransactionType(transaction: any): 'transfer' | 'stake' | 'unstake' | 'other' {
    if (!transaction?.transaction?.message?.instructions) return 'other';
    
    const instructions = transaction.transaction.message.instructions;
    const programIds = instructions.map((inst: any) => inst.programIdIndex);
    
    if (programIds.some((id: number) => id === 0)) return 'transfer';
    if (programIds.some((id: number) => id === 1)) return 'stake';
    
    return 'other';
  }

  private shouldAlert(whale: WhaleTransaction): boolean {
    const cooldownKey = `${whale.fromAddress}-${whale.toAddress}`;
    const lastAlert = this.cooldownMap.get(cooldownKey);
    const now = Date.now();
    
    if (lastAlert && now - lastAlert < config.alertCooldownMinutes * 60 * 1000) {
      return false;
    }
    
    this.cooldownMap.set(cooldownKey, now);
    return true;
  }

  private updateStats(whale: WhaleTransaction) {
    this.stats.totalWhales++;
    this.stats.totalVolumeSol += whale.amountSol;
    
    if (!this.stats.largestWhale || whale.amountSol > this.stats.largestWhale.amountSol) {
      this.stats.largestWhale = whale;
    }
    
    this.stats.averageWhaleSizeSol = this.stats.totalVolumeSol / this.stats.totalWhales;
    
    this.recentWhales.set(whale.signature, whale);
    
    this.updateLast24hStats();
  }

  private updateLast24hStats() {
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    let whales24h = 0;
    let volume24h = 0;
    
    for (const [sig, whale] of this.recentWhales.entries()) {
      if (whale.timestamp >= oneDayAgo) {
        whales24h++;
        volume24h += whale.amountSol;
      } else {
        this.recentWhales.delete(sig);
      }
    }
    
    this.stats.last24hWhales = whales24h;
    this.stats.last24hVolume = volume24h;
  }

  private startStatsCleanup() {
    setInterval(() => {
      this.updateLast24hStats();
      
      const now = Date.now();
      const cooldownMs = config.alertCooldownMinutes * 60 * 1000;
      
      for (const [key, timestamp] of this.cooldownMap.entries()) {
        if (now - timestamp > cooldownMs) {
          this.cooldownMap.delete(key);
        }
      }
    }, 60 * 1000);
  }

  getStats(): WhaleStats {
    return { ...this.stats };
  }

  setThreshold(newThresholdSol: number) {
    this.whaleThreshold = newThresholdSol;
  }

  getThreshold(): number {
    return this.whaleThreshold;
  }

  resetStats() {
    this.stats = {
      totalWhales: 0,
      totalVolumeSol: 0,
      largestWhale: null,
      last24hWhales: 0,
      last24hVolume: 0,
      averageWhaleSizeSol: 0,
    };
    this.recentWhales.clear();
  }
}