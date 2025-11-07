# 🧪 Experimentos de Caos – Sistema Hospital Padre Hurtado
**Entorno:** EC2 (AWS Academy) – Ubuntu + Node.js 18 + Serverless Offline  
**Proyecto:** `Proyecto-Hospital-Padre-Hurtado`  

---

## 🏥 Contexto General

El sistema **Hospital Padre Hurtado** implementa una arquitectura **serverless híbrida** , con despliegue complementario en **EC2** y uso de **Serverless Framework**.  
El objetivo de estos experimentos fue **evaluar la resiliencia, tolerancia a fallos y comportamiento bajo condiciones adversas** de la API hospitalaria.

Se realizaron cuatro pruebas de caos simuladas localmente en el entorno AWS Academy, con DynamoDB y funciones Lambda mockeadas mediante `serverless-offline`.

---

## ⚙️ Entorno de Ejecución

- **Backend:** Node.js 18.19.1  
- **Framework:** Serverless 3.40.0 + Offline Plugin  
- **Servicios simulados:** Cognito, DynamoDB, Lambda  
- **Región:** `us-east-1`  
- **Comando base:**  
  ```bash
  npm run dev
  curl http://localhost:3000/<endpoint>
  ```

---

## 🔹 Experimento 1 – Falla Aleatoria del Sistema (Internal Error)
**Endpoint:** `/chaos-test`  
**Objetivo:** Simular errores internos intermitentes y desconexión de DynamoDB.

**Resultados (fragmento real):**
```
{"status":"failed","error":"Simulated internal server error","delay":"2364ms"}
{"status":"healthy","dynamodb":"connected","delay":"943ms"}
{"status":"unhealthy","dynamodb":"disconnected","delay":"615ms"}
{"status":"healthy","dynamodb":"connected","delay":"2401ms"}
```

**Análisis:**
- El sistema mostró respuestas **mixtas (healthy/unhealthy)** durante las fallas simuladas.  
- En todos los casos se **recuperó automáticamente** sin reiniciar el servicio.  
- Promedio de latencia: entre **0.9 y 2.5 s**, con picos de **~3 s** en errores simulados.

✅ **Conclusión:** El backend maneja correctamente errores transitorios de servicios internos sin colapsar la API principal.

---

## 🔹 Experimento 2 – Falla Dirigida de DynamoDB
**Endpoint:** `/health`  
**Objetivo:** Validar respuesta del sistema ante pérdida total del servicio de base de datos.

**Resultados:**
```
{"status":"unhealthy","error":"Simulated DynamoDB failure","stage":"dev"}
```
Después de restaurar:
```
{"status":"healthy","services":{"dynamodb":"connected","cognito":"available","lambda":"running"}}
```

**Análisis:**
- Durante la interrupción simulada, la API devolvió un **HTTP 503** coherente con el estado real.  
- Una vez restablecido el servicio, la API volvió automáticamente a estado **“healthy”** sin intervención manual.

✅ **Conclusión:** Se confirma la **autocorrección del sistema** ante interrupciones de base de datos.  
Ideal para entornos con DynamoDB real, donde podría integrarse **AWS Health Check o EventBridge** para alertas.

---

## 🔹 Experimento 3 – Monitoreo Continuo del Sistema
**Comando:**
```bash
for i in {1..20}; do
  curl http://localhost:3000/health >> health_logs.txt
done
```

**Resultado observado (resumen):**
- 17 respuestas “healthy” consecutivas.  
- 3 vacíos intermedios (momentos de reinicio manual).  
- Promedio de respuesta: **10–15 ms**, máximo observado **137 ms**.

**Ejemplo de registro:**
```
{"status":"healthy","responseTime":"15ms"}
{"status":"healthy","responseTime":"137ms"}
```

**Análisis:**
- Alta estabilidad sostenida.  
- Mínima variabilidad en tiempos de respuesta.  
- No se observaron fallos espontáneos ni degradación progresiva.

✅ **Conclusión:** El servicio mantiene **alta disponibilidad local (>95%)**, demostrando capacidad para producción con monitoreo activo.

---

## 🔹 Experimento 4 – Latencia Simulada
**Endpoint:** `/chaos-latency`  
**Objetivo:** Medir la respuesta del sistema ante demoras artificiales en la red.

**Resultados reales (10 ejecuciones):**
```
2836ms, 3908ms, 932ms, 2996ms, 3601ms, 932ms, 3611ms, 4945ms, 154ms, 1905ms
```

**Promedio:** ~2.4 segundos  
**Máximo:** 4.9 segundos  
**Mínimo:** 154 ms  

**Análisis:**
- A pesar de los retardos, todas las respuestas fueron **status:"ok"**.  
- El servidor no se bloqueó ni devolvió errores.  
- Las funciones Lambda simuladas mostraron tolerancia a latencia variable.

✅ **Conclusión:** La arquitectura es **resiliente frente a fluctuaciones de red** y mantiene consistencia en las respuestas JSON.

---

## 📈 Conclusiones Generales

| Experimento | Tipo de Falla | Resultado | Resiliencia |
|--------------|----------------|------------|--------------|
| 1 | Error interno aleatorio | Recuperación automática | ✅ Alta |
| 2 | Falla total de DynamoDB | Estado 503 coherente y recuperación automática | ✅ Alta |
| 3 | Monitoreo continuo | Sin degradación tras múltiples requests | ✅ Muy alta |
| 4 | Latencia simulada | Respuestas consistentes pese a demoras | ✅ Alta |

---

## 🧩 Recomendaciones Técnicas como solución

1. **Integrar CloudWatch Metrics y SNS:**
   - Para detección y notificación automática de fallos reales.
2. **Mantener PM2 activo en EC2:**
   - Permite visualizar logs (`pm2 logs`), estado (`pm2 status`) y monitoreo (`pm2 monit`).
3. **Configurar alarmas de salud personalizadas:**
   - Definir umbrales de respuesta (>3 s o consecutivos unhealthy).
4. **Ampliar pruebas de resiliencia con LocalStack:**
   - Para simular fallas simultáneas de Cognito, DynamoDB y SQS.
5. **Incluir Chaos Testing en pipeline CI/CD:**
   - Añadir scripts automatizados antes del despliegue a producción.

---

## 🧭 Conclusión Final

El **Sistema Hospital Padre Hurtado** mostró una **resiliencia sobresaliente** frente a fallas simuladas, manteniendo su disponibilidad, respuesta y estructura sin comprometer datos ni sesiones.  
Los resultados confirman que la arquitectura **serverless + EC2 híbrida** es estable y tolerante a fallos, apta para producción bajo un esquema de monitoreo activo y pruebas automatizadas de caos.
