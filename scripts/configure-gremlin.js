#!/usr/bin/env node

/**
 * Gremlin Configuration Script
 * Instala y configura Gremlin para Chaos Engineering en AWS
 */

const fs = require('fs');
const path = require('path');

const GREMLIN_CONFIG = {
  // Configuración de credenciales (usar variables de entorno)
  teamId: process.env.GREMLIN_TEAM_ID || '',
  apiKey: process.env.GREMLIN_API_KEY || '',
  
  // Configuración de targets
  targets: {
    lambda: {
      enabled: true,
      functions: [
        'hospital-backend-dev-login',
        'hospital-backend-dev-getAgenda',
        'hospital-backend-dev-getMedicos',
        'hospital-backend-dev-personalization'
      ]
    },
    ec2: {
      enabled: false,
      instances: []
    },
    ecs: {
      enabled: false,
      clusters: []
    }
  },
  
  // Configuración de experimentos
  experiments: {
    latency: {
      enabled: true,
      delay_ms: [100, 500, 1000, 2000],
      targets: ['lambda']
    },
    resourceExhaustion: {
      enabled: true,
      cpu_percent: [50, 75, 90],
      memory_percent: [50, 75, 90],
      targets: ['lambda']
    },
    networkBlackholes: {
      enabled: true,
      targets: ['lambda'],
      destinations: ['dynamodb', 'sns']
    },
    shutdown: {
      enabled: false,  // Muy destructivo
      targets: []
    },
    statusCode: {
      enabled: true,
      codes: [429, 500, 503],
      targets: ['lambda']
    }
  },
  
  // Safeguards
  safeguards: {
    maxDuration: 300,  // 5 minutos máximo
    maxImpactRadius: 0.1,  // Solo 10% del tráfico
    autoRollback: true,
    requireApproval: true,
    
    // Halt conditions
    haltConditions: [
      {
        type: 'error_rate',
        threshold: 10,  // 10% error rate
        duration: 60    // Por 1 minuto
      },
      {
        type: 'p99_latency',
        threshold: 5000,  // 5 segundos
        duration: 120
      },
      {
        type: 'availability',
        threshold: 95,  // < 95%
        duration: 60
      }
    ]
  },
  
  // Configuración de notificaciones
  notifications: {
    slack: {
      enabled: false,
      webhookUrl: process.env.SLACK_WEBHOOK_URL || ''
    },
    email: {
      enabled: true,
      addresses: [process.env.ALARM_EMAIL || 'devops@hospital.com']
    },
    pagerDuty: {
      enabled: false,
      integrationKey: process.env.PAGERDUTY_KEY || ''
    }
  },
  
  // Schedules
  schedules: {
    weeklyLatencyTest: {
      enabled: true,
      cron: '0 14 * * 2',  // Martes 2 PM
      experiment: 'latency',
      duration: 180
    },
    monthlyFailoverTest: {
      enabled: true,
      cron: '0 10 1 * *',  // Primer día del mes, 10 AM
      experiment: 'networkBlackholes',
      duration: 300
    }
  }
};

/**
 * Genera archivo de configuración de Gremlin
 */
function generateGremlinConfig() {
  const configPath = path.join(__dirname, '../gremlin-config.json');
  
  console.log('📝 Generando configuración de Gremlin...');
  
  fs.writeFileSync(
    configPath,
    JSON.stringify(GREMLIN_CONFIG, null, 2),
    'utf-8'
  );
  
  console.log(`✅ Configuración guardada en: ${configPath}`);
}

/**
 * Genera script de instalación de Gremlin en Lambda
 */
