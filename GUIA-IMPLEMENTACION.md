# 🚀 Guía de Implementación - Infraestructura de Red

## 📋 Descripción

Esta guía te llevará paso a paso para implementar la infraestructura de red completa que cumple con todos los requisitos del examen de Redes de Computadores.

---

## ✅ Pre-requisitos

Antes de comenzar, asegúrate de tener:

1. **AWS CLI** configurado con credenciales activas
2. **Terraform** >= 1.6.0 instalado
3. **Acceso a AWS Academy Learner Lab** o cuenta AWS
4. **Git** para control de versiones

### Verificar instalaciones

```powershell
# Verificar AWS CLI
aws --version
aws sts get-caller-identity

# Verificar Terraform
terraform --version

# Verificar Git
git --version
```

---

## 🎯 Fase 1: Preparación (15 minutos)

### Paso 1.1: Crear archivo de variables

Crea el archivo `terraform/terraform.tfvars` con tus valores:

```hcl
# terraform/terraform.tfvars

# Configuración General
region       = "us-east-1"
stage        = "dev"
project_name = "HospitalPadreHurtado"

# Red
vpc_cidr           = "10.0.0.0/16"
availability_zones = ["us-east-1a", "us-east-1b"]

# IMPORTANTE: En producción, restringir a IPs específicas
admin_ssh_cidrs = ["0.0.0.0/0"]

# EC2 & Auto Scaling
ec2_ami_id           = "ami-0c7217cdde317cfec" # Ubuntu 22.04 LTS
ec2_instance_type    = "t3.micro"
asg_min_size         = 2
asg_max_size         = 6
asg_desired_capacity = 2

# RDS (opcional - deshabilitar para fase inicial)
enable_rds        = false
db_name           = "incodefy"
db_username       = "admin"
db_password       = "CAMBIAR_ESTO_POR_PASSWORD_SEGURA"
db_instance_class = "db.t3.micro"
db_multi_az       = true

# Aplicación
session_secret       = "CAMBIAR_ESTO_POR_SECRET_SEGURO"
user_pool_id         = ""  # Completar con tu User Pool ID
user_pool_client_id  = ""  # Completar con tu Client ID
api_base_url         = ""  # Completar con tu API URL

# Seguridad Avanzada (opcional)
enable_waf       = false
enable_guardduty = false

# Alertas
alarm_email           = "tu-email@ejemplo.com"
critical_alarm_email  = "tu-email@ejemplo.com"
security_alert_email  = "tu-email@ejemplo.com"
```

### Paso 1.2: Generar secrets seguros

```powershell
# Generar SESSION_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generar DB_PASSWORD
node -e "console.log(require('crypto').randomBytes(16).toString('base64'))"
```

Copia estos valores al archivo `terraform.tfvars`.

---

## 🏗️ Fase 2: Implementación de Red (30 minutos)

### Paso 2.1: Inicializar Terraform

```powershell
cd terraform
terraform init
```

**Salida esperada:**
```
Initializing the backend...
Initializing provider plugins...
- Finding hashicorp/aws versions matching "~> 5.0"...
- Installing hashicorp/aws v5.x.x...

Terraform has been successfully initialized!
```

### Paso 2.2: Validar configuración

```powershell
terraform validate
```

**Salida esperada:**
```
Success! The configuration is valid.
```

### Paso 2.3: Revisar plan de ejecución

```powershell
terraform plan -out=tfplan
```

**Recursos que se crearán:**
- ✅ 1 VPC
- ✅ 4 Subredes (2 públicas, 2 privadas)
- ✅ 1 Internet Gateway
- ✅ 1 NAT Gateway
- ✅ 1 Elastic IP
- ✅ 2 Tablas de rutas
- ✅ 5 Security Groups
- ✅ 2 Network ACLs con ~15 reglas
- ✅ 1 Application Load Balancer
- ✅ 1 Target Group
- ✅ 1 Auto Scaling Group
- ✅ 1 Launch Template
- ✅ VPC Flow Logs
- ✅ CloudWatch Alarms

