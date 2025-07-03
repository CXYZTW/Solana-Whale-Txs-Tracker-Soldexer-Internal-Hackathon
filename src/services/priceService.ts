import axios from 'axios';
import { resourceMonitor } from './resourceMonitor';

export interface PriceData {
  solUsd: number;
  lastUpdated: number;
}

export class PriceService {
  private cache: PriceData | null = null;
  private fetchInterval: NodeJS.Timeout | null = null;
  private readonly FETCH_INTERVAL = 30 * 1000; // Reduced from 12s to 30s
  private readonly DEFAULT_PRICE = 150;
  private readonly CACHE_DURATION = 60 * 1000; // 1 minute cache
  private fetchCount: number = 0;
  private lastFetchTime: number = 0;

  constructor() {
    this.startPriceFetching();
  }

  private startPriceFetching() {
    this.fetchPrice();
    
    this.fetchInterval = setInterval(() => {
      this.fetchPrice();
    }, this.FETCH_INTERVAL);
  }
  
  private shouldFetch(): boolean {
    const now = Date.now();
    if (now - this.lastFetchTime < this.CACHE_DURATION) {
      return false;
    }
    return true;
  }

  private async fetchPrice() {
    if (!this.shouldFetch()) {
      return;
    }
    
    try {
      this.fetchCount++;
      this.lastFetchTime = Date.now();
      resourceMonitor.recordApiCall();
      
      const response = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd', {
        timeout: 5000 // Reduced timeout
      });

      const price = response.data.solana.usd;
      this.cache = {
        solUsd: price,
        lastUpdated: Date.now()
      };
      
      // Log every 10 fetches to monitor usage
      if (this.fetchCount % 10 === 0) {
        console.log(`💰 Price fetched (${this.fetchCount} total): $${price}`);
      }
      
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 429) {
        console.log('⚠️ Rate limited, using cached price');
      } else {
        console.error('❌ Error fetching SOL price:', error instanceof Error ? error.message : error);
      }
    }
  }

  getSolPrice(): number {
    // Use cache if available and not too old
    if (this.cache && (Date.now() - this.cache.lastUpdated) < (5 * 60 * 1000)) {
      return this.cache.solUsd;
    }
    return this.DEFAULT_PRICE;
  }
  
  getFetchCount(): number {
    return this.fetchCount;
  }

  getLastUpdated(): Date | null {
    return this.cache ? new Date(this.cache.lastUpdated) : null;
  }

  stop() {
    if (this.fetchInterval) {
      clearInterval(this.fetchInterval);
      this.fetchInterval = null;
    }
  }

  formatUsdValue(solAmount: number): string {
    const solPrice = this.getSolPrice();
    const usdValue = solAmount * solPrice;
    return usdValue.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    });
  }
  
  getResourceMetrics() {
    return {
      fetchCount: this.fetchCount,
      lastFetchTime: this.lastFetchTime,
      cacheAge: this.cache ? Date.now() - this.cache.lastUpdated : null
    };
  }
}

export const priceService = new PriceService();