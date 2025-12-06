/**
 * Service Registry - Health Check & Service Discovery
 * 
 * Mantiene un registro de todos los servicios AWS disponibles,
 * ejecuta health checks periódicos y proporciona endpoints de fallback.
 * 
 * Características:
 * - Health checks automáticos cada N segundos
 * - Detección de degradación de servicio
 * - Endpoints de fallback configurables
 * - Métricas de disponibilidad
 * - Alertas cuando servicio no está disponible
 */

const Logger = require("./logger");
const { getAmbassador } = require("./awsAmbassador");

/**
 * Service Status
 */
const ServiceStatus = {
  AVAILABLE: 'AVAILABLE',
  DEGRADED: 'DEGRADED',
  UNAVAILABLE: 'UNAVAILABLE',
  UNKNOWN: 'UNKNOWN'
};

/**
 * Service Registry
 */
class ServiceRegistry {
  constructor(config = {}) {
    this.logger = Logger.create({ handler: 'ServiceRegistry' });
    this.config = {
      healthCheckInterval: config.healthCheckInterval || 60000, // 1 minute
      healthCheckTimeout: config.healthCheckTimeout || 5000,
      enableAutoHealthCheck: config.enableAutoHealthCheck !== false,
      ...config
    };

    // Service catalog
    this.services = new Map();
    
    // Health check results
    this.healthStatus = new Map();
    
    // Health check interval
    this.healthCheckTimer = null;

    // Ambassador instance
    this.ambassador = getAmbassador();

    // Initialize services
    this._initializeServices();

    // Start health checks
    if (this.config.enableAutoHealthCheck) {
      this._startHealthChecks();
    }

    this.logger.info('ServiceRegistry initialized', {
      serviceCount: this.services.size,
      healthCheckInterval: this.config.healthCheckInterval
    });
  }

  /**
   * Initialize service catalog
   */
  _initializeServices() {
    // SNS Service
    this.registerService({
      name: 'SNS',
      type: 'messaging',
      endpoint: process.env.EVENT_BUS_TOPIC_ARN,
      healthCheck: async () => this._healthCheckSNS(),
      fallback: {
        type: 'queue',
        description: 'Use DLQ for failed messages'
      },
      metrics: {
        maxThroughput: 300, // messages/second
        avgLatency: 100 // ms
      }
    });

    // DynamoDB Service
    this.registerService({
      name: 'DynamoDB',
      type: 'database',
      endpoint: 'dynamodb.us-east-2.amazonaws.com',
      healthCheck: async () => this._healthCheckDynamoDB(),
      fallback: {
        type: 'cache',
        description: 'Use in-memory cache for reads'
      },
      metrics: {
        maxThroughput: 1000, // requests/second
        avgLatency: 50 // ms
      }
    });

    // Cognito Service
    this.registerService({
      name: 'Cognito',
      type: 'auth',
      endpoint: process.env.USER_POOL_ID,
      healthCheck: async () => this._healthCheckCognito(),
      fallback: {
        type: 'cache',
        description: 'Use cached user data'
      },
      metrics: {
        maxThroughput: 50, // requests/second
        avgLatency: 200 // ms
      }
    });

    // SES Service
    this.registerService({
      name: 'SES',
      type: 'email',
      endpoint: 'email.us-east-2.amazonaws.com',
      healthCheck: async () => this._healthCheckSES(),
      fallback: {
        type: 'queue',
        description: 'Queue emails for later delivery'
      },
      metrics: {
        maxThroughput: 14, // emails/second
        avgLatency: 300 // ms
      }
    });
  }

  /**
   * Register a service
   */
  registerService(serviceConfig) {
    const service = {
      name: serviceConfig.name,
      type: serviceConfig.type,
      endpoint: serviceConfig.endpoint,
      healthCheck: serviceConfig.healthCheck,
      fallback: serviceConfig.fallback,
      metrics: serviceConfig.metrics,
      registeredAt: new Date().toISOString()
    };

    this.services.set(serviceConfig.name, service);
    this.healthStatus.set(serviceConfig.name, {
      status: ServiceStatus.UNKNOWN,
      lastCheck: null,
      consecutiveFailures: 0,
      uptime: 100
    });

    this.logger.debug('Service registered', {
      name: serviceConfig.name,
      type: serviceConfig.type
    });
  }