**Total:** ~40-50 recursos

### Paso 2.4: Aplicar la infraestructura

```powershell
terraform apply tfplan
```

**Tiempo estimado:** 5-10 minutos

⚠️ **IMPORTANTE:** Terraform te mostrará un resumen. Revísalo cuidadosamente antes de confirmar.

---

## 📊 Fase 3: Verificación (15 minutos)

### Paso 3.1: Obtener outputs

```powershell
terraform output
```

**Outputs importantes:**
```
alb_dns_name          = "HospitalPadreHurtado-alb-dev-123456789.us-east-1.elb.amazonaws.com"
application_url       = "http://HospitalPadreHurtado-alb-dev-123456789.us-east-1.elb.amazonaws.com"
vpc_id                = "vpc-0123456789abcdef0"
public_subnet_ids     = ["subnet-abc", "subnet-def"]
private_subnet_ids    = ["subnet-ghi", "subnet-jkl"]
rds_endpoint          = "RDS no habilitado"
autoscaling_group_name = "HospitalPadreHurtado-asg-dev"
```

### Paso 3.2: Verificar en AWS Console

#### VPC y Subredes
1. Ve a **VPC Dashboard** → **Your VPCs**
2. Busca `HospitalPadreHurtado-vpc-dev`
3. Verifica CIDR: `10.0.0.0/16`

#### Security Groups
1. Ve a **EC2** → **Security Groups**
2. Verifica que existen:
   - `HospitalPadreHurtado-alb-sg-dev` (puertos 80, 443)
   - `HospitalPadreHurtado-ec2-app-sg-dev` (puerto 3000 desde ALB)
   - `HospitalPadreHurtado-rds-sg-dev` (puerto 3306)
   - `HospitalPadreHurtado-lambda-sg-dev`

#### Network ACLs
1. Ve a **VPC** → **Network ACLs**
2. Verifica:
   - `HospitalPadreHurtado-public-nacl-dev`
   - `HospitalPadreHurtado-private-nacl-dev`

#### Load Balancer
1. Ve a **EC2** → **Load Balancers**
2. Busca `HospitalPadreHurtado-alb-dev`
3. Verifica estado: **Active**

#### Auto Scaling
1. Ve a **EC2** → **Auto Scaling Groups**
2. Busca `HospitalPadreHurtado-asg-dev`
3. Verifica:
   - Desired: 2
   - Min: 2
   - Max: 6
   - Instancias: 2 (en estado "InService")

### Paso 3.3: Tests de conectividad

```powershell
# Obtener URL del ALB
$ALB_URL = terraform output -raw alb_dns_name

# Test 1: Verificar que ALB responde
curl "http://$ALB_URL"

# Test 2: Health check (cuando esté configurado)
curl "http://$ALB_URL/health"

# Test 3: Verificar DNS
nslookup $ALB_URL
```

---

## 🔧 Fase 4: Seguridad Avanzada (Opcional - 15 minutos)

### WAF (Web Application Firewall)

```hcl
# terraform.tfvars
enable_waf = true
```

```powershell
terraform apply
```

**Protecciones incluidas:**
- ✅ Rate limiting (2000 req/5min por IP)
- ✅ SQL Injection prevention
- ✅ XSS protection
- ✅ Geo-blocking
- ✅ IP reputation lists
- ✅ Bot control

### GuardDuty (Threat Detection)

```hcl
# terraform.tfvars
enable_guardduty     = true
security_alert_email = "tu-email@ejemplo.com"
```

```powershell
terraform apply
```

**Alertas configuradas:**
- ✅ Detección de malware
- ✅ Actividad sospechosa
- ✅ Intentos de intrusión
- ✅ Comunicación con IPs maliciosas

---

## 📸 Fase 5: Capturas de Evidencia para el Examen (20 minutos)

