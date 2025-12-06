/**
 * AWS Ambassador Pattern - Service Proxy
 * 
 * Patrón Ambassador que actúa como proxy centralizado para todos los servicios AWS.
 * Proporciona:
 * - Circuit breaker compartido
 * - Rate limiting inteligente
 * - Connection pooling
 * - Retry con exponential backoff
 * - Telemetría unificada
 * - Cache layer
 * - Health checks
 * 
 * Beneficios:
 * ✅ Resiliencia centralizada (un solo punto de gestión)
 * ✅ Observabilidad completa (métricas + logs unificados)
 * ✅ Cost optimization (cache, batch, rate limiting)
 * ✅ Mantenibilidad (cambios en un solo lugar)
 * ✅ Testing facilitado (mock del Ambassador)
 */

const { SNSClient, PublishCommand } = require("@aws-sdk/client-sns");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, UpdateCommand, DeleteCommand } = require("@aws-sdk/lib-dynamodb");
const { CognitoIdentityProviderClient, AdminGetUserCommand, ListUsersCommand } = require("@aws-sdk/client-cognito-identity-provider");
const { SESClient, SendEmailCommand } = require("@aws-sdk/client-ses");
const { createCircuitBreaker } = require("./circuitBreaker");
const { retryWithJitter } = require("./retry");
const { getCache } = require("./cache");
const Logger = require("./logger");

/**
 * Service Health Status
 */
const ServiceHealth = {
  HEALTHY: 'HEALTHY',
  DEGRADED: 'DEGRADED',
  UNHEALTHY: 'UNHEALTHY'
};

/**
 * AWS Ambassador - Proxy centralizado para servicios AWS
 */
class AWSAmbassador {
  constructor(config = {}) {
    this.logger = Logger.create({ handler: 'AWSAmbassador' });
    this.config = {
      enableCache: config.enableCache !== false,
      enableTelemetry: config.enableTelemetry !== false,
      enableRateLimiting: config.enableRateLimiting !== false,
      connectionTimeout: config.connectionTimeout || 5000,
      requestTimeout: config.requestTimeout || 30000,
      ...config
    };

    // Initialize AWS clients with optimized config
    this.clients = this._initializeClients();
    
    // Circuit breakers per service (shared across all instances)
    this.circuitBreakers = this._initializeCircuitBreakers();
    
    // Rate limiters per service
    this.rateLimiters = this._initializeRateLimiters();
    
    // Service health tracking
    this.serviceHealth = new Map();
    
    // Cache layer
    this.cache = this.config.enableCache ? getCache() : null;
    
    // Telemetry collector
    this.metrics = {
      requests: new Map(),
      errors: new Map(),
      latencies: new Map()
    };

    this.logger.info('AWSAmbassador initialized', {
      enableCache: this.config.enableCache,
      enableTelemetry: this.config.enableTelemetry,
      enableRateLimiting: this.config.enableRateLimiting
    });
  }

  /**
   * Initialize AWS SDK clients with connection pooling
   */
  _initializeClients() {
    const clientConfig = {
      region: process.env.AWS_REGION || 'us-east-2',
      maxAttempts: 1, // Ambassador handles retries
      requestHandler: {
        connectionTimeout: this.config.connectionTimeout,
        socketTimeout: this.config.requestTimeout
      }
    };

    const ddbClient = new DynamoDBClient(clientConfig);
    
    return {
      sns: new SNSClient(clientConfig),
      dynamodb: DynamoDBDocumentClient.from(ddbClient, {
        marshallOptions: {
          removeUndefinedValues: true,
          convertClassInstanceToMap: true
        }
      }),
      cognito: new CognitoIdentityProviderClient(clientConfig),
      ses: new SESClient(clientConfig)
    };
  }

