import axios from 'axios';

export interface PriceData {
  solUsd: number;
  lastUpdated: number;
}

export class PriceService {
  private cache: PriceData | null = null;
  private fetchInterval: NodeJS.Timeout | null = null;
  private readonly FETCH_INTERVAL = 12 * 1000;
  private readonly DEFAULT_PRICE = 150;

  constructor() {
    this.startPriceFetching();
  }

  private startPriceFetching() {
    this.fetchPrice();
    
    this.fetchInterval = setInterval(() => {
      this.fetchPrice();
    }, this.FETCH_INTERVAL);
  }

  private async fetchPrice() {
    try {
      const response = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd', {
        timeout: 8000
      });

      const price = response.data.solana.usd;
      this.cache = {
        solUsd: price,
        lastUpdated: Date.now()
      };
      
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 429) {
      } else {
        console.error('❌ Error fetching SOL price:', error instanceof Error ? error.message : error);
      }
    }
  }

  getSolPrice(): number {
    return this.cache?.solUsd || this.DEFAULT_PRICE;
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
}

export const priceService = new PriceService();