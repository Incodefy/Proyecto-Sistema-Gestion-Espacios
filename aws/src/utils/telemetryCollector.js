/**
 * Telemetry Collector - Unified Metrics & Tracing
 * 
 * Recopila y agrega métricas de todos los servicios AWS,
 * proporciona insights de performance y costo, y facilita debugging.
 * 
 * Características:
 * - CloudWatch metrics push
 * - Request/response tracing
 * - Latency percentiles (p50, p95, p99)
 * - Error rate tracking
 * - Cost estimation
 * - Performance insights
 */

const { CloudWatchClient, PutMetricDataCommand } = require("@aws-sdk/client-cloudwatch");
const { Logger } = require("./logger");

/**
 * Metric Types
 */
const MetricType = {
  COUNT: 'Count',
  GAUGE: 'Gauge',
  DURATION: 'Milliseconds',
  RATE: 'Count/Second',
  BYTES: 'Bytes',
  PERCENT: 'Percent'
};

/**
 * Telemetry Collector
 */
class TelemetryCollector {
  constructor(config = {}) {
    this.logger = Logger.create({ handler: 'TelemetryCollector' });
    this.config = {
      namespace: config.namespace || 'Incodefy/Application',
      flushInterval: config.flushInterval || 60000, // 1 minute
      enableCloudWatch: config.enableCloudWatch !== false,
      maxBatchSize: config.maxBatchSize || 20,
      ...config
    };

    // CloudWatch client
    this.cloudwatch = this.config.enableCloudWatch 
      ? new CloudWatchClient({ region: process.env.AWS_REGION || 'us-east-2' })
      : null;

    // Metric buffer
    this.metrics = [];
    
    // Aggregated stats
    this.stats = {
      requests: new Map(),
      latencies: new Map(),
      errors: new Map(),
      costs: new Map()
    };

    // Flush timer
    this.flushTimer = null;

    // Start periodic flush
    this._startPeriodicFlush();

    this.logger.info('TelemetryCollector initialized', {
      namespace: this.config.namespace,
      flushInterval: this.config.flushInterval,
      enableCloudWatch: this.config.enableCloudWatch
    });
  }

  /**
   * Record a metric
   */
  recordMetric(metricName, value, unit = MetricType.COUNT, dimensions = {}) {
    const timestamp = new Date();

    const metric = {
      MetricName: metricName,
      Value: value,
      Unit: unit,
      Timestamp: timestamp,
      Dimensions: this._formatDimensions(dimensions)
    };

    this.metrics.push(metric);

    // Update local stats
    this._updateStats(metricName, value, dimensions);

    // Auto-flush if buffer is full
    if (this.metrics.length >= this.config.maxBatchSize) {
      this.flush();
    }
  }

  /**
   * Record request
   */
  recordRequest(service, operation, success = true, latency = 0) {
    this.recordMetric('RequestCount', 1, MetricType.COUNT, {
      Service: service,
      Operation: operation,
      Status: success ? 'Success' : 'Error'
    });

    if (latency > 0) {
      this.recordMetric('RequestLatency', latency, MetricType.DURATION, {
        Service: service,
        Operation: operation
      });
    }

    if (!success) {
      this.recordMetric('ErrorCount', 1, MetricType.COUNT, {
        Service: service,
        Operation: operation
      });
    }
  }

  /**
   * Record circuit breaker event
   */
  recordCircuitBreakerEvent(service, event) {
    this.recordMetric('CircuitBreakerEvent', 1, MetricType.COUNT, {
      Service: service,
      Event: event // OPEN, CLOSED, HALF_OPEN
    });
  }

  /**
   * Record rate limit event
   */
  recordRateLimitEvent(service, throttled = true) {
    this.recordMetric('RateLimitEvent', 1, MetricType.COUNT, {
      Service: service,
      Throttled: throttled ? 'Yes' : 'No'
    });
  }

  /**
   * Record cache event
   */
  recordCacheEvent(service, hit = true) {
    this.recordMetric('CacheEvent', 1, MetricType.COUNT, {
      Service: service,
      Result: hit ? 'Hit' : 'Miss'
    });
  }

  /**
   * Record cost estimate
   */
  recordCost(service, operation, estimatedCost) {
    this.recordMetric('EstimatedCost', estimatedCost, MetricType.COUNT, {
      Service: service,
      Operation: operation
    });

    // Update cost tracking
    const key = `${service}:${operation}`;
    const current = this.stats.costs.get(key) || 0;
    this.stats.costs.set(key, current + estimatedCost);
  }

  /**
   * Format dimensions for CloudWatch
   */
  _formatDimensions(dimensions) {
    return Object.entries(dimensions).map(([name, value]) => ({
      Name: name,
      Value: String(value)
    }));
  }

  /**
   * Update local statistics
   */
  _updateStats(metricName, value, dimensions) {
    const service = dimensions.Service || 'Unknown';
    
    if (metricName === 'RequestCount') {
      const key = `${service}:requests`;
      const current = this.stats.requests.get(key) || 0;
      this.stats.requests.set(key, current + value);
    }

    if (metricName === 'RequestLatency') {
      const key = `${service}:latency`;
      const latencies = this.stats.latencies.get(key) || [];
      latencies.push(value);
      
      // Keep only last 1000 measurements
      if (latencies.length > 1000) {
        latencies.shift();
      }
      
      this.stats.latencies.set(key, latencies);
    }

    if (metricName === 'ErrorCount') {
      const key = `${service}:errors`;
      const current = this.stats.errors.get(key) || 0;
      this.stats.errors.set(key, current + value);
    }
  }

