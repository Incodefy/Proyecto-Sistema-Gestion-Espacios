# ☁️ Infraestructura Terraform - Incodefy

Infraestructura como código (IaC) para el despliegue del sistema **Incodefy** en AWS, utilizando una arquitectura de alta disponibilidad con Auto Scaling, Application Load Balancer, y servicios de seguridad y monitoreo.

---

## 📁 Estructura del Proyecto

```
terraform/
├── main.tf                 # Configuración principal y provider AWS
├── variables.tf            # Variables de configuración
├── outputs.tf              # Outputs exportados
├── vpc.tf                  # VPC, subredes, NAT gateways
├── security_groups.tf      # Security Groups (ALB, EC2, Lambda)
├── network_acls.tf         # Network ACLs para control de tráfico
├── alb.tf                  # Application Load Balancer
├── auto_scaling.tf         # Auto Scaling Group y Launch Template
├── cloudwatch.tf           # Dashboards, métricas y alarmas
├── waf.tf                  # Web Application Firewall (opcional)
├── guardduty.tf            # Detección de amenazas (opcional)
├── security.tf             # Configuraciones de seguridad adicionales
├── user-data.sh.tpl        # Script de inicialización de EC2
├── terraform.tfvars.example # Ejemplo de configuración
└── README.md               # Este archivo
```

---

## 🏗️ Arquitectura

### Componentes Principales

#### 🌐 **Networking (VPC)**
- **VPC**: `10.0.0.0/16` con DNS habilitado
- **Subredes Públicas**: 2 AZs (us-east-1a, us-east-1b) - `10.0.1.0/24`, `10.0.2.0/24`
- **Subredes Privadas**: 2 AZs - `10.0.10.0/24`, `10.0.11.0/24`
- **NAT Gateways**: 2 (alta disponibilidad, uno por AZ)
- **Internet Gateway**: Para acceso público

#### ⚖️ **Load Balancing**
- **Application Load Balancer (ALB)**: 
  - HTTP (puerto 80)
  - Health checks en `/health`
  - Sticky sessions habilitadas
  - Cross-zone load balancing

#### 🖥️ **Compute (Auto Scaling)**
- **Auto Scaling Group**: 
  - Mínimo: 2 instancias
  - Máximo: 6 instancias
  - Deseado: 2 instancias
- **Launch Template**: 
  - AMI: Ubuntu 22.04 LTS
  - Tipo: t3.micro
  - Node.js 18 + PM2
  - Script de inicialización automático

#### 🔐 **Seguridad**
- **Security Groups**: 3 grupos (ALB, EC2, Lambda)
- **Network ACLs**: Control de tráfico granular
- **WAF** (opcional): Rate limiting, SQL injection, XSS
- **GuardDuty** (opcional): Detección de amenazas
- **IAM Roles**: Permisos mínimos necesarios

#### 📊 **Monitoreo**
- **CloudWatch Dashboards**: System Health y Chaos Experiments
- **Alarmas**: CPU, memoria, latencia, errores
- **Logs**: Centralizados en CloudWatch Logs
- **Métricas personalizadas**: SLO/SLI tracking

---

## 🚀 Despliegue

### 1️⃣ **Requisitos Previos**

- **AWS CLI** configurado con credenciales válidas
- **Terraform ≥ 1.6.0**
- **Cuenta AWS** con permisos de administrador
- **Git** para clonar el repositorio

Verificar credenciales:
```bash
aws sts get-caller-identity
```

### 2️⃣ **Configuración**

1. Copiar el archivo de ejemplo:
```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars
```

2. Editar `terraform.tfvars` con tus valores:
```hcl
region                = "us-east-1"
stage                 = "dev"
project_name          = "Incodefy"

# Red
vpc_cidr              = "10.0.0.0/16"
availability_zones    = ["us-east-1a", "us-east-1b"]

# Auto Scaling
asg_min_size          = 2
asg_max_size          = 6
asg_desired_capacity  = 2
ec2_instance_type     = "t3.micro"

# Aplicación
git_branch            = "felipe-5"
session_secret        = "your-secret-here"
user_pool_id          = "us-east-1_XXXXXXXX"
user_pool_client_id   = "XXXXXXXXXXXXXXXXXX"
api_base_url          = "https://XXXXXXXX.execute-api.us-east-1.amazonaws.com/dev"

# Seguridad (opcional)
enable_waf            = false
enable_guardduty      = false
admin_ssh_cidrs       = ["YOUR_IP/32"]

# Notificaciones
alarm_email           = "your-email@example.com"
```

