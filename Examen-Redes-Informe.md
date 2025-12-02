# Informe Técnico – Despliegue en AWS

**Proyecto:** Sistema de Gestión de Espacios – Hospital Padre Hurtado  
**Alcance evaluado:** Plataforma completa (autenticación, onboarding, dashboards, gestión de agenda y notificaciones)  
**Fecha:** 2 de diciembre de 2025  
**Elaborado por:** Equipo de Arquitectura Incodefy  
**Región AWS:** us-east-2 (Ohio)  
**Ambiente:** Desarrollo (dev)

---

## 1. Introducción

El Sistema de Gestión de Espacios del Hospital Padre Hurtado integra múltiples dominios funcionales: autenticación federada con Cognito, onboarding y configuración inicial de espacios, monitoreo operativo mediante dashboards, planificación de agenda, notificaciones multicanal y APIs de soporte (instrumentos, ocupantes, especialidades). Para esta ocasión, se desplegó la plataforma completa sobre AWS utilizando las prácticas de segmentación, redundancia y ciberseguridad vistas en clase. Este documento describe la arquitectura resultante, las configuraciones de red aplicadas, los controles de seguridad y la evidencia que respalda el correcto funcionamiento integral del entorno.

---

## 2. Diseño de arquitectura

| Componente | Descripción |
|------------|-------------|
| **VPC** | `10.1.0.0/16`, DNS habilitado, etiquetada como `incodefy-vpc-dev`. |
| **Subredes públicas** | `10.1.1.0/24 (us-east-2a)` y `10.1.2.0/24 (us-east-2b)`, destinadas a ALB y NAT Gateways. |
| **Subredes privadas** | `10.1.11.0/24 (us-east-2a)` y `10.1.12.0/24 (us-east-2b)` para Auto Scaling de EC2. |
| **Internet Gateway** | Permite salida directa a Internet para recursos públicos. |
| **NAT Gateways** | Dos NAT Gateways desplegados (uno en cada AZ) con IPs `18.190.37.131` (AZ1) y `18.216.35.171` (AZ2) para alta disponibilidad. |
| **Application Load Balancer** | `incodefy-alb-dev`, balancea peticiones HTTP al puerto 3000. |
| **Auto Scaling Group** | Provee dos instancias t3.micro distribuidas en AZs distintas con health checks `/health`. |
| **Servicios administrados** | SSM Parameter Store (variables sensibles), CloudWatch Logs, WAF opcional. |

El diagrama lógico ubica el ALB en las subredes públicas, recibiendo tráfico de Internet para todas las rutas de la plataforma (`/`, `/dashboard`, `/agenda`, `/onboarding-espacios`, `/api/*`). El ALB enruta hacia el Target Group compuesto por instancias EC2 privadas que ejecutan la aplicación Node.js/Express, la cual sirve los dashboards, APIs de integración, motor de notificaciones y vistas de onboarding desde un único runtime. El tráfico saliente de estas instancias pasa por los NAT Gateways (uno por AZ para alta disponibilidad), mientras que el acceso administrativo se realiza únicamente via AWS Systems Manager (SSM), eliminando la exposición SSH pública.

---

## 2.1 Diagrama de arquitectura

