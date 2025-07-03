export interface WhaleTransaction {
  signature: string;
  blockHeight: number;
  timestamp: number;
  fromAddress: string;
  toAddress: string;
  amountLamports: bigint;
  amountSol: number;
  preBalanceFrom?: bigint;
  postBalanceFrom?: bigint;
  preBalanceTo?: bigint;
  postBalanceTo?: bigint;
  type: 'transfer' | 'stake' | 'unstake' | 'other';
}

export interface BlockData {
  header: {
    number: number;
    hash: string;
    parentHash: string;
  };
  transactions: TransactionData[];
}

export interface TransactionData {
  transactionIndex: number;
  signature: string;
  err: any | null;
  meta: {
    preBalances: bigint[];
    postBalances: bigint[];
    logMessages: string[];
  };
  transaction: {
    message: {
      accountKeys: string[];
      instructions: any[];
    };
  };
}

export interface StreamData {
  blocks: BlockData[];
}

export interface BotConfig {
  telegramToken: string;
  sqdApiUrl: string;
  whaleThreshold: number;
  whaleThresholdType: 'SOL' | 'USD';
  enableAlerts: boolean;
  alertCooldownMinutes: number;
}

export interface WhaleStats {
  totalWhales: number;
  totalVolumeSol: number;
  largestWhale: WhaleTransaction | null;
  last24hWhales: number;
  last24hVolume: number;
  averageWhaleSizeSol: number;
}

export interface UserSettings {
  userId: number;
  threshold: number;
  thresholdType: 'SOL' | 'USD';
  alertsEnabled: boolean;
}