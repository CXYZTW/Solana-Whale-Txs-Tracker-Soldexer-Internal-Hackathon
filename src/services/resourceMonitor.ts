interface ResourceMetrics {
  apiCallsPerMinute: number;
  memoryUsageMB: number;
  activeUsers: number;
  whaleTransactions: number;
  uptime: number;
  lastReset: number;
}

export class ResourceMonitor {
  private metrics: ResourceMetrics;
  private startTime: number;
  private apiCallCounter: number = 0;
  private lastMinute: number = 0;
  private whaleCounter: number = 0;

  constructor() {
    this.startTime = Date.now();
    this.metrics = {
      apiCallsPerMinute: 0,
      memoryUsageMB: 0,
      activeUsers: 0,
      whaleTransactions: 0,
      uptime: 0,
      lastReset: Date.now()
    };
    
    this.startMonitoring();
  }

  private startMonitoring() {
    setInterval(() => {
      this.updateMetrics();
      this.logMetrics();
    }, 60000); // Log every minute
  }

  private updateMetrics() {
    const now = Date.now();
    const currentMinute = Math.floor(now / 60000);
    
    // Reset API call counter every minute
    if (currentMinute !== this.lastMinute) {
      this.metrics.apiCallsPerMinute = this.apiCallCounter;
      this.apiCallCounter = 0;
      this.lastMinute = currentMinute;
    }
    
    // Update memory usage
    const memUsage = process.memoryUsage();
    this.metrics.memoryUsageMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    
    // Update uptime
    this.metrics.uptime = Math.floor((now - this.startTime) / 1000);
    
    // Check for high resource usage
    if (this.metrics.apiCallsPerMinute > 100) {
      console.warn(`⚠️  High API usage: ${this.metrics.apiCallsPerMinute} calls/min`);
    }
    
    if (this.metrics.memoryUsageMB > 512) {
      console.warn(`⚠️  High memory usage: ${this.metrics.memoryUsageMB}MB`);
    }
  }

  private logMetrics() {
    console.log(`📊 Resource Usage - API: ${this.metrics.apiCallsPerMinute}/min, Memory: ${this.metrics.memoryUsageMB}MB, Users: ${this.metrics.activeUsers}, Whales: ${this.metrics.whaleTransactions}, Uptime: ${Math.floor(this.metrics.uptime / 60)}m`);
  }

  recordApiCall() {
    this.apiCallCounter++;
  }

  recordWhaleTransaction() {
    this.whaleCounter++;
    this.metrics.whaleTransactions = this.whaleCounter;
  }

  updateActiveUsers(count: number) {
    this.metrics.activeUsers = count;
  }

  getMetrics(): ResourceMetrics {
    return { ...this.metrics };
  }

  isResourceUsageHigh(): boolean {
    return this.metrics.apiCallsPerMinute > 150 || this.metrics.memoryUsageMB > 768;
  }

  shouldThrottle(): boolean {
    return this.metrics.apiCallsPerMinute > 200;
  }
}

export const resourceMonitor = new ResourceMonitor();