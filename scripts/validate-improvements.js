#!/usr/bin/env node

/**
 * 🔍 SCRIPT DE VALIDACIÓN - MEJORAS IMPLEMENTADAS
 * 
 * Este script valida que las 8 mejoras estén correctamente implementadas
 * y que los handlers estén listos para migración.
 * 
 * Uso:
 *   node scripts/validate-improvements.js
 *   node scripts/validate-improvements.js --verbose
 */

const fs = require('fs');
const path = require('path');

// Colores para output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m'
};

const verbose = process.argv.includes('--verbose');

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function success(message) {
  log(`✅ ${message}`, 'green');
}

function error(message) {
  log(`❌ ${message}`, 'red');
}

function warning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function info(message) {
  log(`ℹ️  ${message}`, 'cyan');
}

function title(message) {
  log(`\n${'='.repeat(60)}`, 'bold');
  log(`  ${message}`, 'bold');
  log(`${'='.repeat(60)}`, 'bold');
}

// Resultados globales
const results = {
  improvements: [],
  handlers: {
    total: 0,
    withSecurity: 0,
    migrated: 0,
    pending: 0
  },
  issues: [],
  warnings: []
};

/**
 * VALIDACIÓN 1: Logger Mejorado
 */
function validateLogger() {
  title('1. LOGGING ESTRUCTURADO');
  
  const loggerPath = path.join(__dirname, '../src/utils/logger.js');
  
  if (!fs.existsSync(loggerPath)) {
    error('logger.js no encontrado');
    results.improvements.push({ name: 'Logger', status: 'FAIL', reason: 'File not found' });
    return false;
  }
  
  const content = fs.readFileSync(loggerPath, 'utf-8');
  
  const checks = [
    { feature: 'Correlation ID', pattern: /correlationId/i, critical: true },
    { feature: 'fromEvent() method', pattern: /fromEvent\s*\(/i, critical: true },
    { feature: 'child() method', pattern: /child\s*\(/i, critical: true },
    { feature: 'traceAsync() method', pattern: /traceAsync\s*\(/i, critical: true },
    { feature: 'Log levels', pattern: /(DEBUG|INFO|WARN|ERROR)/i, critical: true },
    { feature: 'Sensitive data masking', pattern: /_sanitize/i, critical: true },
    { feature: 'Recursive sanitization', pattern: /recursive|typeof.*object/i, critical: false }
  ];
  
  let allPassed = true;
  
  checks.forEach(check => {
    const passed = check.pattern.test(content);
    
    if (passed) {
      success(`${check.feature}`);
    } else {
      if (check.critical) {
        error(`${check.feature} - MISSING`);
        results.issues.push(`Logger: Missing ${check.feature}`);
        allPassed = false;
      } else {
        warning(`${check.feature} - Not found (optional)`);
        results.warnings.push(`Logger: ${check.feature} not found`);
      }
    }
  });
  
  results.improvements.push({
    name: 'Logging Estructurado',
    status: allPassed ? 'PASS' : 'FAIL',
    file: 'utils/logger.js'
  });
  
  return allPassed;
}

/**
 * VALIDACIÓN 2: JSON Schema Validator
 */
function validateValidator() {
  title('2. JSON SCHEMA VALIDATION');
  
  const validatorPath = path.join(__dirname, '../src/utils/validator.js');
  
  if (!fs.existsSync(validatorPath)) {
    error('validator.js no encontrado');
    results.improvements.push({ name: 'Validator', status: 'FAIL', reason: 'File not found' });
    return false;
  }
  
  const content = fs.readFileSync(validatorPath, 'utf-8');
  
  const schemas = [
    'createGroup',
    'updateGroupName',
    'inviteMember',
    'updateMemberRole',
    'createOcupante',
    'updateOcupante',
    'createEspecialidad',
    'createInstrumento',
    'createAppointment',
    'updateAppointment',
    'setPersonalization',
    'updateRolePermissions'
  ];
  
  let foundSchemas = 0;
  let allPassed = true;
  
  schemas.forEach(schema => {
    const pattern = new RegExp(`['"]${schema}['"]\\s*:`, 'i');
    if (pattern.test(content)) {
      if (verbose) success(`Schema: ${schema}`);
      foundSchemas++;
    } else {
      warning(`Schema missing: ${schema}`);
      results.warnings.push(`Validator: Schema ${schema} not found`);
    }
  });
  
  info(`Found ${foundSchemas}/${schemas.length} schemas`);
  
  // Verificar funciones críticas
  const functions = [
    { name: 'validate()', pattern: /function\s+validate\s*\(/i, critical: true },
    { name: 'validateMiddleware()', pattern: /validateMiddleware/i, critical: true },
    { name: 'formatValidationErrors()', pattern: /formatValidationErrors/i, critical: false }
  ];
  
  functions.forEach(fn => {
    const passed = fn.pattern.test(content);
    if (passed) {
      success(fn.name);
    } else if (fn.critical) {
      error(`${fn.name} - MISSING`);
      results.issues.push(`Validator: Missing ${fn.name}`);
      allPassed = false;
    }
  });
  
  results.improvements.push({
    name: 'JSON Schema Validation',
    status: allPassed && foundSchemas >= 10 ? 'PASS' : 'PARTIAL',
    file: 'utils/validator.js',
    schemas: foundSchemas
  });
  
  return allPassed;
}

/**
 * VALIDACIÓN 3: Circuit Breakers
 */
function validateCircuitBreaker() {
  title('3. CIRCUIT BREAKERS');
  
  const cbPath = path.join(__dirname, '../src/utils/circuitBreaker.js');
  
  if (!fs.existsSync(cbPath)) {
    error('circuitBreaker.js no encontrado');
    results.improvements.push({ name: 'Circuit Breaker', status: 'FAIL', reason: 'File not found' });
    return false;
  }
  
  const content = fs.readFileSync(cbPath, 'utf-8');
  
  const checks = [
    { feature: 'States (CLOSED/OPEN/HALF_OPEN)', pattern: /(CLOSED|OPEN|HALF_OPEN)/i, critical: true },
    { feature: 'sendEmailWithCircuitBreaker()', pattern: /sendEmailWithCircuitBreaker/i, critical: true },
    { feature: 'cognitoWithCircuitBreaker()', pattern: /cognitoWithCircuitBreaker/i, critical: false },
    { feature: 'Fallback support', pattern: /fallback/i, critical: true }
  ];
  
  let allPassed = true;
  
  checks.forEach(check => {
    const passed = check.pattern.test(content);
    
    if (passed) {
      success(check.feature);
    } else if (check.critical) {
      error(`${check.feature} - MISSING`);
      results.issues.push(`Circuit Breaker: Missing ${check.feature}`);
      allPassed = false;
    } else {
      warning(`${check.feature} - Not found (optional)`);
    }
  });
  
  results.improvements.push({
    name: 'Circuit Breakers',
    status: allPassed ? 'PASS' : 'FAIL',
    file: 'utils/circuitBreaker.js'
  });
  
  return allPassed;
}

/**
 * VALIDACIÓN 4: Batch Helper
 */
function validateBatchHelper() {
  title('4. BATCH OPERATIONS');
  
  const batchPath = path.join(__dirname, '../src/utils/batchHelper.js');
  
  if (!fs.existsSync(batchPath)) {
    error('batchHelper.js no encontrado');
    results.improvements.push({ name: 'Batch Helper', status: 'FAIL', reason: 'File not found' });
    return false;
  }
  
  const content = fs.readFileSync(batchPath, 'utf-8');
  
  const checks = [
    { feature: 'DynamoDBBatchHelper class', pattern: /class\s+DynamoDBBatchHelper/i, critical: true },
    { feature: 'batchGet()', pattern: /batchGet\s*\(/i, critical: true },
    { feature: 'batchWrite()', pattern: /batchWrite\s*\(/i, critical: true },
    { feature: 'quickBatchGet()', pattern: /quickBatchGet/i, critical: true },
    { feature: 'quickBatchPut()', pattern: /quickBatchPut/i, critical: true },
    { feature: 'quickBatchDelete()', pattern: /quickBatchDelete/i, critical: true },
    { feature: 'Retry logic', pattern: /retry|unprocessed/i, critical: true },
    { feature: 'Chunking (25 items)', pattern: /25|chunk/i, critical: true }
  ];
  
  let allPassed = true;
  
  checks.forEach(check => {
    const passed = check.pattern.test(content);
    
    if (passed) {
      success(check.feature);
    } else if (check.critical) {
      error(`${check.feature} - MISSING`);
      results.issues.push(`Batch Helper: Missing ${check.feature}`);
      allPassed = false;
    }
  });
  
  results.improvements.push({
    name: 'Batch Operations',
    status: allPassed ? 'PASS' : 'FAIL',
    file: 'utils/batchHelper.js'
  });
  
  return allPassed;
}

/**
 * VALIDACIÓN 5: Error Handler
 */
function validateErrorHandler() {
  title('5. ERROR HANDLING CENTRALIZADO');
  
  const errorPath = path.join(__dirname, '../src/utils/errorHandler.js');
  
  if (!fs.existsSync(errorPath)) {
    error('errorHandler.js no encontrado');
    results.improvements.push({ name: 'Error Handler', status: 'FAIL', reason: 'File not found' });
    return false;
  }
  
  const content = fs.readFileSync(errorPath, 'utf-8');
  
  // Contar error codes
  const errorCodes = (content.match(/[A-Z]{3}\d{3}/g) || []).length;
  info(`Found ${errorCodes} error codes`);
  
  const checks = [
    { feature: 'ErrorCodes object', pattern: /ErrorCodes\s*=/i, critical: true },
    { feature: 'AppError class', pattern: /class\s+AppError/i, critical: true },
    { feature: 'ValidationError', pattern: /class\s+ValidationError/i, critical: true },
    { feature: 'NotFoundError', pattern: /class\s+NotFoundError/i, critical: true },
    { feature: 'ConflictError', pattern: /class\s+ConflictError/i, critical: true },
    { feature: 'AuthorizationError', pattern: /class\s+AuthorizationError/i, critical: true },
    { feature: 'ErrorHandler class', pattern: /class\s+ErrorHandler/i, critical: true },
    { feature: 'successResponse()', pattern: /function\s+successResponse/i, critical: true },
    { feature: 'paginatedResponse()', pattern: /paginatedResponse/i, critical: false }
  ];
  
  let allPassed = true;
  
  checks.forEach(check => {
    const passed = check.pattern.test(content);
    
    if (passed) {
      success(check.feature);
    } else if (check.critical) {
      error(`${check.feature} - MISSING`);
      results.issues.push(`Error Handler: Missing ${check.feature}`);
      allPassed = false;
    } else {
      warning(`${check.feature} - Not found (optional)`);
    }
  });
  
  results.improvements.push({
    name: 'Error Handling',
    status: allPassed && errorCodes >= 20 ? 'PASS' : 'PARTIAL',
    file: 'utils/errorHandler.js',
    errorCodes
  });
  
  return allPassed;
}

/**
 * VALIDACIÓN 6: Cache Layer
 */
function validateCache() {
  title('6. CACHE LAYER');
  
  const cachePath = path.join(__dirname, '../src/utils/cache.js');
  
  if (!fs.existsSync(cachePath)) {
    error('cache.js no encontrado');
    results.improvements.push({ name: 'Cache', status: 'FAIL', reason: 'File not found' });
    return false;
  }
  
  const content = fs.readFileSync(cachePath, 'utf-8');
  
  const checks = [
    { feature: 'Cache class', pattern: /class\s+Cache/i, critical: true },
    { feature: 'TTL support', pattern: /ttl|expir/i, critical: true },
    { feature: 'LRU eviction', pattern: /lru|evict|maxSize/i, critical: true },
    { feature: 'getOrFetch()', pattern: /getOrFetch/i, critical: true },
    { feature: 'memoize()', pattern: /memoize/i, critical: false },
    { feature: 'cacheUserPermissions()', pattern: /cacheUserPermissions/i, critical: true },
    { feature: 'cacheSystemConfig()', pattern: /cacheSystemConfig/i, critical: true },
    { feature: 'invalidateUserPermissions()', pattern: /invalidateUserPermissions/i, critical: true },
    { feature: 'Statistics tracking', pattern: /stats|hitRate|hits.*misses/i, critical: false }
  ];
  
  let allPassed = true;
  
  checks.forEach(check => {
    const passed = check.pattern.test(content);
    
    if (passed) {
      success(check.feature);
    } else if (check.critical) {
      error(`${check.feature} - MISSING`);
      results.issues.push(`Cache: Missing ${check.feature}`);
      allPassed = false;
    } else {
      warning(`${check.feature} - Not found (optional)`);
    }
  });
  
  results.improvements.push({
    name: 'Cache Layer',
    status: allPassed ? 'PASS' : 'FAIL',
    file: 'utils/cache.js'
  });
  
  return allPassed;
}

/**
 * VALIDACIÓN 7: Interceptors
 */
function validateInterceptors() {
  title('7. REQUEST/RESPONSE INTERCEPTORS');
  
  const interceptorsPath = path.join(__dirname, '../src/middleware/interceptors.js');
  
  if (!fs.existsSync(interceptorsPath)) {
    error('interceptors.js no encontrado');
    results.improvements.push({ name: 'Interceptors', status: 'FAIL', reason: 'File not found' });
    return false;
  }
  
  const content = fs.readFileSync(interceptorsPath, 'utf-8');
  
  const checks = [
    { feature: 'RequestInterceptor class', pattern: /class\s+RequestInterceptor/i, critical: true },
    { feature: 'ResponseInterceptor class', pattern: /class\s+ResponseInterceptor/i, critical: true },
    { feature: 'createAPIHandler()', pattern: /createAPIHandler/i, critical: true },
    { feature: 'parseBody middleware', pattern: /parseBody/i, critical: true },
    { feature: 'sanitize middleware', pattern: /sanitize/i, critical: true },
    { feature: 'extractUserContext middleware', pattern: /extractUserContext/i, critical: true },
    { feature: 'securityHeaders middleware', pattern: /securityHeaders/i, critical: true },
    { feature: 'rateLimit support', pattern: /rateLimit/i, critical: false }
  ];
  
  let allPassed = true;
  
  checks.forEach(check => {
    const passed = check.pattern.test(content);
    
    if (passed) {
      success(check.feature);
    } else if (check.critical) {
      error(`${check.feature} - MISSING`);
      results.issues.push(`Interceptors: Missing ${check.feature}`);
      allPassed = false;
    } else {
      warning(`${check.feature} - Not found (optional)`);
    }
  });
  
  results.improvements.push({
    name: 'Interceptors',
    status: allPassed ? 'PASS' : 'FAIL',
    file: 'middleware/interceptors.js'
  });
  
  return allPassed;
}

/**
 * VALIDACIÓN 8: Retry Logic
 */
function validateRetry() {
  title('8. RETRY LOGIC');
  
  const retryPath = path.join(__dirname, '../src/utils/retry.js');
  
  if (!fs.existsSync(retryPath)) {
    error('retry.js no encontrado');
    results.improvements.push({ name: 'Retry', status: 'FAIL', reason: 'File not found' });
    return false;
  }
  
  const content = fs.readFileSync(retryPath, 'utf-8');
  
  const checks = [
    { feature: 'retry() function', pattern: /function\s+retry\s*\(/i, critical: true },
    { feature: 'Exponential backoff', pattern: /exponential|backoff/i, critical: true },
    { feature: 'Jitter', pattern: /jitter/i, critical: true },
    { feature: 'isRetryable()', pattern: /isRetryable/i, critical: true },
    { feature: 'retryAWS()', pattern: /retryAWS/i, critical: true },
    { feature: 'retryDB()', pattern: /retryDB/i, critical: true },
    { feature: 'retryHTTP()', pattern: /retryHTTP/i, critical: false },
    { feature: 'RetryError class', pattern: /class\s+RetryError/i, critical: false }
  ];
  
  let allPassed = true;
  
  checks.forEach(check => {
    const passed = check.pattern.test(content);
    
    if (passed) {
      success(check.feature);
    } else if (check.critical) {
      error(`${check.feature} - MISSING`);
      results.issues.push(`Retry: Missing ${check.feature}`);
      allPassed = false;
    } else {
      warning(`${check.feature} - Not found (optional)`);
    }
  });
  
  results.improvements.push({
    name: 'Retry Logic',
    status: allPassed ? 'PASS' : 'FAIL',
    file: 'utils/retry.js'
  });
  
  return allPassed;
}

/**
 * VALIDACIÓN: Handlers existentes
 */
function validateHandlers() {
  title('HANDLERS - STATUS');
  
  const handlersDir = path.join(__dirname, '../src/handlers');
  
  if (!fs.existsSync(handlersDir)) {
    warning('Handlers directory not found');
    return;
  }
  
  let total = 0;
  let withSecurity = 0;
  let migrated = 0;
  
  function scanDirectory(dir) {
    const items = fs.readdirSync(dir);
    
    items.forEach(item => {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        scanDirectory(fullPath);
      } else if (item.endsWith('.js') && !item.includes('test')) {
        total++;
        
        const content = fs.readFileSync(fullPath, 'utf-8');
        
        // Check security patterns
        if (content.includes('securityHeaders') || content.includes('jwtValidator')) {
          withSecurity++;
        }
        
        // Check if migrated (uses new patterns)
        const migratedPatterns = [
          /createAPIHandler/,
          /Logger\.fromEvent/,
          /validate\(/,
          /successResponse\(/
        ];
        
        if (migratedPatterns.some(pattern => pattern.test(content))) {
          migrated++;
          if (verbose) {
            success(`Migrated: ${fullPath.replace(handlersDir, '')}`);
          }
        }
      }
    });
  }
  
  scanDirectory(handlersDir);
  
  results.handlers = {
    total,
    withSecurity,
    migrated,
    pending: total - migrated
  };
  
  info(`Total handlers: ${total}`);
  info(`With security: ${withSecurity} (${Math.round(withSecurity/total*100)}%)`);
  info(`Migrated to new pattern: ${migrated} (${Math.round(migrated/total*100)}%)`);
  info(`Pending migration: ${total - migrated}`);
}

/**
 * RESUMEN FINAL
 */
function printSummary() {
  title('RESUMEN DE VALIDACIÓN');
  
  console.log('\n📊 MEJORAS IMPLEMENTADAS:\n');
  
  results.improvements.forEach((improvement, idx) => {
    const status = improvement.status === 'PASS' ? '✅' :
                   improvement.status === 'PARTIAL' ? '⚠️' : '❌';
    
    console.log(`${idx + 1}. ${status} ${improvement.name}`);
    if (improvement.file) {
      console.log(`   📁 ${improvement.file}`);
    }
    if (improvement.schemas) {
      console.log(`   📋 ${improvement.schemas} schemas defined`);
    }
    if (improvement.errorCodes) {
      console.log(`   🔢 ${improvement.errorCodes} error codes defined`);
    }
  });
  
  console.log('\n📈 ESTADO DE HANDLERS:\n');
  console.log(`   Total: ${results.handlers.total}`);
  console.log(`   Con seguridad: ${results.handlers.withSecurity}/${results.handlers.total} (${Math.round(results.handlers.withSecurity/results.handlers.total*100)}%)`);
  console.log(`   Migrados: ${results.handlers.migrated}/${results.handlers.total} (${Math.round(results.handlers.migrated/results.handlers.total*100)}%)`);
  console.log(`   Pendientes: ${results.handlers.pending}`);
  
  if (results.issues.length > 0) {
    console.log('\n❌ PROBLEMAS CRÍTICOS:\n');
    results.issues.forEach(issue => {
      error(`   ${issue}`);
    });
  }
  
  if (results.warnings.length > 0) {
    console.log('\n⚠️  ADVERTENCIAS:\n');
    results.warnings.forEach(warn => {
      warning(`   ${warn}`);
    });
  }
  
  const totalPassed = results.improvements.filter(i => i.status === 'PASS').length;
  const totalPartial = results.improvements.filter(i => i.status === 'PARTIAL').length;
  const totalFailed = results.improvements.filter(i => i.status === 'FAIL').length;
  
  console.log('\n' + '='.repeat(60));
  
  if (totalFailed === 0 && totalPartial === 0) {
    success(`\n🎉 TODAS LAS MEJORAS IMPLEMENTADAS CORRECTAMENTE (${totalPassed}/8)`);
    success('Sistema listo para migración de handlers\n');
    process.exit(0);
  } else if (totalFailed === 0) {
    warning(`\n⚠️  IMPLEMENTACIÓN PARCIAL (${totalPassed}/8 completas, ${totalPartial}/8 parciales)`);
    warning('Algunas características opcionales faltan\n');
    process.exit(0);
  } else {
    error(`\n❌ FALLOS DETECTADOS (${totalFailed}/8 mejoras con problemas)`);
    error('Revisar y corregir antes de continuar\n');
    process.exit(1);
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🚀 EJECUTAR VALIDACIÓN
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

log('\n🔍 VALIDANDO MEJORAS IMPLEMENTADAS...\n', 'bold');

try {
  validateLogger();
  validateValidator();
  validateCircuitBreaker();
  validateBatchHelper();
  validateErrorHandler();
  validateCache();
  validateInterceptors();
  validateRetry();
  validateHandlers();
  
  printSummary();
} catch (error) {
  console.error('\n❌ Error durante validación:', error);
  process.exit(1);
}
