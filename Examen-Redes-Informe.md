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
| **VPC** | `10.1.0.0/16`, DNS habilitado, etiquetada como `hpph-vpc-dev`. |
| **Subredes públicas** | `10.1.1.0/24 (us-east-2a)` y `10.1.2.0/24 (us-east-2b)`, destinadas a ALB y NAT. |
| **Subredes privadas** | `10.1.10.0/24 (us-east-2a)` y `10.1.11.0/24 (us-east-2b)` para Auto Scaling de EC2. |
| **Internet Gateway** | Permite salida directa a Internet para recursos públicos. |
| **NAT Gateways** | Dos NAT Gateways redundantes: uno en `10.1.1.0/24` (AZ1) y otro en `10.1.2.0/24` (AZ2) para alta disponibilidad del tráfico saliente. |
| **Application Load Balancer** | `incodefy-alb-dev`, balancea peticiones HTTP al puerto 3000. |
| **Auto Scaling Group** | Provee dos instancias t3.micro distribuidas en AZs distintas con health checks `/health`. |
| **Servicios administrados** | SSM Parameter Store (variables sensibles), CloudWatch Logs, WAF opcional. |

El diagrama lógico ubica el ALB en las subredes públicas, recibiendo tráfico de Internet para todas las rutas de la plataforma (`/`, `/dashboard`, `/agenda`, `/onboarding-espacios`, `/api/*`). El ALB enruta hacia el Target Group compuesto por instancias EC2 privadas que ejecutan la aplicación Node.js/Express, la cual sirve los dashboards, APIs de integración, motor de notificaciones y vistas de onboarding desde un único runtime. El tráfico saliente de estas instancias pasa por el NAT Gateway, mientras que el acceso administrativo se realiza únicamente via AWS Systems Manager (SSM), eliminando la exposición SSH pública.

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
│                      VPC 10.1.0.0/16  –  hpph-vpc-dev                       │
│                                                                             │
│  ┌────────────────────────┐         ┌────────────────────────┐              │
│  │ Subred pública AZ1     │         │ Subred pública AZ2     │              │
│  │ 10.1.1.0/24            │         │ 10.1.2.0/24            │              │
│  │ • ALB ENI              │         │ • ALB ENI              │              │
│  │ • NAT Gateway AZ1      │         │ • NAT Gateway AZ2      │              │
│  └──────────┬─────────────┘         └──────────┬─────────────┘              │
│             │                                  │                           │
│             ▼                                  ▼                           │
│  ┌────────────────────────┐         ┌────────────────────────┐              │
│  │ Subred privada AZ1     │         │ Subred privada AZ2     │              │
│  │ 10.1.10.0/24           │         │ 10.1.11.0/24           │              │
│  │ • EC2 App (ASG)        │         │ • EC2 App (ASG)        │              │
│  │ • CloudWatch / SSM     │         │ • CloudWatch / SSM     │              │
│  │ • RT → NAT AZ1         │         │ • RT → NAT AZ2         │              │
│  └────────────────────────┘         └────────────────────────┘              │
│             │                                  │                           │
│             └────────────┬──────────┬──────────┘                           │
│                          │          │                                       │
│                  ┌───────▼──────┐ ┌─▼────────┐                              │
│                  │ VPC Endpoints │ │ Internet  │                             │
│                  │ SSM / Logs    │ │ Gateway   │                             │
│                  └───────┬──────┘ └─┬────────┘                              │
└──────────────────────────┼──────────┼───────────────────────────────────────┘
							│          │
							▼          ▼
				┌────────────────┐  ┌──────────────────────┐
				│ AWS Cognito,    │ │ Parameter Store /    │
				│ DynamoDB, S3   │  │ Secrets Manager      │
				└────────────────┘  └──────────────────────┘
