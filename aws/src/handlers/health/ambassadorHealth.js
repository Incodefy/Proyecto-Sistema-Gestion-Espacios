/**
 * Ambassador Health Check Endpoint
 * 
 * Lambda expuesta via API Gateway para monitorizar:
 * - Estado de servicios AWS (SNS, DynamoDB, Cognito, SES)
 * - Métricas de telemetría (latencia, errores, costos)
 * - Estado de circuit breakers
 * - Cache stats
 * - Insights automáticos
 * 
 * Rutas:
 * - GET /health/ambassador - Health general de todos los servicios
 * - GET /health/ambassador/metrics - Métricas detalladas
 * - GET /health/ambassador/insights - Insights y alertas
 * 
 * Response format:
 * {
 *   status: "healthy|degraded|unhealthy",
 *   timestamp: "2024-01-01T00:00:00.000Z",
 *   services: { sns: {...}, dynamodb: {...}, ... },
 *   metrics: { requests: X, errors: Y, ... },
 *   insights: [...]
 * }
 */

const { getAmbassador } = require("../../utils/awsAmbassador");
const { getServiceRegistry } = require("../../utils/serviceRegistry");
const { getTelemetryCollector } = require("../../utils/telemetryCollector");
const Logger = require("../../utils/logger");
const { successResponse, errorResponse } = require("../../utils/response");

const ambassador = getAmbassador();
const serviceRegistry = getServiceRegistry();
const telemetryCollector = getTelemetryCollector();
const logger = Logger.create({ handler: 'AmbassadorHealth' });

/**
 * Handler principal para health check completo
 */
exports.getHealth = async (event) => {
  logger.info('Health check requested');

  try {
    // Obtener system health desde ServiceRegistry
    const systemHealth = serviceRegistry.getSystemHealth();
    
    // Obtener métricas desde Ambassador
    const metrics = ambassador.getMetrics();
    
    // Obtener cache stats
    const cacheStats = ambassador.getCacheStats();
    
    // Determinar status global
    const status = systemHealth.overallStatus.toLowerCase();
    
    const response = {
      status,
      timestamp: new Date().toISOString(),
      system: {
        totalServices: systemHealth.totalServices,
        healthyServices: systemHealth.healthyServices,
        degradedServices: systemHealth.degradedServices,
        unavailableServices: systemHealth.unavailableServices,
        overallStatus: systemHealth.overallStatus
      },
      services: systemHealth.services,
      metrics: {
        requests: metrics.requests,
        errors: metrics.errors,
        errorRate: metrics.errorRate,
        uptime: metrics.uptime
      },
      cache: cacheStats
    };

    logger.info('Health check completed', { status });

    return successResponse(response, 200);

  } catch (error) {
    logger.error('Health check failed', error);
    return errorResponse('Health check failed', 500, { error: error.message });
  }
};

/**
 * Handler para métricas detalladas (telemetry)
 */
exports.getMetrics = async (event) => {
  logger.info('Metrics requested');

  try {
    // Obtener todas las métricas de telemetría
    const allMetrics = telemetryCollector.getAllMetrics();
    
    // Obtener stats por servicio
    const serviceStats = {
      sns: telemetryCollector.getServiceStats('sns'),
      dynamodb: telemetryCollector.getServiceStats('dynamodb'),
      cognito: telemetryCollector.getServiceStats('cognito'),
      ses: telemetryCollector.getServiceStats('ses')
    };

    const response = {
      timestamp: new Date().toISOString(),
      summary: allMetrics,
      services: serviceStats,
      totalRequests: Object.values(serviceStats).reduce((sum, s) => sum + s.requests, 0),
      totalErrors: Object.values(serviceStats).reduce((sum, s) => sum + s.errors, 0),
      averageLatency: calculateAverageLatency(serviceStats),
      estimatedCost: Object.values(serviceStats).reduce((sum, s) => sum + s.cost, 0)
    };

    logger.info('Metrics retrieved', {
      totalRequests: response.totalRequests,
      totalErrors: response.totalErrors
    });

    return successResponse(response, 200);

  } catch (error) {
    logger.error('Metrics retrieval failed', error);
    return errorResponse('Metrics retrieval failed', 500, { error: error.message });
  }
};