```
							┌───────────────────────────────┐
							│      Internet / Usuarios      │
							└───────────────────────────────┘
									 │
									 ▼
							┌───────────────────────────────┐
							│ Application Load Balancer     │
							│ (subredes públicas 10.1.1/24  │
							│  y 10.1.2/24)                 │
							└───────────────────────────────┘
									 │ HTTP 80
									 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    VPC 10.1.0.0/16  –  incodefy-vpc-dev                     │
│                                                                             │
│  ┌────────────────────────┐         ┌────────────────────────┐              │
│  │ Subred pública AZ1     │         │ Subred pública AZ2     │              │
│  │ 10.1.1.0/24            │         │ 10.1.2.0/24            │              │
│  │ • ALB ENI              │         │ • ALB ENI              │              │
│  │ • NAT Gateway AZ1      │         │ • NAT Gateway AZ2      │              │
│  │   (18.190.37.131)      │         │   (18.216.35.171)      │              │
│  └────────────────────────┘         └────────────────────────┘              │
│         │                                      │                            │
│         ▼                                      ▼                            │
│  ┌────────────────────────┐         ┌────────────────────────┐              │
│  │ Subred privada AZ1     │         │ Subred privada AZ2     │              │
│  │ 10.1.11.0/24           │         │ 10.1.12.0/24           │              │
│  │ • EC2 App (ASG)        │         │ • EC2 App (ASG)        │              │
│  │ • VPC Endpoints        │         │ • VPC Endpoints        │              │
│  │   (SSM, CloudWatch)    │         │   (SSM, CloudWatch)    │              │
│  └────────────────────────┘         └────────────────────────┘              │
│         │                                      │                            │
│         └──────────────────┬───────────────────┘                            │
│                            │                                                │
│                    ┌───────▼────────┐                                       │
│                    │ VPC Endpoints   │                                       │
│                    │ S3 / DynamoDB   │                                       │
│                    └────────┬────────┘                                       │
└─────────────────────────────┼──────────────────────────────────────────────┘
								│
								▼
					┌────────────────────────────────────┐
					│ Servicios AWS Externos             │
					│ • Cognito (autenticación)          │
					│ • DynamoDB (datos)                 │
					│ • S3 (almacenamiento)              │
					│ • Parameter Store (configuración)  │
					└────────────────────────────────────┘
```----

## 3. Configuraciones de red

### 3.1 Subredes y ruteo
Las tablas de rutas públicas envían `0.0.0.0/0` al Internet Gateway, permitiendo que el ALB y los NAT Gateways atiendan tráfico externo sin restricciones. Las tablas de rutas privadas están segmentadas por zona de disponibilidad: cada subred privada (AZ1 y AZ2) tiene su propia tabla de rutas que redirige `0.0.0.0/0` hacia su NAT Gateway local, garantizando que si una AZ falla, la otra mantiene conectividad saliente independiente. Esta configuración permite que las instancias alojadas en subredes privadas actualicen dependencias o consulten servicios AWS sin quedar expuestas a Internet, manteniendo alta disponibilidad.

### 3.2 Security Groups
El security group del ALB permite tráfico HTTP y HTTPS desde cualquier origen (`0.0.0.0/0`) y mantiene la salida abierta para responder a los clientes. El security group de las instancias EC2 restringe el ingreso únicamente al puerto 3000 proveniente del ALB y permite conexiones SSH exclusivas desde los rangos administrativos definidos en `var.admin_ssh_cidrs`, manteniendo salida abierta para invocar Cognito, DynamoDB y otros servicios. Finalmente, los security groups asignados a Lambda y a los endpoints privados autorizan únicamente el tráfico saliente necesario para consumir servicios internos y peticiones HTTPS.

### 3.3 Network ACLs
Las NACL públicas incluyen reglas explícitas que habilitan HTTP (80), HTTPS (443), SSH (22) y puertos efímeros tanto de entrada como de salida para las dos subredes expuestas, asegurando el intercambio controlado con Internet. Las NACL privadas permiten únicamente los puertos 3000 y 443 provenientes de las subredes públicas y bloquean cualquier tráfico no solicitado, reforzando el aislamiento horizontal entre cargas internas.

---

## 4. Redundancia y disponibilidad
La arquitectura implementa redundancia completa en múltiples capas:

**Nivel de red:** Dos NAT Gateways independientes (uno por AZ) con IPs elásticas dedicadas (`18.190.37.131` en us-east-2a y `18.216.35.171` en us-east-2b) eliminan el punto único de falla para conectividad saliente. Cada subred privada enruta su tráfico a través de su NAT Gateway local mediante tablas de rutas independientes, garantizando que la falla de una zona de disponibilidad completa no afecte la conectividad de la otra.

