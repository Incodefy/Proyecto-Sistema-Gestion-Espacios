const { DynamoDBDocumentClient, QueryCommand, GetCommand } = require("@aws-sdk/lib-dynamodb");
const { CognitoIdentityProviderClient, ListUsersCommand } = require("@aws-sdk/client-cognito-identity-provider");
const db = DynamoDBDocumentClient.from(new (require("@aws-sdk/client-dynamodb").DynamoDBClient)());
const cognito = new CognitoIdentityProviderClient({});

exports.handler = async (event) => {
  const TRACE_ID = `lambda-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  console.log(`\n=== [Lambda] GET /api/grupos/:id/miembros | ${TRACE_ID} ===`);
  
  try {
    const userSub = event.requestContext.authorizer.jwt.claims.sub;
    const grupoId = event.pathParameters.id;
    
    console.log(`[${TRACE_ID}] 👤 User:`, userSub);
    console.log(`[${TRACE_ID}] 📦 Grupo ID:`, grupoId);

    // Verificar que el grupo existe
    const groupResult = await db.send(new GetCommand({
      TableName: process.env.GROUPS_TABLE,
      Key: { group_id: grupoId }
    }));

    if (!groupResult.Item) {
      console.warn(`[${TRACE_ID}] ⚠️ Grupo no encontrado`);
      return {
        statusCode: 404,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          ok: false, 
          error: "Grupo no encontrado",
          trace_id: TRACE_ID
        })
      };
    }

    console.log(`[${TRACE_ID}] 📋 Obteniendo miembros del grupo`);

    // Obtener todos los miembros del grupo
    const membersResult = await db.send(new QueryCommand({
      TableName: process.env.GROUP_MEMBERS_TABLE,
      KeyConditionExpression: 'group_id = :group_id',
      ExpressionAttributeValues: {
        ':group_id': grupoId
      }
    }));

    const members = membersResult.Items || [];
    console.log(`[${TRACE_ID}] 👥 Encontrados ${members.length} miembros`);

    // Enriquecer datos de miembros (usar datos guardados o consultar Cognito si faltan)
    const enrichedMembers = await Promise.all(
      members.map(async (member) => {
        // Si ya tenemos email y nombre guardados, usarlos
        if (member.user_email) {
          const nombreGuardado = member.user_name || '';
          console.log(`[${TRACE_ID}] ✅ Usando datos guardados para: ${member.user_email}${nombreGuardado ? ` (${nombreGuardado})` : ''}`);
          return {
            id: member.user_sub,
            nombre: nombreGuardado || member.user_email.split('@')[0],
            email: member.user_email,
            rol: member.role,
            fecha_ingreso: member.added_at,
            esCreador: member.role === 'owner'
          };
        }
        
        // Si no están guardados, consultar Cognito (fallback para datos antiguos)
        try {
          console.log(`[${TRACE_ID}] 🔍 Consultando Cognito para: ${member.user_sub}`);
          const listUsersResult = await cognito.send(new ListUsersCommand({
            UserPoolId: process.env.USER_POOL_ID,
            Filter: `sub = "${member.user_sub}"`,
            Limit: 1
          }));

          if (listUsersResult.Users && listUsersResult.Users.length > 0) {
            const user = listUsersResult.Users[0];
            const email = user.Attributes?.find(attr => attr.Name === 'email')?.Value || 'Sin email';
            const name = user.Attributes?.find(attr => attr.Name === 'name')?.Value || '';
            const username = name || user.Username || email.split('@')[0];

            console.log(`[${TRACE_ID}] 📧 Usuario encontrado: ${email} - ${username}`);

            return {
              id: member.user_sub,
              nombre: username,
              email: email,
              rol: member.role,
              fecha_ingreso: member.added_at,
              esCreador: member.role === 'owner'
            };
          } else {
            console.warn(`[${TRACE_ID}] ⚠️ Usuario no encontrado en Cognito: ${member.user_sub}`);
            return {
              id: member.user_sub,
              nombre: 'Usuario no encontrado',
              email: 'desconocido@ejemplo.com',
              rol: member.role,
              fecha_ingreso: member.added_at,
              esCreador: member.role === 'owner'
            };
          }
        } catch (error) {
          console.error(`[${TRACE_ID}] ⚠️ Error obteniendo info de usuario ${member.user_sub}:`, error);
          return {
            id: member.user_sub,
            nombre: 'Error al cargar',
            email: 'error@ejemplo.com',
            rol: member.role,
            fecha_ingreso: member.added_at,
            esCreador: member.role === 'owner'
          };
        }
      })
    );

    console.log(`[${TRACE_ID}] ✅ Miembros obtenidos exitosamente`);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        ok: true,
        miembros: enrichedMembers,
        total: enrichedMembers.length,
        trace_id: TRACE_ID
      })
    };

  } catch (error) {
    console.error(`[${TRACE_ID}] ❌ Error obteniendo miembros:`, error);
    
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        ok: false, 
        error: "Error al obtener los miembros",
        details: error.message,
        trace_id: TRACE_ID
      })
    };
  }
};