/**
 * Handler para insights automáticos
 */
exports.getInsights = async (event) => {
  logger.info('Insights requested');

  try {
    const insights = telemetryCollector.getInsights();
    
    const response = {
      timestamp: new Date().toISOString(),
      totalInsights: insights.length,
      insights: insights.map(insight => ({
        type: insight.type,
        severity: insight.severity,
        message: insight.message,
        service: insight.service,
        details: insight.details,
        timestamp: insight.timestamp
      }))
    };

    logger.info('Insights retrieved', { count: insights.length });

    return successResponse(response, 200);

  } catch (error) {
    logger.error('Insights retrieval failed', error);
    return errorResponse('Insights retrieval failed', 500, { error: error.message });
  }
};

/**
 * Handler para service-specific health check
 */
exports.getServiceHealth = async (event) => {
  const serviceName = event.pathParameters?.service;

  if (!serviceName) {
    return errorResponse('Service name required', 400);
  }

  logger.info('Service health check requested', { service: serviceName });

  try {
    const serviceStatus = serviceRegistry.getServiceStatus(serviceName);
    const serviceHealth = ambassador.getServiceHealth(serviceName);

    if (!serviceStatus) {
      return errorResponse('Service not found', 404);
    }

    const response = {
      service: serviceName,
      status: serviceStatus.status,
      timestamp: new Date().toISOString(),
      health: {
        lastCheck: serviceStatus.lastCheck,
        consecutiveFailures: serviceStatus.consecutiveFailures,
        uptime: serviceStatus.uptime,
        isHealthy: serviceStatus.isHealthy
      },
      metrics: serviceHealth,
      circuitBreaker: {
        state: serviceHealth.circuitBreaker?.state || 'UNKNOWN',
        failures: serviceHealth.circuitBreaker?.failures || 0
      }
    };

    logger.info('Service health retrieved', { service: serviceName, status: serviceStatus.status });

    return successResponse(response, 200);

  } catch (error) {
    logger.error('Service health check failed', error, { service: serviceName });
    return errorResponse('Service health check failed', 500, { error: error.message });
  }
};

/**
 * Handler para reset de métricas (admin only)
 */
exports.resetMetrics = async (event) => {
  logger.warn('Metrics reset requested');

  try {
    // Verificar autorización (requiere admin)
    const userRole = event.requestContext?.authorizer?.claims?.['custom:role'];
    
    if (userRole !== 'ADMIN') {
      return errorResponse('Unauthorized - Admin role required', 403);
    }

    // Reset metrics en TelemetryCollector
    telemetryCollector.resetMetrics();

    logger.info('Metrics reset successfully');

    return successResponse({
      message: 'Metrics reset successfully',
      timestamp: new Date().toISOString()
    }, 200);

  } catch (error) {
    logger.error('Metrics reset failed', error);
    return errorResponse('Metrics reset failed', 500, { error: error.message });
  }
};

/**
 * Calcula latencia promedio ponderada
 */
function calculateAverageLatency(serviceStats) {
  let totalLatency = 0;
  let totalRequests = 0;

  for (const stats of Object.values(serviceStats)) {
    if (stats.requests > 0) {
      totalLatency += stats.latency.p50 * stats.requests;
      totalRequests += stats.requests;
    }
  }

  return totalRequests > 0 ? Math.round(totalLatency / totalRequests) : 0;
}

/**
 * CloudWatch Alarm Integration
 * Publica métricas custom a CloudWatch para alarmas
 */
exports.publishHealthMetrics = async () => {
  logger.info('Publishing health metrics to CloudWatch');

  try {
    const systemHealth = serviceRegistry.getSystemHealth();
    const allMetrics = telemetryCollector.getAllMetrics();

    // CloudWatch ya recibe métricas desde TelemetryCollector
    // Este endpoint solo confirma el estado
    
    logger.info('Health metrics published', {
      healthyServices: systemHealth.healthyServices,
      totalRequests: allMetrics.requests
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Health metrics published',
        timestamp: new Date().toISOString()
      })
    };

  } catch (error) {
    logger.error('Failed to publish health metrics', error);
    throw error;
  }
};
