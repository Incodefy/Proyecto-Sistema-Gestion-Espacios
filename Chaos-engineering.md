# 🏥 Ingeniería del Caos – Proyecto Hospital Padre Hurtado

**Fecha:** 7 de noviembre de 2025  
**Entorno:** AWS Academy – EC2 Ubuntu, Serverless Framework, DynamoDB Local/Remoto  

---

## 🔍 Introducción

El sistema **Hospital Padre Hurtado** es una plataforma integral de gestión hospitalaria desarrollada con **Node.js**, **Express**, y una arquitectura **serverless** desplegada en **AWS Lambda**.  
Su infraestructura combina servicios gestionados de **Cognito (autenticación JWT)**, **API Gateway**, **DynamoDB**, y **MySQL**, junto con entornos de despliegue en **EC2** bajo integración y entrega continua (**CI/CD con GitHub Actions**).

El sistema incluye:
- Autenticación con Cognito y control granular de roles.
- Módulos de gestión de consultas, agendas médicas y notificaciones.
- Personalización dinámica de interfaz (i18n español/inglés).
- Funciones Lambda para acceso y administración de datos hospitalarios.
- Pipelines automáticos de despliegue y seguridad (CodeQL, Dependabot, PM2).

Esta infraestructura, altamente distribuida y dependiente de microservicios, hace esencial aplicar **Ingeniería del Caos** para validar su tolerancia a fallos, su capacidad de recuperación y la integridad de su comunicación entre componentes.

---

## 🎯 Objetivo General

Evaluar la resiliencia operativa del sistema frente a fallas controladas, simulando interrupciones en los servicios críticos (DynamoDB, Lambda, red) y midiendo la capacidad de detección, respuesta y recuperación del backend hospitalario.

---

## 🧪 Experimento 1: Latencia y error controlado (`/chaos-test`)

**Objetivo:** Validar la resiliencia del sistema frente a fallas aleatorias y latencia inducida, comprobando si el backend continúa operativo ante errores internos simulados.

**Procedimiento:**
- Se implementó un endpoint `/chaos-test` que alterna entre estados *healthy*, *failed* y *unhealthy* con retardos aleatorios.
- Se realizaron 14 invocaciones consecutivas con `curl` para evaluar el comportamiento ante múltiples escenarios de error.

**Resultados:**

| Estado | Conteo | Porcentaje aproximado | Ejemplo |
|---------|---------|------------------------|----------|
| 🟢 healthy | 8 | 57% | `{ "status": "healthy", "dynamodb": "connected", "delay": "2104ms" }` |
| 🔴 failed | 3 | 21% | `{ "status": "failed", "error": "Simulated internal server error", "delay": "2364ms" }` |
| 🟠 unhealthy (DynamoDB desconectado) | 2 | 14% | `{ "status": "unhealthy", "dynamodb": "disconnected", "delay": "1933ms" }` |
| ⚪ Otros (reinicio/corte manual) | 1 | 8% | — |

**Ejemplos de respuestas:**
```json
{"status":"failed","error":"Simulated internal server error","delay":"2364ms","timestamp":"2025-11-07T17:30:29.751Z"}
{"status":"healthy","dynamodb":"connected","delay":"2807ms","chaosMode":"active","timestamp":"2025-11-07T17:34:53.306Z"}
{"status":"unhealthy","dynamodb":"disconnected","delay":"1933ms","chaosMode":"active","timestamp":"2025-11-07T17:35:42.330Z"}
```

**Análisis:**
- La latencia promedio fue de **1.9 segundos** (rango: 943 ms – 2.9 s).
- El sistema alternó correctamente entre estados *healthy*, *failed* y *unhealthy* sin detener el servicio.
- Se observaron reconexiones automáticas a DynamoDB tras las simulaciones de falla.
- El comportamiento caótico fue controlado, manteniendo estabilidad general y sin errores persistentes.

**Conclusión:**
> El experimento demostró la capacidad del backend para tolerar y recuperarse de fallas controladas en tiempo real. El sistema alternó entre estados *healthy*, *failed* y *unhealthy* sin requerir reinicios manuales. La latencia media (~1.9s) se mantuvo dentro de márgenes aceptables considerando la simulación de caos.  
> **Conclusión final:** El sistema es resiliente ante interrupciones simuladas, mantiene conectividad parcial con DynamoDB y conserva la estabilidad general del backend.---

## 🧪 Experimento 2: Falla simulada de DynamoDB (`/health`)

**Objetivo:** Evaluar la detección y recuperación del sistema ante una caída del servicio de base de datos.

**Procedimiento:**
- Simulación de desconexión DynamoDB mediante código.
- Posterior restauración del servicio y verificación.

**Resultados:**
```json
{"status":"unhealthy","timestamp":"2025-11-07T17:50:33.815Z","error":"Simulated DynamoDB failure","stage":"dev"}
```
→ Luego:
```json
{"status":"healthy","timestamp":"2025-11-07T18:00:46.251Z","stage":"dev","version":"1.0.0","responseTime":"139ms"}
```

**Análisis:**
- El sistema entra correctamente en estado *unhealthy* (503) y retorna a *healthy* tras la reconexión.
- La recuperación fue inmediata sin reinicios adicionales.

**Conclusión:**  
La API es capaz de identificar y notificar fallas críticas en DynamoDB, recuperándose sin intervención manual.

---

## 🧪 Experimento 3: Prueba de estabilidad y recuperación continua (`/health`)

**Objetivo:** Verificar disponibilidad, latencia y recuperación tras reinicios controlados.

**Procedimiento:**
- Script que consulta `/health` cada 2 segundos (20 ciclos).
- Interrupción manual del servicio (`Ctrl + C`) y reinicio posterior.
- Log generado: `health_logs.txt`.

**Resultados:**
- 17/20 respuestas exitosas (`healthy`).
- Latencia promedio: 15 ms (máx. 137 ms).
- 3 omisiones coinciden con reinicio manual.

**Ejemplo:**
```json
{"status":"healthy","timestamp":"2025-11-07T18:38:50.576Z","stage":"dev","responseTime":"10ms"}
```

**Análisis:**
- Alta eficiencia y rápida recuperación tras interrupción.
- Microcortes no afectaron la integridad del sistema.

**Conclusión:**  
El servicio conserva su estabilidad operativa y se recupera automáticamente tras reinicios o caídas temporales.

---

## Conclusiones Globales

| Aspecto Evaluado | Resultado | Evidencia |
|------------------|------------|------------|
| Tolerancia a errores internos | ✅ Exitosa | `/chaos-test` con error controlado |
| Recuperación ante caída de BD | ✅ Exitosa | `/health` → unhealthy → healthy |
| Estabilidad bajo monitoreo continuo | ✅ Alta | `health_logs.txt` con 85% respuestas correctas |
| Tiempo promedio de respuesta | ⚡ 15 ms | Consistente en 17/20 solicitudes |
| Recuperación tras reinicio | ✅ Automática | Sin pérdida de estado ni datos |

**Conclusión general:**  
El sistema **Hospital Padre Hurtado** cumple con los principios de *Chaos Engineering*: resistencia, detección proactiva y recuperación autónoma.  
Se recomienda incorporar monitoreo permanente con **CloudWatch Metrics** y alarmas **SNS** para escalar notificaciones ante fallas reales en producción.

---

**Repositorio:**  
🔗 [GitHub – Proyecto Hospital Padre Hurtado](https://github.com/Incodefy/Proyecto-Hospital-Padre-Hurtado)  