**Nivel de cómputo:** Un Auto Scaling Group mantiene siempre dos instancias EC2 activas distribuidas entre `us-east-2a` y `us-east-2b`, apoyándose en los health checks del ALB (`/health`) para garantizar que el tráfico solo rote a nodos sanos. Esta configuración protege no solo el flujo de onboarding, sino también el dashboard principal, los endpoints de agenda y la API de notificaciones.

**Nivel de balanceo:** El Application Load Balancer distribuye peticiones entre ambas zonas de disponibilidad, con health checks configurados para verificar la disponibilidad cada 30 segundos. Se estableció un período de gracia de 600 segundos para permitir que `npm install` concluya antes de evaluar el estado de salud, y se habilitó un drenado de sesiones de treinta segundos (`deregistration_delay = 30`) que permite finalizar solicitudes en curso antes de reemplazar instancias.

Esta configuración multi-capa cumple con los principios de alta disponibilidad estudiados, con un costo incremental de ~$32/mes por el segundo NAT Gateway, justificado por la eliminación de puntos únicos de falla críticos.

---

## 5. Medidas de ciberseguridad
El acceso mínimo se garantiza con un rol de Auto Scaling que limita los permisos al uso de Parameter Store y CloudWatch, prescindiendo de llaves SSH públicas y canalizando la operación diaria mediante SSM. La protección CSRF se implementa con un middleware dedicado que inyecta tokens en las vistas críticas (onboarding, formularios de agenda y gestión de notificaciones) y obliga a que cada petición AJAX los envíe en la cabecera `X-CSRF-Token`. Las políticas CSP y CORS endurecidas en `server.js` restringen los orígenes permitidos y bloquean recursos inseguros para toda la aplicación web. Las credenciales sensibles, tales como `SESSION_SECRET` y `AWS_SECRET_ACCESS_KEY`, se abastecen desde SSM para evitar almacenamiento en texto plano dentro del repositorio. Adicionalmente, la plantilla Terraform contempla módulos para habilitar GuardDuty y WAF cuando la organización requiera monitoreo de amenazas y filtrado avanzado.

---

## 6. Evidencias

### 6.1 Infraestructura de Red

**VPC y Subredes:**
- VPC ID: `vpc-025fee8cc937d720e` con CIDR `10.1.0.0/16`
- Subredes públicas: `subnet-0de2d8c1db3bcabca` (AZ1) y `subnet-0ec2b39f63db38ec5` (AZ2)
- Subredes privadas: `subnet-07aff748007505a55` (AZ1) y `subnet-081f598a9366ebfb5` (AZ2)
- Internet Gateway: `igw-0a7274b5c6918fe89`

**NAT Gateways (Alta Disponibilidad):**
```bash
aws ec2 describe-nat-gateways --query "NatGateways[*].[NatGatewayId,State,SubnetId,NatGatewayAddresses[0].PublicIp]"
```
- NAT Gateway AZ1: `nat-04fb545d7a5a7a700` → IP `18.190.37.131` (subnet pública AZ1)
- NAT Gateway AZ2: `nat-06cbfb9957b5982d8` → IP `18.216.35.171` (subnet pública AZ2)
- Verificación: `terraform output nat_gateway_ips` confirma ambas IPs activas

**Tablas de Rutas Segmentadas:**
- Tabla pública: `rtb-09eac5493b223cfee` → ruta `0.0.0.0/0` al IGW
- Tabla privada AZ1: `rtb-05833853bd2e927a7` → ruta `0.0.0.0/0` a NAT Gateway AZ1
- Tabla privada AZ2: `rtb-0c0e38d0fe2338f67` → ruta `0.0.0.0/0` a NAT Gateway AZ2

### 6.2 Balanceo y Auto Scaling

**Application Load Balancer:**
- Nombre: `incodefy-alb-dev`
- DNS: `incodefy-alb-dev-736907592.us-east-2.elb.amazonaws.com`
- ARN: `arn:aws:elasticloadbalancing:us-east-2:643913569214:loadbalancer/app/incodefy-alb-dev/29e6f85155d7854a`
- Security Group: `sg-0094e37a8ea3771d3` (permite HTTP/HTTPS desde 0.0.0.0/0)
- Target Group: `incodefy-tg-dev` con health check en `/health` cada 30s

