#!/usr/bin/env node

/**
 * Chaos Experiments Automation Script
 * Automatiza experimentos de caos con Gremlin
 */

const fs = require('fs');
const { execSync } = require('child_process');

// Cargar configuración
const GREMLIN_CONFIG = require('./configure-gremlin').GREMLIN_CONFIG;

// ========================================
// CLASE: Experimento de Caos
// ========================================

class ChaosExperiment {
  constructor(config) {
    this.name = config.name;
    this.description = config.description;
    this.type = config.type;
    this.targets = config.targets || [];
    this.parameters = config.parameters || {};
    this.duration = config.duration || 60;
    this.hypothesis = config.hypothesis;
    this.expectedOutcome = config.expectedOutcome;
    this.safeguards = config.safeguards || GREMLIN_CONFIG.safeguards;
  }

  /**
   * Valida pre-condiciones antes de ejecutar
   */
  async validatePreConditions() {
    console.log(`[${this.name}] Validando pre-condiciones...`);
    
    // 1. Verificar error budget disponible
    const errorBudget = await this.getErrorBudget();
    if (errorBudget > 70) {
      throw new Error(`Error budget consumido (${errorBudget}%). Experimento no permitido.`);
    }
    
    // 2. Verificar que no hay incidents activos
    const activeIncidents = await this.checkActiveIncidents();
    if (activeIncidents > 0) {
      throw new Error(`${activeIncidents} incidents activos. Experimento no permitido.`);
    }
    
    // 3. Verificar horario (no experimentos en horas pico)
    const hour = new Date().getHours();
    if (hour >= 8 && hour <= 18) {
      console.warn(`⚠️  Advertencia: Experimento en horario laboral (${hour}:00)`);
      
      if (!this.safeguards.allowBusinessHours) {
        throw new Error('Experimentos no permitidos en horario laboral');
      }
    }
    
    console.log(`✅ Pre-condiciones validadas`);
    return true;
  }

  /**
   * Ejecuta el experimento
   */
  async execute() {
    console.log(`\n🧪 Ejecutando experimento: ${this.name}`);
    console.log(`📝 Hipótesis: ${this.hypothesis}`);
    console.log(`🎯 Resultado esperado: ${this.expectedOutcome}\n`);

    const startTime = Date.now();
    let success = false;
    let metrics = {};

    try {
      // Validar pre-condiciones
      await this.validatePreConditions();

      // Capturar métricas baseline
      console.log('📊 Capturando métricas baseline...');
      const baseline = await this.captureMetrics();

      // Ejecutar ataque
      console.log(`🚀 Iniciando ataque: ${this.type}`);
      const attackId = await this.launchAttack();

      // Monitorear durante el experimento
      console.log(`⏱️  Monitoreando por ${this.duration}s...`);
      await this.monitor(attackId, this.duration);

      // Capturar métricas post-experimento
      console.log('📊 Capturando métricas post-experimento...');
      const postExperiment = await this.captureMetrics();

      // Analizar resultados
      metrics = this.analyzeResults(baseline, postExperiment);
      success = this.validateHypothesis(metrics);

      // Detener ataque
      await this.haltAttack(attackId);

      // Esperar recuperación
      console.log('🔄 Esperando recuperación del sistema...');
      await this.waitForRecovery();

    } catch (error) {
      console.error(`❌ Error en experimento: ${error.message}`);
      
      // Emergency rollback
      console.log('🚨 Ejecutando rollback de emergencia...');
      await this.emergencyRollback();
      
      success = false;
    }

    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;

    // Generar reporte
    const report = this.generateReport(success, metrics, duration);
    await this.saveReport(report);

    // Publicar métricas a CloudWatch
    await this.publishMetrics(success, metrics);

    console.log(`\n${success ? '✅' : '❌'} Experimento ${success ? 'exitoso' : 'fallido'}: ${this.name}`);
    console.log(`⏱️  Duración: ${duration.toFixed(2)}s`);

    return { success, metrics, report };
  }

  /**
   * Lanza el ataque de caos
   */
  async launchAttack() {
    const attackConfig = {
      type: this.type,
      targets: this.targets,
      parameters: this.parameters,
      duration: this.duration,
      safeguards: this.safeguards
    };

    console.log('🎯 Configuración del ataque:', JSON.stringify(attackConfig, null, 2));

    // Simular ataque (en producción, llamar a Gremlin API)
    const attackId = `attack_${Date.now()}`;
    
    // Guardar estado del ataque
    fs.writeFileSync(
      `/tmp/chaos_${attackId}.json`,
      JSON.stringify(attackConfig),
      'utf-8'
    );

    return attackId;
  }

