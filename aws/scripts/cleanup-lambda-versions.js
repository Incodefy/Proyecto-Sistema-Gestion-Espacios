#!/usr/bin/env node

/**
 * Script para limpiar versiones antiguas de Lambda
 * Esto libera espacio de almacenamiento de código
 */

const { 
  LambdaClient, 
  ListFunctionsCommand,
  ListVersionsByFunctionCommand,
  DeleteFunctionCommand,
  GetAccountSettingsCommand
} = require("@aws-sdk/client-lambda");

const lambda = new LambdaClient({ region: 'us-east-1' });

async function cleanupOldVersions() {
  console.log('===============================================');
  console.log('  🗑️  LIMPIEZA MASIVA DE VERSIONES LAMBDA');
  console.log('===============================================\n');

  try {
    // 1. Listar todas las funciones
    const { Functions } = await lambda.send(new ListFunctionsCommand({ MaxItems: 500 }));
    console.log(`📋 Encontradas ${Functions.length} funciones Lambda\n`);

    let totalDeleted = 0;
    let totalSize = 0;
    let functionsProcessed = 0;
    let functionsWithVersions = 0;

    // 2. Para cada función, eliminar versiones antiguas
    for (const func of Functions) {
      const functionName = func.FunctionName;
      functionsProcessed++;
      
      // Saltar si es una versión específica (contiene :)
      if (functionName.includes(':')) continue;

      process.stdout.write(`[${functionsProcessed}/${Functions.length}] ${functionName.padEnd(50)}`);

      try {
        // Listar versiones
        const { Versions } = await lambda.send(
          new ListVersionsByFunctionCommand({ 
            FunctionName: functionName,
            MaxItems: 500
          })
        );

        // Filtrar: eliminar todo excepto $LATEST
        const versionsToDelete = Versions.filter(v => v.Version !== '$LATEST');
        
        if (versionsToDelete.length === 0) {
          console.log(' ✓ Sin versiones');
          continue;
        }

        functionsWithVersions++;
        process.stdout.write(` 🗑️  ${versionsToDelete.length} versiones... `);

        let deletedInFunc = 0;
        let funcSize = 0;

        // Eliminar versiones en lotes pequeños para evitar throttling
        for (const version of versionsToDelete) {
          try {
            await lambda.send(
              new DeleteFunctionCommand({
                FunctionName: functionName,
                Qualifier: version.Version
              })
            );
            totalDeleted++;
            deletedInFunc++;
            funcSize += version.CodeSize || 0;
            
            // Pausa cada 10 eliminaciones para evitar throttling
            if (deletedInFunc % 10 === 0) {
              await new Promise(resolve => setTimeout(resolve, 50));
            }
          } catch (err) {
            // Ignorar errores de versiones que no se pueden eliminar (alias, etc)
            if (err.name === 'TooManyRequestsException') {
              console.log('\n   ⏸️  Throttling detectado, esperando 2 segundos...');
              await new Promise(resolve => setTimeout(resolve, 2000));
            }
          }
        }

        totalSize += funcSize;
        const sizeMB = (funcSize / (1024 * 1024)).toFixed(1);
        console.log(`✅ ${deletedInFunc} eliminadas (${sizeMB} MB)`);

      } catch (err) {
        console.log(` ❌ ${err.message}`);
      }

      // Pequeña pausa entre funciones
      await new Promise(resolve => setTimeout(resolve, 30));
    }

    const totalGB = (totalSize / (1024 * 1024 * 1024)).toFixed(2);
    const totalMB = (totalSize / (1024 * 1024)).toFixed(2);

    console.log('\n===============================================');
    console.log('  ✅ LIMPIEZA COMPLETADA');
    console.log('===============================================');
    console.log(`📊 Funciones procesadas:       ${functionsProcessed}`);
    console.log(`🗂️  Funciones con versiones:    ${functionsWithVersions}`);
    console.log(`🗑️  Total versiones eliminadas: ${totalDeleted}`);
    console.log(`💾 Espacio liberado:           ${totalMB} MB (${totalGB} GB)`);
    console.log('===============================================\n');

    // Verificar el espacio total
    console.log('📊 Verificando uso de almacenamiento Lambda...');
    const accountSettings = await lambda.send(new GetAccountSettingsCommand({}));
    const usedGB = (accountSettings.AccountUsage.TotalCodeSize / (1024 * 1024 * 1024)).toFixed(2);
    const limitGB = (accountSettings.AccountLimit.TotalCodeSize / (1024 * 1024 * 1024)).toFixed(2);
    const percentUsed = ((accountSettings.AccountUsage.TotalCodeSize / accountSettings.AccountLimit.TotalCodeSize) * 100).toFixed(2);
    
    console.log(`✓ Uso actual: ${usedGB} GB / ${limitGB} GB (${percentUsed}%)\n`);
    
    if (percentUsed < 50) {
      console.log('✅ ¡Excelente! Tienes mucho espacio disponible\n');
    } else if (percentUsed < 75) {
      console.log('✓ Buen nivel de almacenamiento\n');
    } else if (percentUsed < 90) {
      console.log('⚠️  Considera ejecutar este script periódicamente\n');
    } else {
      console.log('🔴 ADVERTENCIA: Aún cerca del límite\n');
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

cleanupOldVersions();