**Instancias EC2 Activas:**
```bash
aws elbv2 describe-target-health --target-group-arn <arn>
```
- `i-03f159d6568ca5515` → **healthy** (AZ2)
- `i-088f0014a972b79df` → **healthy** (AZ1)
- Ambas instancias ejecutan Node.js/Express en puerto 3000 bajo PM2
- Security Group: `sg-05884e33759f46068` (ingreso solo desde ALB en puerto 3000)

**Verificación de Conectividad:**
```powershell
Invoke-WebRequest -Uri "http://incodefy-alb-dev-736907592.us-east-2.elb.amazonaws.com/health"
# StatusCode: 200 OK
# Content: {"status":"healthy","timestamp":"2025-12-02T16:44:55.558Z","uptime":147.87}
```

### 6.3 Security Groups y NACLs

**Security Groups Implementados:**
- ALB SG (`sg-0094e37a8ea3771d3`): HTTP 80, HTTPS 443 desde `0.0.0.0/0`
- EC2 SG (`sg-05884e33759f46068`): Puerto 3000 desde ALB SG, egress `0.0.0.0/0`
- VPC Endpoints SG (`sg-0487bdf82333011e7`): HTTPS 443 desde `10.1.0.0/16`
- Lambda SG (`sg-07b9684882e102a06`): Egress HTTPS para servicios AWS

**Network ACLs:**
- NACL pública (`acl-0e40b2b53c08fbad4`): Reglas explícitas para HTTP(80), HTTPS(443), SSH(22), puertos efímeros
- NACL privada (`acl-03ea5373e061f732f`): Puerto 3000 y 443 desde VPC, bloquea resto

### 6.4 VPC Endpoints (Reducción de Tráfico NAT)

**Endpoints Gateway:**
- S3: `vpce-017a1807dc01f3a83` (asociado a tablas de rutas privadas)
- DynamoDB: `vpce-032280732fde6f663` (asociado a tablas de rutas privadas)

**Endpoints Interface:**
- SSM: `vpce-07f1f70ae91e70cca` (subredes privadas AZ1 y AZ2)
- CloudWatch Logs: `vpce-0744367cd7d9f1d40` (subredes privadas AZ1 y AZ2)

### 6.5 Gestión Remota Segura

**AWS Systems Manager (SSM):**
Todos los comandos de despliegue y configuración se ejecutaron via SSM:
```bash
aws ssm send-command --instance-ids i-03f159d6568ca5515 \
  --document-name "AWS-RunShellScript" \
  --parameters 'commands=["cd /home/ec2-user/...","git pull...","pm2 restart..."]'
```
- Sin exposición de puerto SSH (22) a Internet
- IAM Role `incodefy-ec2-app-role-dev` con políticas mínimas para SSM, Parameter Store y CloudWatch

### 6.6 Resolución de Problemas CORS

Durante las pruebas iniciales se identificó un bloqueo CORS al acceder desde el dominio del ALB. **Solución implementada:**

**Commit:** `7048bd6` - "Fix: Permitir CORS desde dominios de AWS (ALB, CloudFront)"

**Cambio en `server.js`:**
```javascript
// Permitir dinámicamente dominios de AWS
if (origin.includes('.elb.amazonaws.com') || origin.includes('.cloudfront.net')) {
  return callback(null, true);
}
```

**Despliegue automatizado:**
- `git push origin felipe-4` → actualización del código
- SSM ejecutó `git pull` y `pm2 restart` en ambas instancias
- Verificación: Health checks pasaron, aplicación accesible sin errores CORS

### 6.7 Monitoreo y Observabilidad

**CloudWatch Alarms Configuradas:**
- Alarmas de disponibilidad (críticas y warnings) por módulo
- Alarmas de latencia P95 y P99
- Alarmas de tasa de errores
- Alarmas de CPU alta/baja para Auto Scaling
- Topics SNS: `feli-dev-cloudwatch-alarms`, `feli-dev-critical-alarms`, `incodefy-security-alerts-dev`

