import { EventEmitter } from 'events';
import { WhaleTransaction, WhaleStats } from '../types';
import { LAMPORTS_PER_SOL } from '../utils/constants';
import { config } from '../utils/config';
import { priceService } from './priceService';

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

    // Use same threshold logic as console logging
    const solPrice = priceService.getSolPrice();
    let isWhale = false;
    
    if (config.whaleThresholdType === 'SOL') {
      isWhale = changeSol >= config.whaleThreshold;
      console.log(`🔍 WhaleDetector: Processing ${changeSol.toFixed(2)} SOL (threshold: ${config.whaleThreshold} SOL)`);
    } else {
      const amountUsd = changeSol * solPrice;
      isWhale = amountUsd >= config.whaleThreshold;
      console.log(`🔍 WhaleDetector: Processing ${changeSol.toFixed(2)} SOL = $${Math.round(amountUsd)} (threshold: $${config.whaleThreshold})`);
    }
    
    if (isWhale) {
      const whale = this.createWhaleTransaction(event, changeLamports);
      
      console.log(`🐋 WhaleDetector: Whale detected, checking cooldown...`);
      if (this.shouldAlert(whale)) {
        console.log(`✅ WhaleDetector: Sending whale alert to Telegram`);
        this.updateStats(whale);
        this.emit('whale', whale);
      } else {
        console.log(`❌ WhaleDetector: Alert blocked by cooldown`);
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
    // Use signature as primary key to prevent exact duplicates
    const signatureKey = whale.signature;
    const cooldownKey = `${whale.fromAddress}-${whale.toAddress}`;
    
    // Check for exact duplicate by signature
    if (this.cooldownMap.has(signatureKey)) {
      console.log(`⏭️ Duplicate signature blocked: ${signatureKey}`);
      return false;
    }
    
    const lastAlert = this.cooldownMap.get(cooldownKey);
    const now = Date.now();
    const cooldownMs = config.alertCooldownMinutes * 60 * 1000;
    
    if (lastAlert && now - lastAlert < cooldownMs) {
      const remainingMs = cooldownMs - (now - lastAlert);
      console.log(`⏳ Cooldown active for ${cooldownKey}, ${Math.round(remainingMs/1000)}s remaining`);
      return false;
    }
    
    // Store both signature and address pair
    this.cooldownMap.set(signatureKey, now);
    this.cooldownMap.set(cooldownKey, now);
    return true;
  }

  private updateStats(whale: WhaleTransaction) {
    this.stats.totalWhales++;
    this.stats.totalVolumeSol += whale.amountSol;
    
    // Only update largest whale if this is bigger (last 24h)
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    if (whale.timestamp >= oneDayAgo) {
      if (!this.stats.largestWhale || whale.amountSol > this.stats.largestWhale.amountSol) {
        this.stats.largestWhale = whale;
      }
    }
    
    this.stats.averageWhaleSizeSol = this.stats.totalVolumeSol / this.stats.totalWhales;
    
    this.recentWhales.set(whale.signature, whale);
    
    this.updateLast24hStats();
  }

  private updateLast24hStats() {
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    let whales24h = 0;
    let volume24h = 0;
    let largest24h: WhaleTransaction | null = null;
    
    for (const [sig, whale] of this.recentWhales.entries()) {
      if (whale.timestamp >= oneDayAgo) {
        whales24h++;
        volume24h += whale.amountSol;
        
        // Track largest in last 24h
        if (!largest24h || whale.amountSol > largest24h.amountSol) {
          largest24h = whale;
        }
      } else {
        this.recentWhales.delete(sig);
      }
    }
    
    this.stats.last24hWhales = whales24h;
    this.stats.last24hVolume = volume24h;
    this.stats.largestWhale = largest24h;
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