```

----

## 3. Configuraciones de red

### 3.1 Subredes y ruteo
Las tablas de rutas públicas envían `0.0.0.0/0` al Internet Gateway, permitiendo que el ALB y los NAT Gateways atiendan tráfico externo sin restricciones. Las tablas de rutas privadas están segregadas por zona de disponibilidad: la subred privada en AZ1 (10.1.10.0/24) redirige su tráfico saliente hacia el NAT Gateway desplegado en la subred pública de la misma AZ1, mientras que la subred privada en AZ2 (10.1.11.0/24) utiliza el NAT Gateway ubicado en la subred pública AZ2. Esta configuración elimina el punto único de falla para el tráfico saliente a Internet y garantiza que la caída de una zona de disponibilidad no afecte la conectividad de la otra.

### 3.2 Security Groups
El security group del ALB permite tráfico HTTP y HTTPS desde cualquier origen (`0.0.0.0/0`) y mantiene la salida abierta para responder a los clientes. El security group de las instancias EC2 restringe el ingreso únicamente al puerto 3000 proveniente del ALB y permite conexiones SSH exclusivas desde los rangos administrativos definidos en `var.admin_ssh_cidrs`, manteniendo salida abierta para invocar Cognito, DynamoDB y otros servicios. Finalmente, los security groups asignados a Lambda y a los endpoints privados autorizan únicamente el tráfico saliente necesario para consumir servicios internos y peticiones HTTPS.

### 3.3 Network ACLs
Las NACL públicas incluyen reglas explícitas que habilitan HTTP (80), HTTPS (443), SSH (22) y puertos efímeros tanto de entrada como de salida para las dos subredes expuestas, asegurando el intercambio controlado con Internet. Las NACL privadas permiten únicamente los puertos 3000 y 443 provenientes de las subredes públicas y bloquean cualquier tráfico no solicitado, reforzando el aislamiento horizontal entre cargas internas.

---

## 4. Redundancia y disponibilidad
La redundancia se logra mediante subredes públicas y privadas duplicadas en `us-east-2a` y `us-east-2b`, combinadas con un Auto Scaling Group que mantiene siempre dos instancias activas y se apoya en los health checks del ALB para garantizar que el tráfico solo rote a nodos sanos. Además, se aprovisionaron dos NAT Gateways independientes —uno por zona de disponibilidad— con tablas de rutas segregadas que garantizan que la caída de un NAT no afecte la conectividad saliente de la otra zona. Esta configuración protege no solo el flujo de onboarding, sino también el dashboard principal, los endpoints de agenda y la API de notificaciones. Se configuró un período de gracia de 600 segundos para permitir que `npm install` concluya antes de evaluar el estado de salud, y se habilitó un drenado de sesiones de treinta segundos (`deregistration_delay = 30`) que permite finalizar solicitudes en curso antes de reemplazar instancias.

---

## 5. Medidas de ciberseguridad
El acceso mínimo se garantiza con un rol de Auto Scaling que limita los permisos al uso de Parameter Store y CloudWatch, prescindiendo de llaves SSH públicas y canalizando la operación diaria mediante SSM. La protección CSRF se implementa con un middleware dedicado que inyecta tokens en las vistas críticas (onboarding, formularios de agenda y gestión de notificaciones) y obliga a que cada petición AJAX los envíe en la cabecera `X-CSRF-Token`. Las políticas CSP y CORS endurecidas en `server.js` restringen los orígenes permitidos y bloquean recursos inseguros para toda la aplicación web. Las credenciales sensibles, tales como `SESSION_SECRET` y `AWS_SECRET_ACCESS_KEY`, se abastecen desde SSM para evitar almacenamiento en texto plano dentro del repositorio. Adicionalmente, la plantilla Terraform contempla módulos para habilitar GuardDuty y WAF cuando la organización requiera monitoreo de amenazas y filtrado avanzado.

---

## 6. Evidencias
El estado saludable de ambas instancias (`i-0cfe405e606970490` e `i-0ac44d7824dbbf0ef`) quedó documentado mediante el comando `aws elbv2 describe-target-health`. Los registros de arranque almacenados en `/home/appuser/app.log` confirman el mensaje `Server running on port 3000` junto con las URLs configuradas para permisos y personalización. El historial de Git refleja en el commit `7c930cf` la incorporación del encabezado `X-CSRF-Token`, cumplimiento clave para los controles de seguridad. Finalmente, los comandos de SSM aplicados sobre ambas instancias evidencian la administración centralizada sin necesidad de habilitar SSH en Internet. Las capturas y salidas completas se incluyen en la carpeta `evidencias/` entregada al docente como parte del paquete comprimido.

---

## 7. Conclusiones

El despliegue completo del Sistema de Gestión de Espacios cumple los requisitos del examen: se diseñó una VPC personalizada con subredes públicas y privadas, se configuraron Security Groups y NACLs específicos, se estableció redundancia mediante ALB + Auto Scaling Multi-AZ y se reforzó la ciberseguridad con controles CSRF, CORS, IAM mínimo y administración via SSM. La estrategia se demostró funcional mediante pruebas sobre la URL `http://incodefy-alb-dev-1108693392.us-east-2.elb.amazonaws.com`, donde los flujos de autenticación, dashboards, agenda, onboarding, APIs de instrumentos y notificaciones operaron sin interrupciones tras aplicar los fixes descritos.

La experiencia permitió validar en un entorno real los principios de redes estudiados, evidenciando la importancia de la defensa en profundidad, la automatización con Terraform y la observabilidad activa para mantener la continuidad del servicio clínico en todos los módulos de la plataforma.