  /**
   * Monitorea el experimento
   */
  async monitor(attackId, duration) {
    const intervalMs = 10000; // Check cada 10s
    const iterations = Math.ceil(duration / (intervalMs / 1000));

    for (let i = 0; i < iterations; i++) {
      await new Promise(resolve => setTimeout(resolve, intervalMs));

      const progress = ((i + 1) / iterations * 100).toFixed(0);
      console.log(`📊 Progreso: ${progress}% (${i + 1}/${iterations})`);

      // Verificar halt conditions
      const shouldHalt = await this.checkHaltConditions();
      if (shouldHalt) {
        console.log('🚨 Halt condition detectada! Deteniendo experimento...');
        await this.haltAttack(attackId);
        throw new Error('Halt condition triggered');
      }
    }
  }

  /**
   * Detiene el ataque
   */
  async haltAttack(attackId) {
    console.log(`🛑 Deteniendo ataque: ${attackId}`);
    
    // Eliminar archivo de estado
    try {
      fs.unlinkSync(`/tmp/chaos_${attackId}.json`);
    } catch (error) {
      // Ignorar si no existe
    }

    return true;
  }

  /**
   * Verifica condiciones de halt
   */
  async checkHaltConditions() {
    for (const condition of this.safeguards.haltConditions) {
      const value = await this.getMetricValue(condition.type);

      let shouldHalt = false;

      switch (condition.type) {
        case 'error_rate':
          shouldHalt = value > condition.threshold;
          break;
        case 'p99_latency':
          shouldHalt = value > condition.threshold;
          break;
        case 'availability':
          shouldHalt = value < condition.threshold;
          break;
      }

      if (shouldHalt) {
        console.log(`🚨 Halt condition: ${condition.type} = ${value} (threshold: ${condition.threshold})`);
        return true;
      }
    }

    return false;
  }