  /**
   * Get service by name
   */
  getService(serviceName) {
    return this.services.get(serviceName);
  }

  /**
   * Get all services
   */
  getAllServices() {
    return Array.from(this.services.values());
  }

  /**
   * Get service status
   */
  getServiceStatus(serviceName) {
    return this.healthStatus.get(serviceName);
  }

  /**
   * Get all service statuses
   */
  getAllServiceStatuses() {
    const statuses = {};
    for (const [name, status] of this.healthStatus.entries()) {
      statuses[name] = status;
    }
    return statuses;
  }

  /**
   * Start periodic health checks
   */
  _startHealthChecks() {
    this.logger.info('Starting periodic health checks', {
      interval: this.config.healthCheckInterval
    });

    // Initial health check
    this._runHealthChecks();

    // Schedule periodic checks
    this.healthCheckTimer = setInterval(() => {
      this._runHealthChecks();
    }, this.config.healthCheckInterval);
  }

  /**
   * Stop health checks
   */
  stopHealthChecks() {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
      this.logger.info('Health checks stopped');
    }
  }

  /**
   * Run health checks for all services
   */
  async _runHealthChecks() {
    this.logger.debug('Running health checks for all services');

    const checks = [];
    for (const [name, service] of this.services.entries()) {
      checks.push(this._checkServiceHealth(name, service));
    }

    await Promise.allSettled(checks);
  }

  /**
   * Check health of a single service
   */
  async _checkServiceHealth(serviceName, service) {
    const startTime = Date.now();

    try {
      const result = await Promise.race([
        service.healthCheck(),
        this._timeout(this.config.healthCheckTimeout)
      ]);

      const latency = Date.now() - startTime;
      const currentStatus = this.healthStatus.get(serviceName);

      // Determine status based on latency
      let status = ServiceStatus.AVAILABLE;
      if (latency > service.metrics.avgLatency * 3) {
        status = ServiceStatus.DEGRADED;
      }

      // Update health status
      this.healthStatus.set(serviceName, {
        status,
        lastCheck: new Date().toISOString(),
        consecutiveFailures: 0,
        latency,
        uptime: this._calculateUptime(serviceName, true),
        details: result
      });

      if (currentStatus.status !== status) {
        this.logger.info('Service status changed', {
          service: serviceName,
          from: currentStatus.status,
          to: status,
          latency: `${latency}ms`
        });
      }

    } catch (error) {
      const currentStatus = this.healthStatus.get(serviceName);
      const consecutiveFailures = (currentStatus.consecutiveFailures || 0) + 1;

      // Mark as unavailable after 3 consecutive failures
      const status = consecutiveFailures >= 3 
        ? ServiceStatus.UNAVAILABLE 
        : ServiceStatus.DEGRADED;

      this.healthStatus.set(serviceName, {
        status,
        lastCheck: new Date().toISOString(),
        consecutiveFailures,
        uptime: this._calculateUptime(serviceName, false),
        error: error.message
      });

      this.logger.error('Health check failed', {
        service: serviceName,
        error: error.message,
        consecutiveFailures
      });
    }
  }

  /**
   * Calculate service uptime percentage
   */
  _calculateUptime(serviceName, success) {
    const status = this.healthStatus.get(serviceName);
    if (!status) return 100;

    const currentUptime = status.uptime || 100;
    // Exponential moving average: 95% weight to history, 5% to current check
    return success 
      ? currentUptime * 0.95 + 100 * 0.05
      : currentUptime * 0.95;
  }

  /**
   * Timeout helper
   */
  _timeout(ms) {
    return new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Health check timeout')), ms)
    );
  }

  // ============================================
  // HEALTH CHECK IMPLEMENTATIONS
  // ============================================

  /**
   * SNS Health Check
   */
  async _healthCheckSNS() {
    // Test SNS by checking topic attributes (lightweight operation)
    // Note: In production, you'd use SNS.getTopicAttributes
    const ambassadorHealth = this.ambassador.getServiceHealth('sns');
    return {
      available: ambassadorHealth.circuitBreaker.state !== 'OPEN',
      circuitBreaker: ambassadorHealth.circuitBreaker.state
    };
  }

  /**
   * DynamoDB Health Check
   */
  async _healthCheckDynamoDB() {
    // Test DynamoDB by checking a system table
    try {
      const tableName = process.env.ACTIVITY_LOGS_TABLE || 'system-health';
      await this.ambassador.dynamoQuery(
        tableName,
        {
          expression: 'id = :id',
          names: {},
          values: { ':id': 'health-check' }
        },
        { 
          limit: 1,
          cacheable: false 
        }
      );
      return { available: true };
    } catch (error) {
      // Table not found is OK for health check
      if (error.name === 'ResourceNotFoundException') {
        return { available: true, note: 'Table access verified' };
      }
      throw error;
    }
  }

  /**
   * Cognito Health Check
   */
  async _healthCheckCognito() {
    const ambassadorHealth = this.ambassador.getServiceHealth('cognito');
    return {
      available: ambassadorHealth.circuitBreaker.state !== 'OPEN',
      circuitBreaker: ambassadorHealth.circuitBreaker.state
    };
  }

  /**
   * SES Health Check
   */
  async _healthCheckSES() {
    const ambassadorHealth = this.ambassador.getServiceHealth('ses');
    return {
      available: ambassadorHealth.circuitBreaker.state !== 'OPEN',
      circuitBreaker: ambassadorHealth.circuitBreaker.state,
      quota: 'Check via AWS console'
    };
  }

  /**
   * Get fallback strategy for a service
   */
  getFallbackStrategy(serviceName) {
    const service = this.services.get(serviceName);
    return service ? service.fallback : null;
  }

  /**
   * Check if service is available
   */
  isServiceAvailable(serviceName) {
    const status = this.healthStatus.get(serviceName);
    return status && status.status === ServiceStatus.AVAILABLE;
  }

  /**
   * Get service metrics
   */
  getServiceMetrics(serviceName) {
    const service = this.services.get(serviceName);
    const status = this.healthStatus.get(serviceName);

    if (!service || !status) {
      return null;
    }

    return {
      name: serviceName,
      type: service.type,
      status: status.status,
      uptime: status.uptime,
      lastCheck: status.lastCheck,
      latency: status.latency,
      expectedLatency: service.metrics.avgLatency,
      maxThroughput: service.metrics.maxThroughput
    };
  }

  /**
   * Get overall system health
   */
  getSystemHealth() {
    const services = Array.from(this.healthStatus.entries());
    
    const available = services.filter(([_, status]) => 
      status.status === ServiceStatus.AVAILABLE
    ).length;

    const degraded = services.filter(([_, status]) => 
      status.status === ServiceStatus.DEGRADED
    ).length;

    const unavailable = services.filter(([_, status]) => 
      status.status === ServiceStatus.UNAVAILABLE
    ).length;

    let overallStatus = 'HEALTHY';
    if (unavailable > 0) {
      overallStatus = 'CRITICAL';
    } else if (degraded > 0) {
      overallStatus = 'DEGRADED';
    }

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      services: {
        total: services.length,
        available,
        degraded,
        unavailable
      },
      details: this.getAllServiceStatuses()
    };
  }
}

// Singleton instance
let registryInstance = null;

/**
 * Get ServiceRegistry singleton
 */
function getServiceRegistry(config = {}) {
  if (!registryInstance) {
    registryInstance = new ServiceRegistry(config);
  }
  return registryInstance;
}

/**
 * Reset registry (for testing)
 */
function resetServiceRegistry() {
  if (registryInstance) {
    registryInstance.stopHealthChecks();
    registryInstance = null;
  }
}

module.exports = {
  ServiceRegistry,
  getServiceRegistry,
  resetServiceRegistry,
  ServiceStatus
};