### 3️⃣ **Inicializar Terraform**

```bash
terraform init
```

### 4️⃣ **Planificar Cambios**

```bash
terraform plan
```

Revisa los recursos que se crearán (aproximadamente 50+ recursos).

### 5️⃣ **Aplicar Infraestructura**

```bash
terraform apply
```

Confirma con `yes` cuando se solicite.

⏱️ **Tiempo estimado**: 5-10 minutos

### 6️⃣ **Verificar Despliegue**

Terraform mostrará outputs importantes:
```
Outputs:

alb_dns_name = "Incodefy-alb-dev-XXXXXXXXX.us-east-1.elb.amazonaws.com"
vpc_id = "vpc-XXXXXXXXXXXXXXXXX"
autoscaling_group_name = "Incodefy-asg-dev"
nat_gateway_ips = {
  az1 = "XX.XX.XX.XX"
  az2 = "YY.YY.YY.YY"
}
```

Acceder a la aplicación:
```bash
curl http://[ALB_DNS_NAME]
```

---

## 📊 Recursos Creados

### Networking
- 1 VPC
- 4 Subredes (2 públicas, 2 privadas)
- 1 Internet Gateway
- 2 NAT Gateways
- 2 Elastic IPs
- 4 Route Tables
- 2 Network ACLs

### Compute
- 1 Launch Template
- 1 Auto Scaling Group
- 2-6 Instancias EC2 (dinámico)
- 1 IAM Role + Instance Profile

### Load Balancing
- 1 Application Load Balancer
- 1 Target Group
- 2 Listeners (HTTP, HTTPS opcional)

### Seguridad
- 3 Security Groups
- WAF Web ACL (opcional)
- GuardDuty Detector (opcional)

### Monitoreo
- 2 CloudWatch Dashboards
- 10+ CloudWatch Alarms
- 3+ Log Groups
- SNS Topics para notificaciones

---

## 🔧 Variables Importantes

| Variable | Descripción | Default | Requerido |
|----------|-------------|---------|-----------|
| `region` | Región AWS | `us-east-1` | No |
| `project_name` | Nombre del proyecto | `Incodefy` | No |
| `vpc_cidr` | CIDR de la VPC | `10.0.0.0/16` | No |
| `asg_min_size` | Mínimo de instancias | `2` | No |
| `asg_max_size` | Máximo de instancias | `6` | No |
| `session_secret` | Secret para sesiones | - | **Sí** |
| `user_pool_id` | Cognito User Pool ID | - | **Sí** |
| `api_base_url` | URL base de API | - | **Sí** |
| `enable_waf` | Habilitar WAF | `false` | No |
| `enable_guardduty` | Habilitar GuardDuty | `false` | No |

---

## 📈 Monitoreo y Alarmas

### Dashboards CloudWatch

1. **System Health Dashboard**
   - Availability gauges (Login, Agenda, Catalog)
   - Latency P95/P99 por servicio
   - Error rates
   - Throughput

2. **Chaos Experiments Dashboard**
   - Experimentos activos
   - Impacto en disponibilidad
   - Métricas de resiliencia

### Alarmas Configuradas

- **CPU Utilization** > 80% (Warning), > 90% (Critical)
- **Memory Utilization** > 80%
- **Target Response Time** > 2s
- **Unhealthy Host Count** ≥ 1
- **HTTP 5xx Errors** > 10/min
- **DynamoDB Throttles** > 5/min

---

## 🛡️ Seguridad

### Mejores Prácticas Implementadas

✅ **Network Segmentation**: Subredes públicas y privadas  
✅ **Defense in Depth**: Security Groups + NACLs  
✅ **Least Privilege**: IAM roles con permisos mínimos  
✅ **Encryption**: EBS volumes encriptados  
✅ **Monitoring**: GuardDuty para detección de amenazas  
✅ **WAF**: Protección contra OWASP Top 10  
✅ **Session Security**: Sticky sessions, cookies seguras  

### Seguridad Adicional Recomendada

- [ ] Habilitar **AWS Config** para auditoría
- [ ] Configurar **AWS Shield** para protección DDoS
- [ ] Implementar **AWS Secrets Manager** para credenciales
- [ ] Configurar **VPC Flow Logs**
- [ ] Habilitar **S3 Access Logs** para ALB
- [ ] Implementar **MFA** para acceso SSH

