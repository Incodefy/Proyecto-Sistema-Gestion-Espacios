// Script para limpiar especialidades residuales de DynamoDB
// Uso: node scripts/clean-especialidades.js <grupo_id>

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, QueryCommand, DeleteCommand, ScanCommand } = require("@aws-sdk/lib-dynamodb");

const client = new DynamoDBClient({ region: "us-east-1" });
const db = DynamoDBDocumentClient.from(client);

const ESPECIALIDADES_TABLE = "incodefy-dev-especialidades";
const OCCUPANTS_TABLE = "incodefy-dev-occupants";

async function checkAllTables(grupoId) {
  console.log(`\n🔍 Verificando TODAS las tablas para grupo: ${grupoId}\n`);
  
  try {
    // 1. Verificar tabla ESPECIALIDADES
    console.log("📋 === TABLA ESPECIALIDADES ===");
    const espResult = await db.send(
      new QueryCommand({
        TableName: ESPECIALIDADES_TABLE,
        KeyConditionExpression: "PK = :gid",
        ExpressionAttributeValues: {
          ":gid": grupoId
        }
      })
    );
    
    console.log(`Encontradas: ${espResult.Items?.length || 0} especialidades`);
    if (espResult.Items && espResult.Items.length > 0) {
      espResult.Items.forEach((item, index) => {
        console.log(`  ${index + 1}. SK: ${item.SK}, Nombre: ${item.nombre}`);
      });
    }
    
    // 2. Verificar tabla OCCUPANTS (por si estaban guardadas ahí)
    console.log("\n📋 === TABLA OCCUPANTS (verificando especialidades mal ubicadas) ===");
    const occResult = await db.send(
      new QueryCommand({
        TableName: OCCUPANTS_TABLE,
        KeyConditionExpression: "PK = :gid",
        ExpressionAttributeValues: {
          ":gid": grupoId
        }
      })
    );
    
    console.log(`Encontrados: ${occResult.Items?.length || 0} items en OCCUPANTS`);
    if (occResult.Items && occResult.Items.length > 0) {
      occResult.Items.forEach((item, index) => {
        console.log(`  ${index + 1}. SK: ${item.SK}, Nombre: ${item.nombre}, Tipo: ${item.tipo || 'N/A'}`);
      });
    }
    
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

// Obtener grupo_id de argumentos
const grupoId = process.argv[2];

if (!grupoId) {
  console.error("❌ Error: Debes proporcionar el grupo_id");
  console.log("\nUso: node scripts/check-tables.js <grupo_id>");
  console.log("Ejemplo: node scripts/check-tables.js grp_1534e25f-f7c3-46ac-a667-cabfc317c235");
  process.exit(1);
}

checkAllTables(grupoId);
