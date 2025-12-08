#!/usr/bin/env node

/**
 * Script para limpiar versiones antiguas de Lambda
 * Esto libera espacio de almacenamiento de código
 */

const { 
  LambdaClient, 
  ListFunctionsCommand,
  ListVersionsByFunctionCommand,
  DeleteFunctionCommand
} = require("@aws-sdk/client-lambda");

const lambda = new LambdaClient({ region: 'us-east-1' });

async function cleanupOldVersions() {
  console.log('🧹 Iniciando limpieza de versiones antiguas de Lambda...\n');

  try {
    // 1. Listar todas las funciones
    const { Functions } = await lambda.send(new ListFunctionsCommand({}));
    console.log(`📋 Encontradas ${Functions.length} funciones Lambda\n`);

    let totalDeleted = 0;

    // 2. Para cada función, eliminar versiones antiguas
    for (const func of Functions) {
      const functionName = func.FunctionName;
      
      // Saltar si es una versión específica (contiene :)
      if (functionName.includes(':')) continue;

      console.log(`🔍 Procesando: ${functionName}`);

      try {
        // Listar versiones
        const { Versions } = await lambda.send(
          new ListVersionsByFunctionCommand({ FunctionName: functionName })
        );

        // Filtrar: eliminar todo excepto $LATEST
        const versionsToDelete = Versions.filter(v => v.Version !== '$LATEST');
        
        if (versionsToDelete.length === 0) {
          console.log(`   ✓ Sin versiones antiguas\n`);
          continue;
        }

        console.log(`   🗑️  Eliminando ${versionsToDelete.length} versiones antiguas...`);

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
            process.stdout.write('.');
          } catch (err) {
            // Ignorar errores de versiones que no se pueden eliminar (alias)
            if (!err.message.includes('in use by alias')) {
              console.error(`\n   ⚠️  Error eliminando versión ${version.Version}: ${err.message}`);
            }
          }

          // Pequeña pausa para evitar throttling
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        console.log(`\n   ✓ Completado\n`);

      } catch (err) {
        console.error(`   ❌ Error procesando ${functionName}: ${err.message}\n`);
      }
    }

    console.log(`\n✅ Limpieza completada!`);
    console.log(`📊 Total de versiones eliminadas: ${totalDeleted}`);
    console.log(`💾 Espacio liberado estimado: ~${(totalDeleted * 31).toFixed(0)} MB\n`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

cleanupOldVersions();