### Captura 1: VPC Dashboard
- **Ubicación:** VPC → Your VPCs
- **Mostrar:** VPC ID, CIDR, subredes asociadas

### Captura 2: Subredes
- **Ubicación:** VPC → Subnets
- **Mostrar:** 4 subredes (2 públicas, 2 privadas) con AZs

### Captura 3: Security Groups
- **Ubicación:** EC2 → Security Groups
- **Mostrar:** Reglas inbound/outbound de cada SG

### Captura 4: Network ACLs
- **Ubicación:** VPC → Network ACLs
- **Mostrar:** Reglas numeradas de cada NACL

### Captura 5: Load Balancer
- **Ubicación:** EC2 → Load Balancers
- **Mostrar:** ALB activo, DNS name, listeners

### Captura 6: Auto Scaling Group
- **Ubicación:** EC2 → Auto Scaling Groups
- **Mostrar:** Instancias en ejecución, health status

### Captura 7: DynamoDB
- **Ubicación:** DynamoDB → Tables
- **Mostrar:** Lista de tablas del proyecto, capacidad configurada

### Captura 8: CloudWatch
- **Ubicación:** CloudWatch → Dashboards
- **Mostrar:** Métricas de CPU, red, requests

### Captura 9: VPC Flow Logs
- **Ubicación:** VPC → Flow Logs
- **Mostrar:** Logs activos

### Captura 10: Comandos Terraform
```powershell
# Capturar output completo
terraform output > terraform-outputs.txt

# Capturar estado
terraform show > terraform-state.txt

# Listar recursos
terraform state list > terraform-resources.txt
```

---

## 🧪 Fase 6: Tests de Redundancia (15 minutos)

### Test 1: Failover de instancias EC2

```powershell
# Obtener ID de una instancia
aws ec2 describe-instances --filters "Name=tag:Name,Values=HospitalPadreHurtado-asg-instance-dev" --query "Reservations[0].Instances[0].InstanceId" --output text

# Detener la instancia
aws ec2 stop-instances --instance-ids i-0123456789abcdef0

# Esperar 2-3 minutos y verificar que Auto Scaling lanza una nueva
aws autoscaling describe-auto-scaling-groups --auto-scaling-group-names HospitalPadreHurtado-asg-dev --query "AutoScalingGroups[0].Instances[*].[InstanceId,HealthStatus,LifecycleState]" --output table
```

**Resultado esperado:** Nueva instancia en estado "InService"

### Test 2: Verificar ALB sigue funcionando

```powershell
# Durante el failover, el ALB debe seguir respondiendo
while ($true) {
    curl "http://$ALB_URL/health"
    Start-Sleep -Seconds 5
}
```

---

## 📝 Fase 7: Generar Informe Técnico (30 minutos)

### Estructura del Informe

```markdown
# Informe Técnico - Despliegue en AWS

## 1. Introducción
- Descripción del módulo desplegado
- Objetivos del proyecto

## 2. Arquitectura de Red
- Diagrama de VPC (usar draw.io)
- Tabla CIDR de subredes
- Flujo de tráfico

## 3. Configuración de Red
### 3.1 VPC
- CIDR: 10.0.0.0/16
- DNS habilitado: Sí
- Subredes: 4 (2 públicas, 2 privadas)

### 3.2 Security Groups
[Incluir tabla con reglas]

### 3.3 Network ACLs
[Incluir tabla con reglas numeradas]

## 4. Redundancia
### 4.1 Application Load Balancer
- Multi-AZ deployment
- Health checks configurados

### 4.2 Auto Scaling
- Min: 2, Max: 6 instancias
- Políticas de escalado

### 4.3 RDS Multi-AZ
- Réplica sincrónica
- Failover automático

## 5. Seguridad
### 5.1 Control de Acceso
- IAM roles con permisos mínimos
- Cognito para autenticación
### 4.2 Auto Scaling
- Min: 2, Max: 6 instancias
- Políticas de escalado

### 4.3 DynamoDB
- Múltiples tablas (21 tablas)
- Multi-AZ automático
- Backups habilitados

## 5. Seguridadcional)

## 6. Evidencias
[Incluir capturas de pantalla numeradas]

## 7. Conclusiones
- Aprendizajes
- Desafíos enfrentados
- Mejoras futuras
```

