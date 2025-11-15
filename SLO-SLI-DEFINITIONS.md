# 📊 Definiciones de SLOs y SLIs - Hospital Padre Hurtado

## 🎯 Service Level Objectives (SLOs) y Service Level Indicators (SLIs)

Este documento define los objetivos de nivel de servicio y los indicadores para el sistema de gestión de espacios hospitalarios.

---

## 📋 Tabla de Contenidos

1. [SLIs Definidos](#slis-definidos)
2. [SLOs por Servicio](#slos-por-servicio)
3. [Error Budgets](#error-budgets)
4. [Alertas y Escalamiento](#alertas-y-escalamiento)

---

## 1️⃣ SLIs Definidos

### 🚀 Disponibilidad (Availability)

**Definición:** Porcentaje de requests exitosos sobre el total de requests.

```
Availability = (Successful Requests / Total Requests) × 100
```

**Cálculo:**
- ✅ **Exitoso:** HTTP 2xx, 3xx
- ❌ **Fallido:** HTTP 4xx (excepto 429), 5xx, timeouts

**Medición:** CloudWatch Metrics de API Gateway y Lambda

---

### ⏱️ Latencia (Latency)

**Definición:** Tiempo de respuesta del sistema medido en percentiles.

**Métricas:**
- **P50 (Mediana):** 50% de requests responden en X ms
- **P95:** 95% de requests responden en X ms
- **P99:** 99% de requests responden en X ms

**Medición:** CloudWatch Metrics - Duration y IntegrationLatency

---

### 📈 Throughput

**Definición:** Número de requests procesados por segundo.

```
Throughput = Requests / Second
```

**Medición:** CloudWatch Metrics - Count con estadística Sum y period 1 minuto

---

### 🔥 Tasa de Errores (Error Rate)

**Definición:** Porcentaje de requests fallidos.

```
Error Rate = (Failed Requests / Total Requests) × 100
```

**Tipos de errores:**
- **4xx:** Errores del cliente (validación, autenticación)
- **5xx:** Errores del servidor (bugs, timeouts)

**Medición:** CloudWatch Metrics - 4XXError, 5XXError

---

## 2️⃣ SLOs por Servicio

### 🔐 Servicio de Autenticación (Login)

| SLI | SLO | Justificación |
|-----|-----|---------------|
| **Disponibilidad** | 99.9% mensual | Crítico - usuarios no pueden acceder sin login |
| **Latencia P95** | < 500ms | Experiencia de usuario - login rápido |
| **Latencia P99** | < 1000ms | Casos edge aceptables |
| **Error Rate** | < 0.5% | Alta confiabilidad requerida |

**Error Budget:** 43.2 minutos/mes de downtime

---

### 📅 Servicio de Agenda

| SLI | SLO | Justificación |
|-----|-----|---------------|
| **Disponibilidad** | 99.5% mensual | Importante - operaciones pueden retrasarse |
| **Latencia P95** | < 800ms | Queries complejas con DynamoDB |
| **Latencia P99** | < 1500ms | Búsquedas con filtros múltiples |
| **Error Rate** | < 1% | Tolerancia a errores temporales |

**Error Budget:** 3.6 horas/mes de downtime

---

### 🎨 Servicio de Personalización

| SLI | SLO | Justificación |
|-----|-----|---------------|
| **Disponibilidad** | 99.0% mensual | No crítico - puede usar defaults |
| **Latencia P95** | < 1000ms | Carga asíncrona aceptable |
| **Latencia P99** | < 2000ms | Background operations |
| **Error Rate** | < 2% | Degradación graceful |

**Error Budget:** 7.2 horas/mes de downtime

---

### 🏥 Servicio de Catálogos (Médicos/Boxes/Instrumentos)

| SLI | SLO | Justificación |
|-----|-----|---------------|
| **Disponibilidad** | 99.5% mensual | Core functionality |
| **Latencia P95** | < 600ms | Lecturas optimizadas con GSI |
| **Latencia P99** | < 1200ms | Queries con múltiples filtros |
| **Error Rate** | < 1% | Alta consistencia requerida |

**Error Budget:** 3.6 horas/mes de downtime

---

### 🔔 Servicio de Notificaciones

| SLI | SLO | Justificación |
|-----|-----|---------------|
| **Disponibilidad** | 98.0% mensual | Eventual consistency aceptable |
| **Latencia P95** | < 2000ms | Procesamiento asíncrono |
| **Latencia P99** | < 5000ms | SNS + SQS delays |
| **Error Rate** | < 5% | Retry mechanism disponible |

**Error Budget:** 14.4 horas/mes de downtime

---

## 3️⃣ Error Budgets

### 📊 Cálculo de Error Budget

**Fórmula:**
```
Error Budget (minutes) = Total Minutes × (1 - SLO%)
```

**Ejemplo para 99.9% SLO:**
```
Error Budget = 43,200 min/mes × (1 - 0.999) = 43.2 min/mes
```

### 🎯 Presupuestos por Servicio (Mensual)

| Servicio | SLO | Error Budget | Downtime Permitido |
|----------|-----|--------------|-------------------|
| Login | 99.9% | 43.2 min | ~10 min/semana |
| Agenda | 99.5% | 216 min | ~54 min/semana |
| Catálogos | 99.5% | 216 min | ~54 min/semana |
| Personalización | 99.0% | 432 min | ~108 min/semana |
| Notificaciones | 98.0% | 864 min | ~216 min/semana |

### 🚨 Política de Consumo de Error Budget

**Alerta Verde (0-30% consumido):**
- ✅ Despliegues normales
- ✅ Experimentos de caos permitidos
- ✅ Refactoring permitido

**Alerta Amarilla (30-70% consumido):**
- ⚠️ Reducir frecuencia de deploys
- ⚠️ Posponer experimentos de caos
- ⚠️ Focus en estabilidad

**Alerta Roja (70-100% consumido):**
- 🚫 Freeze de features nuevas
- 🚫 Solo bug fixes críticos
- 🚫 No chaos experiments
- 🔧 Post-mortem obligatorio

**Breach (>100% consumido):**
- 🔥 Incident response activado
- 🔥 Rollback inmediato
- 🔥 Root cause analysis
- 🔥 Plan de remediación en 24h

---

## 4️⃣ Alertas y Escalamiento

### 🔔 Configuración de Alarmas

#### **Nivel 1: Warning (Amarillo)**

**Condiciones:**
- Disponibilidad < 99.95% en 5 minutos
- Latencia P95 > 80% del SLO en 10 minutos
- Error rate > 1% en 5 minutos

**Acciones:**
- Notificación Slack/email
- Log en Activity Logs
- Monitoreo activo (no requiere acción inmediata)

---

#### **Nivel 2: Critical (Rojo)**

**Condiciones:**
- Disponibilidad < 99% en 5 minutos
- Latencia P99 > 120% del SLO en 5 minutos
- Error rate > 5% en 5 minutos
- Error budget > 70% consumido

**Acciones:**
- PagerDuty/llamada telefónica
- Escalamiento a on-call engineer
- Incident response iniciado
- Post en status page

---

#### **Nivel 3: Emergency (Negro)**

**Condiciones:**
- Disponibilidad < 95% en 2 minutos
- Error rate > 20% en 2 minutos
- Lambda throttling > 100 invocaciones/min
- DynamoDB throttling detectado

**Acciones:**
- Escalamiento a senior engineer + manager
- Posible rollback automático
- Customer communication
- War room iniciado

---

### 📞 Escalamiento

**Tier 1: Dev Team**
- Respuesta: 15 minutos
- Resolución target: 1 hora
- Cobertura: 9 AM - 6 PM (lunes-viernes)

**Tier 2: Senior Engineers**
- Respuesta: 5 minutos
- Resolución target: 30 minutos
- Cobertura: 24/7 on-call rotation

**Tier 3: Architecture Team**
- Respuesta: Inmediata
- Resolución target: 15 minutos
- Cobertura: Critical incidents only

---

## 📈 Dashboards CloudWatch

### Dashboard Principal: "HPP-System-Health"

**Widgets incluidos:**
1. **Availability by Service** - Gauge widgets (99.9%, 99.5%, 99%)
2. **Request Rate** - Line graph (requests/min)
3. **Error Rate** - Stacked area (4xx vs 5xx)
4. **Latency Percentiles** - Multi-line (P50, P95, P99)
5. **Error Budget Burn Rate** - Progress bar
6. **Lambda Metrics** - Concurrent executions, throttles
7. **DynamoDB Metrics** - Read/Write capacity, throttles
8. **Cost Metrics** - Estimated daily cost

### Dashboard Secundario: "HPP-Chaos-Experiments"

**Widgets incluidos:**
1. **Active Experiments** - Number widget
2. **Blast Radius** - Map of affected services
3. **Recovery Time** - Time series
4. **Hypothesis Validation** - Pass/Fail count

---

## 🎯 Métricas de Negocio (Business KPIs)

Además de los SLIs técnicos, monitoreamos:

| KPI | Target | Medición |
|-----|--------|----------|
| **Logins exitosos/día** | > 500 | Custom metric |
| **Agendamientos creados/día** | > 100 | Custom metric |
| **Tiempo promedio agendamiento** | < 3 min | User journey tracking |
| **Tasa de cancelación** | < 5% | Business logic metric |
| **Satisfacción de usuario** | > 4.5/5 | Encuestas in-app |

---

## 🔄 Revisión y Ajuste

**Frecuencia:** Mensual

**Proceso:**
1. Revisar error budget consumption
2. Analizar incidents y near-misses
3. Ajustar SLOs si son muy estrictos/laxos
4. Actualizar alertas basado en false positives
5. Documentar lessons learned

**Criterios para ajustar SLOs:**
- ✅ **Relajar SLO:** Si error budget nunca se consume (< 10% uso consistente)
- ✅ **Endurecer SLO:** Si usuarios reportan problemas pero SLO se cumple
- ✅ **Cambiar SLI:** Si métrica actual no refleja user experience

---

**Documento creado:** 15 de noviembre de 2025  
**Versión:** 1.0  
**Próxima revisión:** 15 de diciembre de 2025  
**Owner:** DevOps Team
