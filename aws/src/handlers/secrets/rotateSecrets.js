/**
 * Lambda Function para Rotación de Secrets
 * 
 * Esta función es invocada automáticamente por AWS Secrets Manager
 * cada 30 días para rotar los secrets de la aplicación
 * 
 * Pasos de rotación:
 * 1. createSecret: Generar nuevo secret
 * 2. setSecret: Configurar nuevo secret en servicios externos
 * 3. testSecret: Validar que el nuevo secret funciona
 * 4. finishSecret: Marcar rotación como completa
 */

const { 
  SecretsManagerClient, 
  GetSecretValueCommand,
  PutSecretValueCommand,
  UpdateSecretVersionStageCommand,
  DescribeSecretCommand 
} = require("@aws-sdk/client-secretsmanager");
const { createLogger } = require('../utils/logger');
const crypto = require('crypto');

const logger = createLogger({ module: 'secretsRotation' });
const client = new SecretsManagerClient({});

// Servicios que requieren actualización de secrets
const SERVICES_TO_UPDATE = {
  cognito: process.env.COGNITO_POOL_ID,
  ses: process.env.SES_REGION,
  database: process.env.DB_TABLE_PREFIX
};

/**
 * Handler principal de rotación
 * Invocado por AWS Secrets Manager con eventos específicos
 */
exports.handler = async (event) => {
  const { SecretId, Token, Step } = event;

  logger.info('Secret rotation invoked', { 
    secretId: SecretId, 
    step: Step,
    token: Token?.substring(0, 10) 
  });

  try {
    switch (Step) {
      case 'createSecret':
        await createSecret(SecretId, Token);
        break;
      
      case 'setSecret':
        await setSecret(SecretId, Token);
        break;
      
      case 'testSecret':
        await testSecret(SecretId, Token);
        break;
      
      case 'finishSecret':
        await finishSecret(SecretId, Token);
        break;
      
      default:
        throw new Error(`Invalid rotation step: ${Step}`);
    }

    logger.info('Rotation step completed successfully', { step: Step });
    
    return {
      statusCode: 200,
      body: JSON.stringify({ 
        message: `Step ${Step} completed successfully`,
        secretId: SecretId
      })
    };

  } catch (error) {
    logger.error('Rotation step failed', error, { 
      secretId: SecretId, 
      step: Step 
    });

    throw error;
  }
};

/**
 * Step 1: Crear nuevo secret value
 */
async function createSecret(secretId, token) {
  logger.info('Creating new secret version', { secretId });

  // Obtener secret actual
  const describeCommand = new DescribeSecretCommand({ SecretId: secretId });
  const metadata = await client.send(describeCommand);

  // Verificar que no exista ya una versión con este token
  if (metadata.VersionIdsToStages[token]) {
    logger.warn('Secret version already exists', { token: token.substring(0, 10) });
    return;
  }

  // Obtener secret current value
  const getCommand = new GetSecretValueCommand({
    SecretId: secretId,
    VersionStage: 'AWSCURRENT'
  });
  const currentSecret = await client.send(getCommand);
  const currentValue = JSON.parse(currentSecret.SecretString);

  // Generar nuevos valores
  const newValue = generateNewSecretValue(currentValue);

  // Guardar nuevo secret con el token especificado
  const putCommand = new PutSecretValueCommand({
    SecretId: secretId,
    SecretString: JSON.stringify(newValue),
    ClientRequestToken: token,
    VersionStages: ['AWSPENDING']
  });

  await client.send(putCommand);
  logger.info('New secret version created', { secretId });
}

/**
 * Step 2: Configurar nuevo secret en servicios externos
 * (En este caso, la mayoría son API keys que no necesitan propagación)
 */
async function setSecret(secretId, token) {
  logger.info('Setting new secret in services', { secretId });

  // Obtener nuevo secret
  const getCommand = new GetSecretValueCommand({
    SecretId: secretId,
    VersionId: token,
    VersionStage: 'AWSPENDING'
  });
  const pendingSecret = await client.send(getCommand);
  const pendingValue = JSON.parse(pendingSecret.SecretString);

  // Actualizar servicios externos si es necesario
  // Por ejemplo, si tuviéramos que actualizar API keys en servicios externos
  
  // Para este caso, solo logueamos que el secret está listo
  logger.info('Secret ready to be tested', { 
    secretId,
    keysRotated: Object.keys(pendingValue).length
  });
}

/**
 * Step 3: Validar que el nuevo secret funciona
 */
async function testSecret(secretId, token) {
  logger.info('Testing new secret', { secretId });

  // Obtener nuevo secret
  const getCommand = new GetSecretValueCommand({
    SecretId: secretId,
    VersionId: token,
    VersionStage: 'AWSPENDING'
  });
  const pendingSecret = await client.send(getCommand);
  const pendingValue = JSON.parse(pendingSecret.SecretString);

  // Validar estructura del secret
  const requiredKeys = [
    'JWT_SECRET',
    'SESSION_SECRET',
    'ENCRYPTION_KEY'
  ];

  for (const key of requiredKeys) {
    if (!pendingValue[key]) {
      throw new Error(`Required key missing: ${key}`);
    }

    if (pendingValue[key].length < 32) {
      throw new Error(`Key ${key} is too short (min 32 chars)`);
    }
  }

  // Test básico: verificar que los valores son válidos
  // En producción, aquí podrías hacer requests de prueba a los servicios
  
  logger.info('Secret validation passed', { secretId });
}

/**
 * Step 4: Finalizar rotación (promover AWSPENDING a AWSCURRENT)
 */
async function finishSecret(secretId, token) {
  logger.info('Finishing secret rotation', { secretId });

  // Obtener metadata del secret
  const describeCommand = new DescribeSecretCommand({ SecretId: secretId });
  const metadata = await client.send(describeCommand);

  // Encontrar la versión AWSCURRENT actual
  let currentVersion = null;
  for (const [versionId, stages] of Object.entries(metadata.VersionIdsToStages)) {
    if (stages.includes('AWSCURRENT')) {
      currentVersion = versionId;
      break;
    }
  }

  // Promover AWSPENDING a AWSCURRENT
  const updateCommand = new UpdateSecretVersionStageCommand({
    SecretId: secretId,
    VersionStage: 'AWSCURRENT',
    MoveToVersionId: token,
    RemoveFromVersionId: currentVersion
  });

  await client.send(updateCommand);

  logger.info('Secret rotation completed successfully', { 
    secretId,
    oldVersion: currentVersion?.substring(0, 10),
    newVersion: token?.substring(0, 10)
  });
}

/**
 * Genera nuevos valores para el secret
 * Mantiene la estructura del secret original pero con nuevos valores
 */
function generateNewSecretValue(currentValue) {
  const newValue = { ...currentValue };

  // Rotar solo ciertos campos críticos
  const fieldsToRotate = [
    'JWT_SECRET',
    'SESSION_SECRET',
    'ENCRYPTION_KEY'
  ];

  for (const field of fieldsToRotate) {
    if (currentValue[field]) {
      newValue[field] = generateSecureRandomString(64);
    }
  }

  // Agregar timestamp de rotación
  newValue.ROTATED_AT = new Date().toISOString();
  newValue.ROTATION_VERSION = (parseInt(currentValue.ROTATION_VERSION || '0') + 1).toString();

  return newValue;
}

/**
 * Genera un string aleatorio criptográficamente seguro
 */
function generateSecureRandomString(length = 64) {
  return crypto.randomBytes(length).toString('base64').substring(0, length);
}