---

## 🔄 Comandos Útiles

### Ver estado de recursos

```powershell
# Listar todos los recursos
terraform state list

# Ver detalles de un recurso específico
terraform state show aws_vpc.main

# Refrescar estado
terraform refresh
```

### Gestión de Auto Scaling

```powershell
# Ver actividad del ASG
aws autoscaling describe-scaling-activities --auto-scaling-group-name HospitalPadreHurtado-asg-dev --max-records 10

# Cambiar capacidad deseada
aws autoscaling set-desired-capacity --auto-scaling-group-name HospitalPadreHurtado-asg-dev --desired-capacity 4

# Suspender procesos de scaling
aws autoscaling suspend-processes --auto-scaling-group-name HospitalPadreHurtado-asg-dev
```

### Monitoreo

```powershell
# Ver logs de VPC Flow
aws logs tail /aws/vpc/HospitalPadreHurtado-dev --follow

# Ver logs de WAF (si habilitado)
aws logs tail /aws/waf/HospitalPadreHurtado-dev --follow

# Ver métricas del ALB
aws cloudwatch get-metric-statistics --namespace AWS/ApplicationELB --metric-name RequestCount --dimensions Name=LoadBalancer,Value=app/HospitalPadreHurtado-alb-dev/abc123 --start-time (Get-Date).AddHours(-1).ToUniversalTime() --end-time (Get-Date).ToUniversalTime() --period 300 --statistics Sum
```

---

## 🧹 Limpieza (Opcional)

⚠️ **CUIDADO:** Esto eliminará toda la infraestructura creada.

```powershell
# Revisar qué se eliminará
terraform plan -destroy

# Destruir infraestructura
terraform destroy

# Confirmar con 'yes'
```

---

## 📞 Troubleshooting

### Problema: "Error creating VPC"
**Solución:** Verificar límites de VPC en tu cuenta AWS.

```powershell
aws service-quotas get-service-quota --service-code vpc --quota-code L-F678F1CE
```

### Problema: "Insufficient capacity"
**Solución:** Cambiar tipo de instancia o zona de disponibilidad.

```hcl
ec2_instance_type = "t2.micro"  # En lugar de t3.micro
```

### Problema: RDS tarda mucho en crear
**Solución:** Es normal. La creación Multi-AZ puede tomar 10-15 minutos.

### Problema: Auto Scaling no lanza instancias
**Solución:** Verificar:
1. Cuotas de instancias EC2
2. AMI ID correcto para la región
3. Security Groups permiten tráfico del ALB

---

### Problema: Auto Scaling no lanza instancias
**Solución:** Verificar:
1. Cuotas de instancias EC2
2. AMI ID correcto para la región
3. Security Groups permiten tráfico del ALB

---

## ✅ Checklist Finalad Balancer activo
- [ ] Auto Scaling Group con 2+ instancias
- [ ] RDS Multi-AZ (opcional pero recomendado)
- [ ] VPC Flow Logs habilitados
- [ ] CloudWatch Alarms configuradas
- [ ] Capturas de pantalla tomadas
- [ ] Informe técnico completado
- [ ] Comandos documentados

---

## 📚 Recursos Adicionales

- [ ] 2 Network ACLs con reglas numeradas
- [ ] Application Load Balancer activo
- [ ] Auto Scaling Group con 2+ instancias
- [ ] DynamoDB tablas verificadas
- [ ] VPC Flow Logs habilitados
- [ ] CloudWatch Alarms configuradas

**¡Buena suerte con tu examen! 🚀**