  /**
   * Captura métricas del sistema
   */
  async captureMetrics() {
    // En producción, llamar a CloudWatch API
    return {
      availability: 99.8 + Math.random() * 0.2,
      errorRate: Math.random() * 0.5,
      p50Latency: 100 + Math.random() * 50,
      p95Latency: 300 + Math.random() * 100,
      p99Latency: 500 + Math.random() * 200,
      requestRate: 100 + Math.random() * 50,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Obtiene valor de una métrica específica
   */
  async getMetricValue(metricType) {
    const metrics = await this.captureMetrics();

    switch (metricType) {
      case 'error_rate':
        return metrics.errorRate;
      case 'p99_latency':
        return metrics.p99Latency;
      case 'availability':
        return metrics.availability;
      default:
        return 0;
    }
  }

  /**
   * Analiza resultados
   */
  analyzeResults(baseline, postExperiment) {
    return {
      availabilityDelta: postExperiment.availability - baseline.availability,
      errorRateDelta: postExperiment.errorRate - baseline.errorRate,
      p95LatencyDelta: postExperiment.p95Latency - baseline.p95Latency,
      p99LatencyDelta: postExperiment.p99Latency - baseline.p99Latency,
      baseline,
      postExperiment
    };
  }

  /**
   * Valida hipótesis
   */
  validateHypothesis(metrics) {
    // Criterios de éxito:
    // 1. Availability no cae más de 1%
    // 2. Error rate se mantiene bajo 5%
    // 3. P99 latency no excede 2x el baseline

    const availabilityOk = metrics.availabilityDelta > -1.0;
    const errorRateOk = metrics.postExperiment.errorRate < 5.0;
    const latencyOk = metrics.postExperiment.p99Latency < metrics.baseline.p99Latency * 2;

    console.log('\n📊 Validación de hipótesis:');
    console.log(`  Availability: ${availabilityOk ? '✅' : '❌'} (Δ ${metrics.availabilityDelta.toFixed(2)}%)`);
    console.log(`  Error Rate: ${errorRateOk ? '✅' : '❌'} (${metrics.postExperiment.errorRate.toFixed(2)}%)`);
    console.log(`  Latency: ${latencyOk ? '✅' : '❌'} (P99: ${metrics.postExperiment.p99Latency.toFixed(0)}ms)`);

    return availabilityOk && errorRateOk && latencyOk;
  }

  /**
   * Espera recuperación del sistema
   */
  async waitForRecovery() {
    const maxWaitTime = 60000; // 1 minuto
    const checkInterval = 5000; // 5 segundos
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      const metrics = await this.captureMetrics();

      if (metrics.availability > 99.5 && metrics.errorRate < 1.0) {
        const recoveryTime = (Date.now() - startTime) / 1000;
        console.log(`✅ Sistema recuperado en ${recoveryTime.toFixed(1)}s`);
        return recoveryTime;
      }

      console.log('⏳ Esperando recuperación...');
      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }

    console.warn('⚠️  Sistema no se recuperó en el tiempo esperado');
    return maxWaitTime / 1000;
  }

  /**
   * Rollback de emergencia
   */
  async emergencyRollback() {
    console.log('🚨 Ejecutando rollback de emergencia...');
    
    // 1. Detener todos los ataques activos
    // 2. Reiniciar servicios si es necesario
    // 3. Notificar al equipo
    
    return true;
  }

  /**
   * Obtiene error budget actual
   */
  async getErrorBudget() {
    // Simular (en producción, calcular desde CloudWatch)
    return Math.random() * 100;
  }

  /**
   * Verifica incidents activos
   */
  async checkActiveIncidents() {
    // Simular (en producción, consultar PagerDuty/StatusPage)
    return 0;
  }

  /**
   * Genera reporte del experimento
   */
  generateReport(success, metrics, duration) {
    return {
      experiment: {
        name: this.name,
        description: this.description,
        type: this.type,
        hypothesis: this.hypothesis,
        expectedOutcome: this.expectedOutcome
      },
      result: {
        success,
        duration,
        timestamp: new Date().toISOString()
      },
      metrics,
      conclusion: success
        ? 'Sistema resistió el experimento dentro de los parámetros esperados'
        : 'Sistema no cumplió con los criterios de éxito',
      recommendations: success
        ? ['Considerar aumentar la intensidad del experimento', 'Documentar resilience patterns encontrados']
        : ['Investigar causas de fallo', 'Implementar mejoras de resiliencia', 'Repetir experimento después de fixes']
    };
  }

  /**
   * Guarda reporte en disco
   */
  async saveReport(report) {
    const filename = `chaos-report-${Date.now()}.json`;
    const filepath = `./chaos-reports/${filename}`;

    // Crear directorio si no existe
    if (!fs.existsSync('./chaos-reports')) {
      fs.mkdirSync('./chaos-reports', { recursive: true });
    }

    fs.writeFileSync(filepath, JSON.stringify(report, null, 2), 'utf-8');
    console.log(`📄 Reporte guardado: ${filepath}`);
  }

  /**
   * Publica métricas a CloudWatch
   */
  async publishMetrics(success, metrics) {
    console.log('📊 Publicando métricas a CloudWatch...');

    // En producción, usar AWS SDK
    const metricsData = {
      Namespace: 'HospitalPadreHurtado',
      MetricData: [
        {
          MetricName: 'ExperimentSuccess',
          Value: success ? 1 : 0,
          Unit: 'None',
          Timestamp: new Date()
        },
        {
          MetricName: 'RecoveryTime',
          Value: metrics.recoveryTime || 0,
          Unit: 'Seconds',
          Timestamp: new Date()
        },
        {
          MetricName: 'AvailabilityDelta',
          Value: metrics.availabilityDelta || 0,
          Unit: 'Percent',
          Timestamp: new Date()
        }
      ]
    };

    console.log('✅ Métricas publicadas');
    return metricsData;
  }
}

// ========================================
// EXPERIMENTOS PREDEFINIDOS
// ========================================

const EXPERIMENTS = {
  latencyInjection: {
    name: 'Latency Injection - Login',
    description: 'Inyecta latencia de 500ms en el servicio de login',
    type: 'latency',
    targets: ['hospital-backend-dev-login'],
    parameters: {
      delay_ms: 500,
      jitter_ms: 100
    },
    duration: 180,
    hypothesis: 'El sistema mantendrá disponibilidad > 99% con latencia adicional de 500ms',
    expectedOutcome: 'Usuarios experimentan login más lento pero sin errores'
  },

  cpuExhaustion: {
    name: 'CPU Exhaustion - Agenda',
    description: 'Consume 75% del CPU en servicio de agenda',
    type: 'resource',
    targets: ['hospital-backend-dev-getAgenda'],
    parameters: {
      cpu_percent: 75,
      duration: 120
    },
    duration: 120,
    hypothesis: 'Sistema degrada gracefully con auto-scaling',
    expectedOutcome: 'Lambda auto-escala y mantiene disponibilidad'
  },

  networkBlackhole: {
    name: 'Network Blackhole - DynamoDB',
    description: 'Bloquea conexiones a DynamoDB por 60s',
    type: 'network',
    targets: ['hospital-backend-dev-getAgenda'],
    parameters: {
      destination: 'dynamodb',
      protocol: 'tcp'
    },
    duration: 60,
    hypothesis: 'Retry logic maneja timeouts de DynamoDB',
    expectedOutcome: 'Requests fallan inicialmente pero se recuperan con retries'
  },

  errorInjection: {
    name: 'Error Injection - 500s',
    description: 'Fuerza 10% de requests a retornar 500',
    type: 'statusCode',
    targets: ['hospital-backend-dev-personalization'],
    parameters: {
      statusCode: 500,
      percentage: 10
    },
    duration: 120,
    hypothesis: 'Frontend maneja errores 500 gracefully',
    expectedOutcome: 'UI muestra mensajes de error apropiados'
  },

  dependencyFailure: {
    name: 'Dependency Failure - SNS',
    description: 'Simula fallo en servicio de notificaciones SNS',
    type: 'network',
    targets: ['hospital-backend-dev-notifyUser'],
    parameters: {
      destination: 'sns',
      failureRate: 100
    },
    duration: 90,
    hypothesis: 'Sistema continúa funcionando sin notificaciones',
    expectedOutcome: 'Core functionality no se ve afectada'
  }
};

// ========================================
// CLI
// ========================================

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  console.log('🧪 Chaos Experiments Automation\n');

