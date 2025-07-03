import axios from 'axios';
import { EventEmitter } from 'events';
import { BlockData, StreamData, TransactionData } from '../types';
import { config } from '../utils/config';
import { priceService } from './priceService';

export class SQDApiClient extends EventEmitter {
  private baseUrl: string;
  private isStreaming: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private reconnectDelay: number = 5000;
  private abortController?: AbortController;
  private currentBlockHeight?: number;
  private loggedTransactions: Set<string> = new Set();

  constructor(baseUrl: string = config.sqdApiUrl) {
    super();
    this.baseUrl = baseUrl;
  }

  async getMetadata() {
    try {
      console.log(`Fetching metadata from: ${this.baseUrl}/metadata`);
      const response = await axios.get(`${this.baseUrl}/metadata`, {
        timeout: 10000
      });
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('Error fetching metadata:', {
          message: error.message,
          code: error.code,
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data
        });
      } else {
        console.error('Error fetching metadata:', error);
      }
      throw error;
    }
  }

  async getLatestBlock() {
    try {
      console.log(`Fetching latest block from: ${this.baseUrl}/head`);
      const response = await axios.get(`${this.baseUrl}/head`, {
        timeout: 10000
      });
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('Error fetching latest block:', {
          message: error.message,
          code: error.code,
          response: error.response?.status,
          responseData: error.response?.data
        });
      } else {
        console.error('Error fetching latest block:', error);
      }
      throw error;
    }
  }

  async startPolling(fromBlock?: number) {
    if (this.isStreaming) {
      console.log('Already polling');
      return;
    }

    this.isStreaming = true;
    this.reconnectAttempts = 0;
    let currentBlock = fromBlock;

    console.log('Starting 15-second polling interval...');

    while (this.isStreaming) {
      try {
        // Get latest block
        const latestBlock = await this.getLatestBlock();
        
        if (!currentBlock) {
          currentBlock = latestBlock.number;
        }

        // Only fetch if there are new blocks
        if (latestBlock.number > currentBlock!) {
          // Fetching new blocks (stats available via /stats command)
          await this.fetchBlockRange(currentBlock!, latestBlock.number);
          currentBlock = latestBlock.number;
          this.reconnectAttempts = 0; // Reset on success
        } else {
          // No new blocks (stats available via /stats command)
        }

        // Wait 15 seconds before next poll
        await new Promise(resolve => setTimeout(resolve, 15000));
        
      } catch (error) {
        console.error('Polling error:', error);
        
        if (!this.isStreaming) break;
        
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          console.error('Max polling attempts reached');
          this.emit('error', new Error('Max polling attempts reached'));
          this.stopPolling();
          break;
        }

        this.reconnectAttempts++;
        const delay = Math.min(this.reconnectAttempts * 5000, 30000); // Max 30s delay
        console.log(`Retrying in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  private async fetchBlockRange(fromBlock: number, toBlock: number) {
    this.abortController = new AbortController();
    this.loggedTransactions.clear();
    
    const requestBody = {
      type: 'solana',
      fromBlock: fromBlock,
      toBlock: toBlock,
      fields: {
        block: {
          number: true,
          timestamp: true
        },
        balance: {
          account: true,
          pre: true,
          post: true,
          transactionIndex: true
        },
        transaction: {
          transactionIndex: true,
          signatures: true,
          fee: true,
          feePayer: true,
          accountKeys: true,
          err: true
        }
      },
      balances: [
        {
          transaction: true // Include transaction info for balance changes
        }
      ]
    };


    const response = await axios.post(
      `${this.baseUrl}/stream`,
      requestBody,
      {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/x-ndjson'
        },
        responseType: 'stream',
        signal: this.abortController.signal
      }
    );

    return new Promise((resolve, reject) => {
      const stream = response.data;
      let buffer = '';
      let blockCount = 0;
      let balanceCount = 0;
      let whaleCount = 0;

      stream.on('data', async (chunk: Buffer) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim()) {
            try {
              const data = JSON.parse(line);
              if (data.header && data.balances) {
                blockCount++;
                balanceCount += data.balances.length;
                // Count whales in this block
                for (const balance of data.balances) {
                  if (balance.account && balance.pre !== undefined && balance.post !== undefined) {
                    const changeSol = Math.abs(Number(BigInt(balance.post) - BigInt(balance.pre))) / 1_000_000_000;
                    if (changeSol >= 100) {
                      whaleCount++;
                    }
                  }
                }
              }
              await this.processStreamItem(data);
            } catch (error) {
              console.error('Error parsing stream data:', error);
              console.error('Line that failed:', line.substring(0, 100));
            }
          }
        }
      });

      stream.on('end', () => {
        resolve(void 0);
      });

      stream.on('error', (error: Error) => {
        console.error('Stream error:', error);
        reject(error);
      });
    });
  }

  private async processStreamItem(data: any) {
    // Check if this is a complete block with header and balances
    if (data.header && data.balances) {
      const blockNumber = data.header.number;
      const blockTimestamp = data.header.timestamp * 1000; // Convert to milliseconds
      this.currentBlockHeight = blockNumber;
      
      
      const solPrice = priceService.getSolPrice();
      
      // Create a map of transactions by index for easy lookup
      const transactionMap = new Map();
      if (data.transactions) {
        for (const tx of data.transactions) {
          transactionMap.set(tx.transactionIndex, tx);
        }
      }
      
      // Process all balance changes in this block
      for (const balance of data.balances) {
        if (balance.account && balance.pre !== undefined && balance.post !== undefined) {
          const preBalance = BigInt(balance.pre);
          const postBalance = BigInt(balance.post);
          const balanceChange = postBalance - preBalance;
          
          if (balanceChange !== 0n) {
            const changeSol = Number(balanceChange) / 1_000_000_000;
            
            const defaultThreshold = config.whaleThreshold;
            const defaultType = config.whaleThresholdType;
            let isWhale = false;
            
            if (defaultType === 'SOL') {
              isWhale = Math.abs(changeSol) >= defaultThreshold;
            } else {
              const amountUsd = Math.abs(changeSol) * solPrice;
              isWhale = amountUsd >= defaultThreshold;
            }
            
            if (isWhale) {
              await this.logWhaleTransaction(balance, changeSol, blockNumber, blockTimestamp, transactionMap, solPrice);
            }
            
            this.emit('balanceChange', {
              account: balance.account,
              change: balanceChange,
              preBalance: preBalance,
              postBalance: postBalance,
              signature: `block_${blockNumber}_tx_${balance.transactionIndex || 0}`,
              blockHeight: blockNumber,
              timestamp: blockTimestamp,
              transaction: balance
            });
          }
        }
      }
    }
    
    // Handle individual balance items (fallback for different response formats)
    else if (data.account && data.pre !== undefined && data.post !== undefined) {
      const preBalance = BigInt(data.pre);
      const postBalance = BigInt(data.post);
      const balanceChange = postBalance - preBalance;
      
      if (balanceChange !== 0n) {
        const changeSol = Number(balanceChange) / 1_000_000_000;
        
        // Check against default threshold for console logging
        const solPrice = priceService.getSolPrice();
        const defaultThreshold = config.whaleThreshold;
        const defaultType = config.whaleThresholdType;
        let isWhale = false;
        
        if (defaultType === 'SOL') {
          isWhale = Math.abs(changeSol) >= defaultThreshold;
        } else {
          // USD threshold
          const amountUsd = Math.abs(changeSol) * solPrice;
          isWhale = amountUsd >= defaultThreshold;
        }
        
        // Log if it's a whale based on default threshold
        if (isWhale) {
          await this.logWhaleTransaction(data, changeSol, this.currentBlockHeight || 0, Date.now(), new Map(), solPrice);
        }
        
        this.emit('balanceChange', {
          account: data.account,
          change: balanceChange,
          preBalance: preBalance,
          postBalance: postBalance,
          signature: `tx_${data.transactionIndex || 0}`,
          blockHeight: this.currentBlockHeight || 0,
          timestamp: Date.now(),
          transaction: data
        });
      }
    }
    
    // Handle block headers (fallback)
    else if (data.number && typeof data.number === 'number') {
      this.currentBlockHeight = data.number;
    }
  }

  private async logWhaleTransaction(balance: any, changeSol: number, _blockNumber: number, blockTimestamp: number, transactionMap: Map<number, any>, _solPrice: number) {
    const direction = changeSol > 0 ? 'RECEIVED' : 'SENT';
    const amount = Math.abs(changeSol);
    const usdValue = priceService.formatUsdValue(amount);
    
    const transaction = transactionMap.get(balance.transactionIndex);
    const txSignature = transaction?.signatures?.[0] || `tx_${balance.transactionIndex}`;
    
    if (this.loggedTransactions.has(txSignature)) {
      return;
    }
    
    this.loggedTransactions.add(txSignature);
    
    console.log(`\n🐋 WHALE TRANSACTION DETECTED: ${Math.round(amount)} SOL`);
    console.log('=' .repeat(50));
    
    // Transaction Details
    console.log('📋 Transaction Details');
    const date = new Date(blockTimestamp);
    const timeAgo = this.getTimeAgo(blockTimestamp);
    console.log(`   Timestamp: ${timeAgo} (${date.toUTCString()})`);
    
    if (transaction?.signatures?.[0]) {
      console.log(`   Tx: ${transaction.signatures[0]}`);
      console.log(`   Link: solscan.io/tx/${transaction.signatures[0]}`);
    }
    
    // Transfer Details
    console.log('\n💸 Transfer');
    console.log(`   ${direction === 'RECEIVED' ? 'Receiver' : 'Account'}: ${balance.account}`);
    console.log(`   Link: solscan.io/account/${balance.account}`);
    console.log(`   Amount: ${amount.toFixed(2)} SOL`);
    console.log(`   USD Value: ${usdValue}`);
    
    console.log('=' .repeat(50));
  }
  
  private getTimeAgo(timestamp: number): string {
    const now = Date.now();
    const diffMs = now - timestamp;
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffDays > 0) {
      return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    } else if (diffHours > 0) {
      return `${diffHours} hour${diffHours > 1 ? 's' : ''} ${diffMinutes % 60} minute${diffMinutes % 60 !== 1 ? 's' : ''} ago`;
    } else if (diffMinutes > 0) {
      return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
    } else {
      return `${diffSeconds} second${diffSeconds !== 1 ? 's' : ''} ago`;
    }
  }

  stopPolling() {
    this.isStreaming = false;
    if (this.abortController) {
      this.abortController.abort();
    }
    this.removeAllListeners();
  }

  // Keep old name for compatibility
  stopStreaming() {
    this.stopPolling();
  }

  isActive(): boolean {
    return this.isStreaming;
  }
}