function generateLambdaInstallScript() {
  const scriptPath = path.join(__dirname, 'install-gremlin-lambda.sh');
  
  const script = `#!/bin/bash
# Script de instalación de Gremlin para AWS Lambda

set -e

echo "🔧 Instalando Gremlin Lambda SDK..."

# Agregar dependencia a package.json
cd "\${1:-./aws}"

if ! grep -q "@gremlin/lambda" package.json; then
  npm install --save @gremlin/lambda
  echo "✅ @gremlin/lambda instalado"
else
  echo "ℹ️  @gremlin/lambda ya está instalado"
fi

# Crear handler wrapper
cat > src/gremlinWrapper.js << 'EOF'
/**
 * Gremlin Wrapper para Lambda Functions
 * Inyecta fallas de manera controlada
 */

const gremlin = require('@gremlin/lambda');

// Configuración
const GREMLIN_CONFIG = {
  teamId: process.env.GREMLIN_TEAM_ID,
  apiKey: process.env.GREMLIN_API_KEY,
  enabled: process.env.GREMLIN_ENABLED === 'true',
  debug: process.env.GREMLIN_DEBUG === 'true'
};

/**
 * Envuelve un handler de Lambda con Gremlin
 * @param {Function} handler - Handler original
 * @returns {Function} Handler con Gremlin
 */
function wrapHandler(handler) {
  if (!GREMLIN_CONFIG.enabled) {
    console.log('[Gremlin] Chaos engineering deshabilitado');
    return handler;
  }
  
  return gremlin.wrapper(handler, {
    teamId: GREMLIN_CONFIG.teamId,
    apiKey: GREMLIN_CONFIG.apiKey,
    debug: GREMLIN_CONFIG.debug
  });
}

module.exports = { wrapHandler };
EOF

echo "✅ Gremlin wrapper creado en src/gremlinWrapper.js"

# Agregar variables de entorno al serverless.yml
echo ""
echo "📝 Agregar las siguientes variables de entorno a serverless.yml:"
echo ""
echo "  environment:"
echo "    GREMLIN_TEAM_ID: \${env:GREMLIN_TEAM_ID}"
echo "    GREMLIN_API_KEY: \${env:GREMLIN_API_KEY}"
echo "    GREMLIN_ENABLED: \${env:GREMLIN_ENABLED, 'false'}"
echo "    GREMLIN_DEBUG: \${env:GREMLIN_DEBUG, 'false'}"
echo ""
echo "✅ Instalación completa. Ver documentación para uso."
`;

  fs.writeFileSync(scriptPath, script, 'utf-8');
  fs.chmodSync(scriptPath, '755');
  
  console.log(`✅ Script de instalación creado: ${scriptPath}`);
}

/**
 * Genera ejemplos de uso
 */
function generateExamples() {
  const examplesPath = path.join(__dirname, 'gremlin-usage-examples.js');
  
  const examples = `/**
 * Ejemplos de uso de Gremlin en Lambda
 */

const { wrapHandler } = require('./gremlinWrapper');

// ========================================
// EJEMPLO 1: Handler básico con Gremlin
// ========================================

const myHandler = async (event, context) => {
  console.log('Processing event:', event);
  
  // Tu lógica aquí
  const result = await processEvent(event);
  
  return {
    statusCode: 200,
    body: JSON.stringify(result)
  };
};

// Exportar con wrapper
module.exports.handler = wrapHandler(myHandler);

// ========================================
// EJEMPLO 2: Handler con manejo de errores
// ========================================

const loginHandler = async (event, context) => {
  try {
    const body = JSON.parse(event.body || '{}');
    
    // Simular delay por Gremlin (inyectado automáticamente)
    const result = await authenticateUser(body.username, body.password);
    
    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, ...result })
    };
  } catch (error) {
    console.error('Login error:', error);
    
    // Gremlin puede inyectar errores aquí
    return {
      statusCode: 500,
      body: JSON.stringify({ ok: false, error: error.message })
    };
  }
};

module.exports.login = wrapHandler(loginHandler);

// ========================================
// EJEMPLO 3: Handler con retry logic
// ========================================

const getAgendaHandler = async (event, context) => {
  const maxRetries = 3;
  let attempt = 0;
  
  while (attempt < maxRetries) {
    try {
      // Gremlin puede inyectar fallas en DynamoDB
      const agenda = await dynamoDB.query({ ... }).promise();
      
      return {
        statusCode: 200,
        body: JSON.stringify(agenda)
      };
    } catch (error) {
      attempt++;
      
      if (attempt >= maxRetries) {
        throw error;
      }
      
      // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
};

module.exports.getAgenda = wrapHandler(getAgendaHandler);

// ========================================
// EJEMPLO 4: Conditional Gremlin
// ========================================

const personalizationHandler = async (event, context) => {
  // Solo habilitar Gremlin para usuarios de prueba
  const isTestUser = event.requestContext?.authorizer?.jwt?.claims?.email?.includes('test');
  
  if (isTestUser) {
    console.log('[Gremlin] Chaos habilitado para usuario de prueba');
  }
  
  // Lógica normal
  const result = await getPersonalization(event);
  
  return {
    statusCode: 200,
    body: JSON.stringify(result)
  };
};

// Wrapper condicional
const wrappedHandler = wrapHandler(personalizationHandler);

module.exports.personalization = (event, context) => {
  // Deshabilitar Gremlin en producción para usuarios reales
  if (process.env.STAGE === 'prod' && !isTestUser(event)) {
    return personalizationHandler(event, context);
  }
  
  return wrappedHandler(event, context);
};

// Helpers
function isTestUser(event) {
  return event.requestContext?.authorizer?.jwt?.claims?.email?.includes('test');
}

async function authenticateUser(username, password) {
  // Implementación
}

async function processEvent(event) {
  // Implementación
}

async function getPersonalization(event) {
  // Implementación
}
`;

  fs.writeFileSync(examplesPath, examples, 'utf-8');
  console.log(`✅ Ejemplos creados: ${examplesPath}`);
}