  switch (command) {
    case 'list':
      console.log('📋 Experimentos disponibles:\n');
      Object.keys(EXPERIMENTS).forEach((key, index) => {
        const exp = EXPERIMENTS[key];
        console.log(`${index + 1}. ${exp.name}`);
        console.log(`   ${exp.description}`);
        console.log(`   Tipo: ${exp.type} | Duración: ${exp.duration}s\n`);
      });
      break;

    case 'run':
      const experimentName = args[1];
      
      if (!experimentName || !EXPERIMENTS[experimentName]) {
        console.error('❌ Experimento no encontrado');
        console.log('\nUso: node chaos-experiments.js run <experimento>');
        console.log('Experimentos disponibles:', Object.keys(EXPERIMENTS).join(', '));
        process.exit(1);
      }

      const config = EXPERIMENTS[experimentName];
      const experiment = new ChaosExperiment(config);
      
      const result = await experiment.execute();
      
      process.exit(result.success ? 0 : 1);
      break;

    case 'run-all':
      console.log('🚀 Ejecutando todos los experimentos...\n');
      
      const results = [];
      
      for (const [key, config] of Object.entries(EXPERIMENTS)) {
        console.log(`\n${'='.repeat(60)}`);
        const experiment = new ChaosExperiment(config);
        const result = await experiment.execute();
        results.push({ experiment: key, ...result });
        
        // Esperar entre experimentos
        console.log('\n⏸️  Esperando 30s antes del próximo experimento...');
        await new Promise(resolve => setTimeout(resolve, 30000));
      }
      
      // Reporte final
      console.log('\n\n📊 RESUMEN FINAL');
      console.log('='.repeat(60));
      results.forEach(r => {
        console.log(`${r.success ? '✅' : '❌'} ${r.experiment}`);
      });
      
      const successRate = results.filter(r => r.success).length / results.length * 100;
      console.log(`\nTasa de éxito: ${successRate.toFixed(0)}%`);
      
      break;

    default:
      console.log('Uso:');
      console.log('  node chaos-experiments.js list           # Listar experimentos');
      console.log('  node chaos-experiments.js run <nombre>   # Ejecutar experimento');
      console.log('  node chaos-experiments.js run-all        # Ejecutar todos');
      console.log('\nEjemplos:');
      console.log('  node chaos-experiments.js run latencyInjection');
      console.log('  node chaos-experiments.js run cpuExhaustion');
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
}

module.exports = { ChaosExperiment, EXPERIMENTS };