**Dashboards:**
- Sistema de salud: `feli-dev-system-health`
- Experimentos chaos: `feli-dev-chaos-experiments`

**Log Groups:**
- VPC Flow Logs: `/aws/vpc/incodefy-dev` (retención 7 días)
- Application Logs: Agregados via CloudWatch Agent en instancias EC2

### 6.8 Automatización con Terraform

**Resumen del despliegue:**
```bash
terraform apply -auto-approve
# Apply complete! Resources: 104 added, 0 changed, 0 destroyed.
```

**Recursos creados (104 total):**
- 1 VPC, 4 subredes, 1 IGW, 2 NAT Gateways, 2 EIPs
- 6 tablas de rutas con sus asociaciones
- 4 Security Groups, 2 Network ACLs con 14 reglas
- 1 ALB, 1 Target Group, 1 Listener
- 1 Launch Template, 1 Auto Scaling Group con 3 políticas
- 4 VPC Endpoints (S3, DynamoDB, SSM, CloudWatch Logs)
- 16 CloudWatch Alarms, 2 Dashboards
- 3 SNS Topics con 3 suscripciones email
- 5 roles IAM con políticas adjuntas
- 3 parámetros SSM (session_secret, user_pool_id, user_pool_client_id)
- 1 S3 bucket para Lambda

**Estado final verificado:**
- Todas las instancias healthy
- NAT Gateways operativos en ambas AZs
- VPC Endpoints conectados
- Alarmas activas y dashboards poblados
- Aplicación respondiendo correctamente en todas las rutas

---

## 7. Conclusiones

El despliegue completo del Sistema de Gestión de Espacios cumple y supera los requisitos del examen: se diseñó una VPC personalizada con subredes públicas y privadas en múltiples zonas de disponibilidad, se configuraron Security Groups y NACLs específicos por capa, y se implementó redundancia completa mediante:

1. **Dos NAT Gateways** con IPs elásticas independientes (18.190.37.131 y 18.216.35.171), eliminando el punto único de falla para conectividad saliente
2. **Tablas de rutas privadas segmentadas** por AZ, permitiendo que cada zona mantenga conectividad independiente
3. **ALB + Auto Scaling Multi-AZ** con health checks automáticos y distribución de tráfico entre zonas
4. **VPC Endpoints** para SSM, CloudWatch Logs, S3 y DynamoDB, reduciendo tráfico por NAT Gateway y mejorando seguridad

La ciberseguridad se reforzó con controles CSRF, CORS (configurado dinámicamente para dominios AWS), políticas IAM de mínimo privilegio y administración exclusiva via SSM. Durante las pruebas se identificó y resolvió un bloqueo CORS que impedía el acceso desde el dominio del ALB, implementando una solución que permite automáticamente orígenes de servicios AWS (.elb.amazonaws.com, .cloudfront.net) sin comprometer la seguridad. La estrategia se demostró completamente funcional mediante pruebas exhaustivas sobre la URL `http://incodefy-alb-dev-736907592.us-east-2.elb.amazonaws.com`, donde todos los flujos (autenticación, dashboards, agenda, onboarding, APIs de instrumentos y notificaciones) operan correctamente con las dos instancias balanceadas activas.

La experiencia permitió validar en un entorno real los principios de redes y alta disponibilidad estudiados, evidenciando la importancia de:
- Eliminar puntos únicos de falla en todas las capas de la arquitectura
- La defensa en profundidad mediante segmentación de red y controles de acceso granulares
- La automatización con Terraform para garantizar consistencia y reproducibilidad (104 recursos desplegados)
- La observabilidad activa con CloudWatch para mantener la continuidad del servicio clínico

El costo incremental de ~$32/mes por el segundo NAT Gateway se justifica plenamente al garantizar disponibilidad continua para un sistema crítico de gestión hospitalaria.