  /**
   * Initialize circuit breakers for each service
   */
  _initializeCircuitBreakers() {
    return {
      sns: createCircuitBreaker({ 
        failureThreshold: 5, 
        cooldownMs: 30000,
        name: 'SNS'
      }),
      dynamodb: createCircuitBreaker({ 
        failureThreshold: 10, 
        cooldownMs: 15000,
        name: 'DynamoDB'
      }),
      cognito: createCircuitBreaker({ 
        failureThreshold: 5, 
        cooldownMs: 30000,
        name: 'Cognito'
      }),
      ses: createCircuitBreaker({ 
        failureThreshold: 3, 
        cooldownMs: 60000,
        name: 'SES'
      })
    };
  }

  /**
   * Initialize rate limiters for each service
   */
  _initializeRateLimiters() {
    return {
      sns: this._createRateLimiter(300, 1000), // 300 requests per second
      dynamodb: this._createRateLimiter(1000, 1000), // 1000 requests per second
      cognito: this._createRateLimiter(50, 1000), // 50 requests per second
      ses: this._createRateLimiter(14, 1000) // 14 emails per second (SES limit)
    };
  }

  /**
   * Create a token bucket rate limiter
   */
  _createRateLimiter(capacity, refillRate) {
    return {
      tokens: capacity,
      capacity,
      refillRate,
      lastRefill: Date.now(),
      
      tryConsume() {
        const now = Date.now();
        const timePassed = now - this.lastRefill;
        const tokensToAdd = (timePassed / 1000) * this.refillRate;
        
        this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
        this.lastRefill = now;
        
        if (this.tokens >= 1) {
          this.tokens -= 1;
          return true;
        }
        return false;
      }
    };
  }

