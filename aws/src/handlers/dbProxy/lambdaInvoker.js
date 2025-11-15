/**
 * Módulo para invocar funciones Lambda
 * Abstrae la lógica de invocación de AWS Lambda
 */

const { LambdaClient, InvokeCommand } = require("@aws-sdk/client-lambda");

const lambda = new LambdaClient();

/**
 * Invoca una función Lambda con el evento proporcionado
 * @param {string} functionName - Nombre completo de la función Lambda
 * @param {Object} event - Evento a pasar a la función
 * @returns {Promise<Object>} - Respuesta de la función Lambda
 */
async function invokeLambda(functionName, event) {
  console.log(`🚀 Invocando Lambda: ${functionName}`);

  try {
    const command = new InvokeCommand({
      FunctionName: functionName,
      Payload: Buffer.from(JSON.stringify(event))
    });

    const response = await lambda.send(command);
    
    console.log(`✅ Lambda ${functionName} respondió con StatusCode: ${response.StatusCode}`);

    if (response.FunctionError) {
      console.error(`❌ Error en Lambda ${functionName}:`, response.FunctionError);
      throw new Error(`Error en función Lambda: ${response.FunctionError}`);
    }

    const result = JSON.parse(Buffer.from(response.Payload).toString());
    
    // Log solo en modo debug para no saturar los logs
    if (process.env.DEBUG === 'true') {
      console.log(`📦 Resultado de ${functionName}:`, JSON.stringify(result, null, 2));
    }

    return result;

  } catch (error) {
    console.error(`❌ Error al invocar Lambda ${functionName}:`, error.message);
    
    // Propagar error con contexto
    throw {
      statusCode: 500,
      body: JSON.stringify({
        error: "Error invocando función Lambda",
        message: error.message,
        functionName: functionName
      })
    };
  }
}

/**
 * Invoca múltiples Lambdas en paralelo (útil para optimización futura)
 * @param {Array<{functionName: string, event: Object}>} invocations
 * @returns {Promise<Array>} - Array de respuestas
 */
async function invokeLambdasInParallel(invocations) {
  console.log(`🔄 Invocando ${invocations.length} Lambdas en paralelo`);

  try {
    const promises = invocations.map(({ functionName, event }) => 
      invokeLambda(functionName, event)
    );

    const results = await Promise.all(promises);
    console.log(`✅ Todas las invocaciones completadas`);
    
    return results;
  } catch (error) {
    console.error('❌ Error en invocación paralela:', error);
    throw error;
  }
}

module.exports = {
  invokeLambda,
  invokeLambdasInParallel
};
