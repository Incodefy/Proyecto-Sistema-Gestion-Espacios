# Informe Técnico – Despliegue en AWS

**Proyecto:** Sistema de Gestión de Espacios – Hospital Padre Hurtado  
**Alcance evaluado:** Plataforma completa (autenticación, onboarding, dashboards, gestión de agenda y notificaciones)  
**Fecha:** 1 de diciembre de 2025  
**Elaborado por:** Equipo de Arquitectura Incodefy

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
El estado saludable de ambas instancias (`i-00f5aa534def91c18` e `i-088f0014a972b79df`) quedó documentado mediante el comando `aws elbv2 describe-target-health`, confirmando que ambas instancias están en estado `healthy` tras pasar los health checks del ALB. La aplicación responde correctamente en la URL `http://incodefy-alb-dev-736907592.us-east-2.elb.amazonaws.com/health` con status 200 OK, validando el correcto funcionamiento del balanceador y las instancias.

La configuración de los dos NAT Gateways se verificó mediante:
- `aws ec2 describe-nat-gateways`: Confirmando `nat-04fb545d7a5a7a700` (AZ1) y `nat-06cbfb9957b5982d8` (AZ2) en estado `available`
- `terraform output nat_gateway_ips`: Mostrando las IPs públicas `18.190.37.131` y `18.216.35.171`
- Las tablas de rutas privadas muestran rutas independientes hacia cada NAT Gateway

Los comandos de SSM aplicados sobre ambas instancias evidencian la administración centralizada sin necesidad de habilitar SSH en Internet. El despliegue automatizado mediante `terraform apply` creó 104 recursos, incluyendo la infraestructura de red redundante, los grupos de seguridad, VPC endpoints, y toda la configuración de monitoreo con CloudWatch.

---

## 7. Conclusiones

El despliegue completo del Sistema de Gestión de Espacios cumple y supera los requisitos del examen: se diseñó una VPC personalizada con subredes públicas y privadas en múltiples zonas de disponibilidad, se configuraron Security Groups y NACLs específicos por capa, y se implementó redundancia completa mediante:

1. **Dos NAT Gateways** con IPs elásticas independientes (18.190.37.131 y 18.216.35.171), eliminando el punto único de falla para conectividad saliente
2. **Tablas de rutas privadas segmentadas** por AZ, permitiendo que cada zona mantenga conectividad independiente
3. **ALB + Auto Scaling Multi-AZ** con health checks automáticos y distribución de tráfico entre zonas
4. **VPC Endpoints** para SSM, CloudWatch Logs, S3 y DynamoDB, reduciendo tráfico por NAT Gateway y mejorando seguridad

La ciberseguridad se reforzó con controles CSRF, CORS, políticas IAM de mínimo privilegio y administración exclusiva via SSM. La estrategia se demostró funcional mediante pruebas sobre la URL `http://incodefy-alb-dev-736907592.us-east-2.elb.amazonaws.com`, donde los flujos de autenticación, dashboards, agenda, onboarding, APIs de instrumentos y notificaciones operaron correctamente desde el primer momento.

La experiencia permitió validar en un entorno real los principios de redes y alta disponibilidad estudiados, evidenciando la importancia de:
- Eliminar puntos únicos de falla en todas las capas de la arquitectura
- La defensa en profundidad mediante segmentación de red y controles de acceso granulares
- La automatización con Terraform para garantizar consistencia y reproducibilidad (104 recursos desplegados)
- La observabilidad activa con CloudWatch para mantener la continuidad del servicio clínico

El costo incremental de ~$32/mes por el segundo NAT Gateway se justifica plenamente al garantizar disponibilidad continua para un sistema crítico de gestión hospitalaria.