/**
 * Genera IAM policy para Gremlin
 */
function generateIAMPolicy() {
  const policyPath = path.join(__dirname, '../terraform/gremlin-iam-policy.json');
  
  const policy = {
    Version: '2012-10-17',
    Statement: [
      {
        Sid: 'GremlinLambdaAccess',
        Effect: 'Allow',
        Action: [
          'lambda:GetFunction',
          'lambda:ListFunctions',
          'lambda:InvokeFunction'
        ],
        Resource: 'arn:aws:lambda:*:*:function:hospital-backend-*'
      },
      {
        Sid: 'GremlinCloudWatchAccess',
        Effect: 'Allow',
        Action: [
          'cloudwatch:PutMetricData',
          'cloudwatch:GetMetricStatistics',
          'cloudwatch:ListMetrics'
        ],
        Resource: '*'
      },
      {
        Sid: 'GremlinLogsAccess',
        Effect: 'Allow',
        Action: [
          'logs:CreateLogGroup',
          'logs:CreateLogStream',
          'logs:PutLogEvents',
          'logs:FilterLogEvents'
        ],
        Resource: 'arn:aws:logs:*:*:log-group:/aws/lambda/hospital-backend-*'
      }
    ]
  };
  
  fs.writeFileSync(policyPath, JSON.stringify(policy, null, 2), 'utf-8');
  console.log(`✅ IAM Policy creada: ${policyPath}`);
}

/**
 * Main
 */
function main() {
  console.log('🚀 Configurando Gremlin para Chaos Engineering...\n');
  
  try {
    generateGremlinConfig();
    generateLambdaInstallScript();
    generateExamples();
    generateIAMPolicy();
    
    console.log('\n✅ Configuración de Gremlin completa!');
    console.log('\n📚 Próximos pasos:');
    console.log('1. Obtener credenciales de Gremlin: https://app.gremlin.com/signup');
    console.log('2. Exportar variables: export GREMLIN_TEAM_ID=xxx GREMLIN_API_KEY=xxx');
    console.log('3. Ejecutar: ./scripts/install-gremlin-lambda.sh');
    console.log('4. Desplegar: cd aws && serverless deploy');
    console.log('5. Ejecutar experimentos: node scripts/chaos-experiments.js');
    
  } catch (error) {
    console.error('❌ Error configurando Gremlin:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { GREMLIN_CONFIG };