  /**
   * Start periodic flush to CloudWatch
   */
  _startPeriodicFlush() {
    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.config.flushInterval);
  }

  /**
   * Flush metrics to CloudWatch
   */
  async flush() {
    if (this.metrics.length === 0) {
      return;
    }

    const metricsToFlush = [...this.metrics];
    this.metrics = [];

    if (!this.cloudwatch) {
      this.logger.debug('CloudWatch disabled, skipping flush', {
        metricCount: metricsToFlush.length
      });
      return;
    }

    try {
      // Split into batches of 20 (CloudWatch limit)
      const batches = this._chunkArray(metricsToFlush, 20);

      for (const batch of batches) {
        await this.cloudwatch.send(new PutMetricDataCommand({
          Namespace: this.config.namespace,
          MetricData: batch
        }));
      }

      this.logger.debug('Metrics flushed to CloudWatch', {
        metricCount: metricsToFlush.length,
        batches: batches.length
      });

    } catch (error) {
      this.logger.error('Failed to flush metrics to CloudWatch', {
        error: error.message,
        metricCount: metricsToFlush.length
      });

      // Re-add failed metrics to buffer for retry
      this.metrics.unshift(...metricsToFlush);
    }
  }

  /**
   * Chunk array into smaller arrays
   */
  _chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Get latency percentiles
   */
  getLatencyPercentiles(service) {
    const key = `${service}:latency`;
    const latencies = this.stats.latencies.get(key);

    if (!latencies || latencies.length === 0) {
      return null;
    }

    const sorted = [...latencies].sort((a, b) => a - b);
    const len = sorted.length;

    return {
      count: len,
      min: sorted[0],
      max: sorted[len - 1],
      avg: sorted.reduce((sum, val) => sum + val, 0) / len,
      p50: sorted[Math.floor(len * 0.50)],
      p95: sorted[Math.floor(len * 0.95)],
      p99: sorted[Math.floor(len * 0.99)]
    };
  }

  /**
   * Get error rate
   */
  getErrorRate(service) {
    const requestKey = `${service}:requests`;
    const errorKey = `${service}:errors`;

    const requests = this.stats.requests.get(requestKey) || 0;
    const errors = this.stats.errors.get(errorKey) || 0;

    if (requests === 0) {
      return 0;
    }

    return (errors / requests) * 100;
  }

  /**
   * Get service statistics
   */
  getServiceStats(service) {
    const requestKey = `${service}:requests`;
    const errorKey = `${service}:errors`;

    return {
      service,
      requests: this.stats.requests.get(requestKey) || 0,
      errors: this.stats.errors.get(errorKey) || 0,
      errorRate: this.getErrorRate(service),
      latency: this.getLatencyPercentiles(service),
      estimatedCost: this._getTotalCost(service)
    };
  }

  /**
   * Get total cost for service
   */
  _getTotalCost(service) {
    let total = 0;
    for (const [key, cost] of this.stats.costs.entries()) {
      if (key.startsWith(`${service}:`)) {
        total += cost;
      }
    }
    return total;
  }

  /**
   * Get all statistics
   */
  getAllStats() {
    const services = new Set();
    
    for (const key of this.stats.requests.keys()) {
      const [service] = key.split(':');
      services.add(service);
    }

    const stats = {};
    for (const service of services) {
      stats[service] = this.getServiceStats(service);
    }

    return stats;
  }

  /**
   * Get cost breakdown
   */
  getCostBreakdown() {
    const breakdown = {};

    for (const [key, cost] of this.stats.costs.entries()) {
      const [service, operation] = key.split(':');
      
      if (!breakdown[service]) {
        breakdown[service] = {
          total: 0,
          operations: {}
        };
      }

      breakdown[service].total += cost;
      breakdown[service].operations[operation] = cost;
    }

    return breakdown;
  }

  /**
   * Get insights (performance issues, anomalies)
   */
  getInsights() {
    const insights = [];
    const stats = this.getAllStats();

    for (const [service, data] of Object.entries(stats)) {
      // High error rate
      if (data.errorRate > 5) {
        insights.push({
          severity: 'HIGH',
          service,
          type: 'ERROR_RATE',
          message: `Error rate is ${data.errorRate.toFixed(2)}% (>5%)`,
          value: data.errorRate
        });
      }

      // High latency
      if (data.latency && data.latency.p95 > 1000) {
        insights.push({
          severity: 'MEDIUM',
          service,
          type: 'LATENCY',
          message: `P95 latency is ${data.latency.p95}ms (>1s)`,
          value: data.latency.p95
        });
      }

      // High cost
      if (data.estimatedCost > 10) {
        insights.push({
          severity: 'LOW',
          service,
          type: 'COST',
          message: `Estimated cost is $${data.estimatedCost.toFixed(4)}`,
          value: data.estimatedCost
        });
      }
    }

    return insights;
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats.requests.clear();
    this.stats.latencies.clear();
    this.stats.errors.clear();
    this.stats.costs.clear();
    this.logger.info('Statistics reset');
  }

  /**
   * Stop collector
   */
  stop() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    
    // Final flush
    this.flush();
    
    this.logger.info('TelemetryCollector stopped');
  }
}

// Singleton instance
let telemetryInstance = null;

/**
 * Get TelemetryCollector singleton
 */
function getTelemetry(config = {}) {
  if (!telemetryInstance) {
    telemetryInstance = new TelemetryCollector(config);
  }
  return telemetryInstance;
}

/**
 * Reset telemetry (for testing)
 */
function resetTelemetry() {
  if (telemetryInstance) {
    telemetryInstance.stop();
    telemetryInstance = null;
  }
}

module.exports = {
  TelemetryCollector,
  getTelemetry,
  resetTelemetry,
  MetricType
};