---

## 🧪 Testing

### Health Checks

```bash
# Health endpoint
curl http://[ALB_DNS]/health

# Expected: {"status":"healthy","timestamp":"...","uptime":...}
```

### Verificar Auto Scaling

```bash
# Listar instancias
aws autoscaling describe-auto-scaling-groups \
  --auto-scaling-group-names Incodefy-asg-dev \
  --query 'AutoScalingGroups[0].Instances[*].[InstanceId,HealthStatus,AvailabilityZone]' \
  --output table

# Target Group health
aws elbv2 describe-target-health \
  --target-group-arn [ARN_FROM_OUTPUT] \
  --query 'TargetHealthDescriptions[*].[Target.Id,TargetHealth.State]' \
  --output table
```

---

## 🔄 Actualización y Mantenimiento

### Actualizar Código en Instancias

```bash
# Via SSM
aws ssm send-command \
  --document-name "AWS-RunShellScript" \
  --instance-ids $(terraform output -json autoscaling_group_name | jq -r) \
  --parameters 'commands=["cd /home/appuser/incodefy-app","sudo -u appuser git pull","sudo pkill -f node"]'
```

### Escalar Manualmente

```bash
# Modificar variables en terraform.tfvars
asg_desired_capacity = 4

# Aplicar cambios
terraform apply -target=aws_autoscaling_group.app
```

### Rolling Updates

```bash
# Forzar reemplazo de instancias
terraform taint aws_launch_template.app
terraform apply
```

---

## 🗑️ Destrucción

⚠️ **ADVERTENCIA**: Esto eliminará TODA la infraestructura.

```bash
terraform destroy
```

Confirma con `yes` cuando se solicite.

---

## 📝 Outputs Principales

| Output | Descripción |
|--------|-------------|
| `alb_dns_name` | DNS del Load Balancer (punto de acceso) |
| `vpc_id` | ID de la VPC creada |
| `autoscaling_group_name` | Nombre del ASG |
| `target_group_arn` | ARN del Target Group |
| `nat_gateway_ips` | IPs públicas de NAT Gateways |

---

## 🐛 Troubleshooting

### Problema: Instancias Unhealthy

```bash
# Ver logs de User Data
aws ssm start-session --target [INSTANCE_ID]
sudo tail -f /var/log/user-data.log

# Verificar aplicación
sudo -u appuser pm2 logs
```

### Problema: No se puede acceder al ALB

```bash
# Verificar Security Groups
aws ec2 describe-security-groups \
  --group-ids [ALB_SG_ID] \
  --query 'SecurityGroups[0].IpPermissions'

# Verificar Target Health
aws elbv2 describe-target-health --target-group-arn [ARN]
```

### Problema: Terraform State Locked

```bash
# Forzar desbloqueo (usar con precaución)
terraform force-unlock [LOCK_ID]
```

---

## 📚 Referencias

- [Terraform AWS Provider](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)
- [AWS Auto Scaling Best Practices](https://docs.aws.amazon.com/autoscaling/ec2/userguide/as-best-practices.html)
- [AWS Well-Architected Framework](https://aws.amazon.com/architecture/well-architected/)

---

## 👥 Autores

**Proyecto Incodefy** - Sistema de Gestión de Espacios  
Universidad: Duoc UC  
Curso: Redes de Computadores

---

## 📄 Licencia

Este proyecto es de uso académico.

---

## 🧠 Experimentos de Chaos Engineering

| Tipo               | Endpoint                           | Descripción |
|--------------------|------------------------------------|--------------|
| `failure`          | `/chaos?type=failure`              | Simula errores internos (500) |
| `dynamodb`         | `/chaos?type=dynamodb`             | Simula pérdida de conexión a DynamoDB |
| `latency`          | `/chaos-latency`                   | Simula retardos aleatorios (0–5s) |
| `monitoring`       | `/health` + script Bash            | Evalúa disponibilidad durante un periodo |

---

## 🔬 Scripts de monitoreo

Para ejecutar el **Experimento 3 (monitoreo continuo)**:

```bash
cd ../scripts
chmod +x health_monitor.sh
./health_monitor.sh http://localhost:3000/health 20 2
```

Esto genera un log con cada resultado del endpoint `/health`.

---

## 🧹 Limpieza

Para eliminar los recursos creados:

```bash
terraform destroy -auto-approve
```

---