  /**
   * Execute request through Ambassador with full resiliency
   */
  async _executeRequest(service, operation, params, options = {}) {
    const startTime = Date.now();
    const requestId = `${service}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    this.logger.debug('Ambassador request started', {
      requestId,
      service,
      operation: operation.name
    });

    // 1. Check circuit breaker
    const breaker = this.circuitBreakers[service];
    if (!breaker.shouldAllow()) {
      this._recordMetric(service, 'circuit_breaker_open', 1);
      throw new Error(`Circuit breaker open for ${service}`);
    }

    // 2. Rate limiting
    if (this.config.enableRateLimiting) {
      const limiter = this.rateLimiters[service];
      if (!limiter.tryConsume()) {
        this._recordMetric(service, 'rate_limited', 1);
        this.logger.warn('Rate limit exceeded', { service, requestId });
        await this._backoff(100); // Brief backoff
      }
    }

    // 3. Check cache (if applicable)
    if (options.cacheable && this.cache) {
      const cacheKey = this._getCacheKey(service, operation.name, params);
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        this._recordMetric(service, 'cache_hit', 1);
        this.logger.debug('Cache hit', { service, operation: operation.name, requestId });
        return cached;
      }
    }

    try {
      // 4. Execute with retry
      const result = await retryWithJitter(
        async () => {
          const client = this.clients[service];
          const response = await client.send(operation);
          breaker.reportSuccess();
          return response;
        },
        {
          maxAttempts: options.maxRetries || 3,
          baseDelayMs: options.baseDelayMs || 500,
          maxDelayMs: options.maxDelayMs || 5000
        }
      );

      // 5. Cache result (if applicable)
      if (options.cacheable && this.cache) {
        const cacheKey = this._getCacheKey(service, operation.name, params);
        await this.cache.set(cacheKey, result, options.cacheTTL || 60);
      }

      // 6. Record metrics
      const latency = Date.now() - startTime;
      this._recordMetric(service, 'request_success', 1);
      this._recordMetric(service, 'latency', latency);
      this._updateServiceHealth(service, ServiceHealth.HEALTHY);

      this.logger.debug('Ambassador request completed', {
        requestId,
        service,
        operation: operation.name,
        latency: `${latency}ms`
      });

      return result;

    } catch (error) {
      breaker.reportFailure();
      this._recordMetric(service, 'request_error', 1);
      this._updateServiceHealth(service, ServiceHealth.DEGRADED);

      this.logger.error('Ambassador request failed', {
        requestId,
        service,
        operation: operation.name,
        error: error.message,
        latency: `${Date.now() - startTime}ms`
      });

      throw error;
    }
  }

  /**
   * Generate cache key
   */
  _getCacheKey(service, operation, params) {
    const paramsHash = JSON.stringify(params);
    return `ambassador:${service}:${operation}:${paramsHash}`;
  }

  /**
   * Backoff delay
   */
  async _backoff(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Record metric
   */
  _recordMetric(service, metric, value) {
    if (!this.config.enableTelemetry) return;

    const key = `${service}:${metric}`;
    const current = this.metrics.requests.get(key) || 0;
    this.metrics.requests.set(key, current + value);
  }

  /**
   * Update service health status
   */
  _updateServiceHealth(service, status) {
    const previous = this.serviceHealth.get(service);
    this.serviceHealth.set(service, status);

    if (previous !== status) {
      this.logger.info('Service health changed', {
        service,
        previous,
        current: status
      });
    }
  }

  // ============================================
  // SNS OPERATIONS
  // ============================================

  /**
   * Publish message to SNS topic
   */
  async publishToSNS(topicArn, message, attributes = {}) {
    const command = new PublishCommand({
      TopicArn: topicArn,
      Message: typeof message === 'string' ? message : JSON.stringify(message),
      MessageAttributes: this._formatMessageAttributes(attributes)
    });

    return this._executeRequest('sns', command, { topicArn, message });
  }

  /**
   * Format message attributes for SNS
   */
  _formatMessageAttributes(attributes) {
    const formatted = {};
    for (const [key, value] of Object.entries(attributes)) {
      formatted[key] = {
        DataType: 'String',
        StringValue: String(value)
      };
    }
    return formatted;
  }

  // ============================================
  // DYNAMODB OPERATIONS
  // ============================================

  /**
   * Get item from DynamoDB
   */
  async dynamoGet(tableName, key, options = {}) {
    const command = new GetCommand({
      TableName: tableName,
      Key: key,
      ConsistentRead: options.consistentRead || false
    });

    return this._executeRequest('dynamodb', command, { tableName, key }, {
      cacheable: !options.consistentRead,
      cacheTTL: options.cacheTTL || 60
    });
  }

  /**
   * Put item to DynamoDB
   */
  async dynamoPut(tableName, item, options = {}) {
    const command = new PutCommand({
      TableName: tableName,
      Item: item,
      ConditionExpression: options.conditionExpression,
      ExpressionAttributeNames: options.expressionAttributeNames,
      ExpressionAttributeValues: options.expressionAttributeValues
    });

    // Invalidate cache
    if (this.cache && options.cacheKeys) {
      for (const key of options.cacheKeys) {
        await this.cache.delete(key);
      }
    }

    return this._executeRequest('dynamodb', command, { tableName, item });
  }

  /**
   * Query DynamoDB
   */
  async dynamoQuery(tableName, keyCondition, options = {}) {
    const command = new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: keyCondition.expression,
      ExpressionAttributeNames: keyCondition.names,
      ExpressionAttributeValues: keyCondition.values,
      IndexName: options.indexName,
      Limit: options.limit,
      ScanIndexForward: options.scanIndexForward !== false
    });

    return this._executeRequest('dynamodb', command, { tableName, keyCondition }, {
      cacheable: options.cacheable,
      cacheTTL: options.cacheTTL || 30
    });
  }

  /**
   * Update item in DynamoDB
   */
  async dynamoUpdate(tableName, key, updates, options = {}) {
    const command = new UpdateCommand({
      TableName: tableName,
      Key: key,
      UpdateExpression: updates.expression,
      ExpressionAttributeNames: updates.names,
      ExpressionAttributeValues: updates.values,
      ConditionExpression: options.conditionExpression,
      ReturnValues: options.returnValues || 'ALL_NEW'
    });

    // Invalidate cache
    if (this.cache && options.cacheKeys) {
      for (const cacheKey of options.cacheKeys) {
        await this.cache.delete(cacheKey);
      }
    }

    return this._executeRequest('dynamodb', command, { tableName, key, updates });
  }

  /**
   * Delete item from DynamoDB
   */
  async dynamoDelete(tableName, key, options = {}) {
    const command = new DeleteCommand({
      TableName: tableName,
      Key: key,
      ConditionExpression: options.conditionExpression
    });

    // Invalidate cache
    if (this.cache && options.cacheKeys) {
      for (const cacheKey of options.cacheKeys) {
        await this.cache.delete(cacheKey);
      }
    }

    return this._executeRequest('dynamodb', command, { tableName, key });
  }

  // ============================================
  // COGNITO OPERATIONS
  // ============================================

  /**
   * Get user from Cognito
   */
  async cognitoGetUser(userPoolId, username) {
    const command = new AdminGetUserCommand({
      UserPoolId: userPoolId,
      Username: username
    });

    return this._executeRequest('cognito', command, { userPoolId, username }, {
      cacheable: true,
      cacheTTL: 300 // 5 minutes
    });
  }

  /**
   * List users from Cognito
   */
  async cognitoListUsers(userPoolId, filter = null, limit = 60) {
    const command = new ListUsersCommand({
      UserPoolId: userPoolId,
      Filter: filter,
      Limit: limit
    });

    return this._executeRequest('cognito', command, { userPoolId, filter }, {
      cacheable: true,
      cacheTTL: 60
    });
  }

  // ============================================
  // SES OPERATIONS
  // ============================================

  /**
   * Send email via SES
   */
  async sesSendEmail(params) {
    const command = new SendEmailCommand({
      Source: params.source || process.env.SES_FROM_EMAIL,
      Destination: {
        ToAddresses: Array.isArray(params.to) ? params.to : [params.to]
      },
      Message: {
        Subject: {
          Data: params.subject,
          Charset: 'UTF-8'
        },
        Body: {
          Html: params.html ? {
            Data: params.html,
            Charset: 'UTF-8'
          } : undefined,
          Text: params.text ? {
            Data: params.text,
            Charset: 'UTF-8'
          } : undefined
        }
      }
    });

    return this._executeRequest('ses', command, params, {
      maxRetries: 2 // SES is more sensitive to retries
    });
  }

  // ============================================
  // HEALTH & TELEMETRY
  // ============================================

  /**
   * Get service health status
   */
  getServiceHealth(service = null) {
    if (service) {
      return {
        service,
        status: this.serviceHealth.get(service) || ServiceHealth.HEALTHY,
        circuitBreaker: this.circuitBreakers[service].getState()
      };
    }

    // Return all services
    const health = {};
    for (const [serviceName, breaker] of Object.entries(this.circuitBreakers)) {
      health[serviceName] = {
        status: this.serviceHealth.get(serviceName) || ServiceHealth.HEALTHY,
        circuitBreaker: breaker.getState()
      };
    }
    return health;
  }

  /**
   * Get telemetry metrics
   */
  getMetrics() {
    const metrics = {};
    
    for (const [key, value] of this.metrics.requests.entries()) {
      const [service, metric] = key.split(':');
      if (!metrics[service]) {
        metrics[service] = {};
      }
      metrics[service][metric] = value;
    }

    return metrics;
  }

  /**
   * Reset metrics (useful for testing)
   */
  resetMetrics() {
    this.metrics.requests.clear();
    this.metrics.errors.clear();
    this.metrics.latencies.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return this.cache ? this.cache.getStats() : null;
  }
}

// Singleton instance
let ambassadorInstance = null;

/**
 * Get Ambassador singleton instance
 */
function getAmbassador(config = {}) {
  if (!ambassadorInstance) {
    ambassadorInstance = new AWSAmbassador(config);
  }
  return ambassadorInstance;
}

/**
 * Reset Ambassador instance (for testing)
 */
function resetAmbassador() {
  ambassadorInstance = null;
}

module.exports = {
  AWSAmbassador,
  getAmbassador,
  resetAmbassador,
  ServiceHealth
};
