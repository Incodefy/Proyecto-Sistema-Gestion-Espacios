# ☁️ Terraform Infrastructure — Hospital Padre Hurtado

Este módulo define la infraestructura **serverless y de resiliencia** para el proyecto **Hospital Padre Hurtado**, incluyendo el *Chaos Engine* para experimentos de Ingeniería del Caos en AWS Academy.

---

## 📁 Estructura

```
terraform/
├── main.tf              # Configuración principal de AWS (provider + recursos)
├── variables.tf         # Variables de entorno y configuración
├── outputs.tf           # Valores exportados tras el deployment
├── dynamodb.tf          # Tablas DynamoDB utilizadas por el sistema
├── chaos_engine.tf      # Lambda Chaos Engine + API Gateway
└── README.md            # Este archivo
```

El artefacto de la función Lambda (`engine.zip`) se encuentra en:
```
aws/src/handlers/chaos/engine.zip
```

---

## 🚀 Despliegue en AWS

### 1️⃣ Requisitos previos
Asegúrate de tener:
- **AWS CLI** configurado con credenciales activas del *AWS Academy Learner Lab*  
- **Terraform ≥ 1.5.x**  
- **Node.js ≥ 18**  
- La variable de sesión cargada (`AWS_SESSION_TOKEN`)

Verifica con:
```bash
aws sts get-caller-identity
```

---

### 2️⃣ Inicializar Terraform
Ejecuta desde la carpeta `/terraform`:

```bash
terraform init
```

Esto descargará los proveedores necesarios de AWS.

---

### 3️⃣ Verificar plan de ejecución
Para revisar los recursos que se crearán:
```bash
terraform plan
```

---

### 4️⃣ Aplicar infraestructura
Ejecuta el despliegue en tu entorno:

```bash
terraform apply -auto-approve
```

Esto creará los siguientes recursos en **us-east-1**:
- Lambda: `chaos-engine`
- DynamoDB: tablas de configuración (si no existen)
- API Gateway: endpoint público del Chaos Engine
- CloudWatch alarms y logs básicos

---

### 5️⃣ Prueba de funcionamiento

Una vez desplegado, Terraform mostrará el endpoint de la API Gateway, por ejemplo:
```
Outputs:

chaos_engine_url = "https://abc123.execute-api.us-east-1.amazonaws.com/dev/chaos?type=random"
```

Puedes probarlo con:

```bash
curl "https://abc123.execute-api.us-east-1.amazonaws.com/dev/chaos?type=random"
```

O en local:
```bash
curl "http://localhost:3000/chaos-test"
```

---

## 🧠 Experimentos disponibles

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

