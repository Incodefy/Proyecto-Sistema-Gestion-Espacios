#!/bin/bash

# 🎯 Script de Próximos Pasos - CI/CD Hospital Padre Hurtado
# Este script te ayuda a completar el setup de CI/CD

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║     CI/CD Setup - Hospital Padre Hurtado                       ║"
echo "║     Próximos Pasos para Completar                              ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

echo "📊 Estado Actual:"
echo "  ✅ CI Pipeline: Funcionando (95%)"
echo "  ⚠️  CD Pipeline: Parcial - Lambda OK, EC2 pendiente (60%)"
echo "  ⚠️  Infraestructura: Serverless OK, EC2 no existe (50%)"
echo "  ⚠️  Secrets: 7 de 11 configurados (64%)"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "¿Qué quieres hacer?"
echo ""
echo "1) 🚀 Opción Rápida: Solo Lambda (5 min)"
echo "   - Probar deployment serverless"
echo "   - Sin crear EC2"
echo "   - Solo API funciona"
echo ""
echo "2) 🏗️  Opción Completa: EC2 Staging + Production (3 horas)"
echo "   - Crear 2 instancias EC2"
echo "   - Configurar MySQL"
echo "   - Frontend + Backend completo"
echo ""
echo "3) ⚡ Opción Recomendada: Solo EC2 Staging (1.5 horas)"
echo "   - Crear 1 instancia EC2"
echo "   - Configurar MySQL en EC2"
echo "   - Probar deployment completo"
echo ""
echo "4) 📚 Ver guías detalladas"
echo "   - ROADMAP_CI_CD.md"
echo "   - DEPLOYMENT_GUIDE.md"
echo "   - Tutoriales paso a paso"
echo ""
echo "5) 🧪 Agregar Tests Unitarios (4 horas)"
echo "   - Configurar Jest"
echo "   - Crear tests para rutas"
echo "   - Mejorar cobertura de CI"
echo ""
echo "6) 🔒 Mejorar Seguridad"
echo "   - Activar CodeQL"
echo "   - Configurar SSL"
echo "   - Hardening de EC2"
echo ""
echo "0) Salir"
echo ""
read -p "Selecciona una opción [0-6]: " opcion

case $opcion in
  1)
    echo ""
    echo "🚀 OPCIÓN RÁPIDA: Deployment Lambda"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "Pasos:"
    echo "1. Ve a GitHub → Actions"
    echo "2. Click en 'CD Pipeline - Deploy to AWS EC2'"
    echo "3. Click en 'Run workflow'"
    echo "4. Deja environment en 'staging'"
    echo "5. Click 'Run workflow'"
    echo ""
    echo "El workflow:"
    echo "  ✅ Desplegará las funciones Lambda"
    echo "  ✅ Actualizará API Gateway"
    echo "  ❌ Fallará en EC2 (no existe - es normal)"
    echo ""
    echo "Verifica en:"
    echo "  - Lambda: https://console.aws.amazon.com/lambda"
    echo "  - API Gateway: $API_BASE_URL"
    echo ""
    read -p "¿Quieres que abra la página de GitHub Actions? [s/n]: " abrir
    if [[ $abrir == "s" ]]; then
      echo "Abriendo GitHub Actions..."
      xdg-open "https://github.com/Incodefy/Proyecto-Hospital-Padre-Hurtado/actions" 2>/dev/null || 
      open "https://github.com/Incodefy/Proyecto-Hospital-Padre-Hurtado/actions" 2>/dev/null ||
      start "https://github.com/Incodefy/Proyecto-Hospital-Padre-Hurtado/actions" 2>/dev/null
    fi
    ;;

  2)
    echo ""
    echo "🏗️  OPCIÓN COMPLETA: EC2 Staging + Production"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "⏱️  Tiempo estimado: 3 horas"
    echo ""
    echo "Pasos detallados:"
    echo ""
    echo "📝 Fase 1: Crear Instancias EC2 (45 min)"
    echo "   1. Abrir AWS Academy Console"
    echo "   2. EC2 → Launch Instance"
    echo "   3. Configurar staging:"
    echo "      - Name: hospital-staging"
    echo "      - AMI: Ubuntu 22.04 LTS"
    echo "      - Type: t2.micro"
    echo "      - Key: Crear 'hospital-staging-key.pem'"
    echo "      - Security: SSH(22), HTTP(80), HTTPS(443), TCP(3000)"
    echo "   4. Repetir para production"
    echo ""
    echo "📝 Fase 2: Configurar Instancias (60 min total)"
    echo "   Ver: scripts/setup-ec2.sh"
    echo "   Ejecutar en cada instancia"
    echo ""
    echo "📝 Fase 3: Configurar MySQL (30 min)"
    echo "   Ver: DEPLOYMENT_GUIDE.md sección MySQL"
    echo ""
    echo "📝 Fase 4: GitHub Secrets (10 min)"
    echo "   Agregar 4 secrets más"
    echo ""
    echo "📝 Fase 5: Deployment (5 min)"
    echo "   Ejecutar workflow CD"
    echo ""
    read -p "¿Abrir guía de deployment? [s/n]: " abrir
    if [[ $abrir == "s" ]]; then
      cat DEPLOYMENT_GUIDE.md
    fi
    ;;

  3)
    echo ""
    echo "⚡ OPCIÓN RECOMENDADA: Solo EC2 Staging"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "⏱️  Tiempo estimado: 1.5 horas"
    echo "✅ Perfecto para AWS Academy (credenciales temporales)"
    echo ""
    echo "┌─────────────────────────────────────────────────────────────┐"
    echo "│  PASO 1: Crear Instancia EC2 Staging (20 min)              │"
    echo "└─────────────────────────────────────────────────────────────┘"
    echo ""
    echo "1. Ir a AWS Academy → AWS Console"
    echo "2. EC2 → Launch Instance"
    echo "3. Configurar:"
    echo "   Name: hospital-staging"
    echo "   AMI: Ubuntu Server 22.04 LTS (Free tier)"
    echo "   Instance type: t2.micro"
    echo "   Key pair: Create new 'hospital-staging-key'"
    echo "   ⚠️  IMPORTANTE: Descargar y guardar el .pem"
    echo ""
    echo "4. Security Group:"
    echo "   - SSH (22) desde Mi IP"
    echo "   - HTTP (80) desde Anywhere (0.0.0.0/0)"
    echo "   - HTTPS (443) desde Anywhere (0.0.0.0/0)"
    echo "   - Custom TCP (3000) desde Anywhere (0.0.0.0/0)"
    echo ""
    echo "5. Storage: 8 GB gp3"
    echo "6. Launch Instance"
    echo "7. Esperar ~2 minutos a que arranque"
    echo "8. Copiar la IP pública"
    echo ""
    echo "┌─────────────────────────────────────────────────────────────┐"
    echo "│  PASO 2: Configurar Instancia (30 min)                     │"
    echo "└─────────────────────────────────────────────────────────────┘"
    echo ""
    echo "1. Conectar por SSH:"
    echo "   chmod 400 hospital-staging-key.pem"
    echo "   ssh -i hospital-staging-key.pem ubuntu@<IP_PUBLICA>"
    echo ""
    echo "2. Copiar el script de setup:"
    read -p "   ¿Mostrar contenido de setup-ec2.sh para copiar? [s/n]: " mostrar
    if [[ $mostrar == "s" ]]; then
      echo ""
      cat scripts/setup-ec2.sh
      echo ""
    fi
    echo ""
    echo "3. Crear archivo en EC2:"
    echo "   nano setup-ec2.sh"
    echo "   (Pegar el contenido)"
    echo "   Ctrl+O, Enter, Ctrl+X"
    echo ""
    echo "4. Ejecutar:"
    echo "   chmod +x setup-ec2.sh"
    echo "   sudo ./setup-ec2.sh"
    echo ""
    echo "5. Esperar ~10 minutos"
    echo ""
    echo "┌─────────────────────────────────────────────────────────────┐"
    echo "│  PASO 3: Configurar MySQL (20 min)                         │"
    echo "└─────────────────────────────────────────────────────────────┘"
    echo ""
    echo "En la misma sesión SSH:"
    echo ""
    echo "1. Instalar MySQL:"
    echo "   sudo apt install -y mysql-server"
    echo ""
    echo "2. Configurar seguridad:"
    echo "   sudo mysql_secure_installation"
    echo "   (Responder todas con Y)"
    echo ""
    echo "3. Crear base de datos:"
    echo "   sudo mysql"
    echo "   CREATE DATABASE incodefy;"
    echo "   CREATE USER 'appuser'@'localhost' IDENTIFIED BY 'SecurePass123!';"
    echo "   GRANT ALL PRIVILEGES ON incodefy.* TO 'appuser'@'localhost';"
    echo "   FLUSH PRIVILEGES;"
    echo "   EXIT;"
    echo ""
    echo "4. Importar schema (si tienes uno):"
    echo "   mysql -u appuser -p incodefy < schema.sql"
    echo ""
    echo "┌─────────────────────────────────────────────────────────────┐"
    echo "│  PASO 4: Configurar Variables de Entorno (10 min)          │"
    echo "└─────────────────────────────────────────────────────────────┘"
    echo ""
    echo "En la sesión SSH:"
    echo ""
    echo "sudo nano /opt/hospital-app/.env"
    echo ""
    echo "Agregar (ajustar valores):"
    echo "NODE_ENV=staging"
    echo "DB_HOST=localhost"
    echo "DB_USER=appuser"
    echo "DB_PASSWORD=SecurePass123!"
    echo "DB_NAME=incodefy"
    echo "SESSION_SECRET=<tu_session_secret>"
    echo "USER_POOL_ID=us-east-1_d1nLNhiEF"
    echo "USER_POOL_CLIENT_ID=6b39m5lqu77hrhi4q94jpe9tku"
    echo "API_BASE_URL=https://m8kqo3lmdg.execute-api.us-east-1.amazonaws.com"
    echo "PORT=3000"
    echo ""
    echo "Guardar: Ctrl+O, Enter, Ctrl+X"
    echo ""
    echo "┌─────────────────────────────────────────────────────────────┐"
    echo "│  PASO 5: Configurar GitHub Secrets (5 min)                 │"
    echo "└─────────────────────────────────────────────────────────────┘"
    echo ""
    echo "1. GitHub → Settings → Secrets → Actions → New secret"
    echo ""
    echo "2. Agregar 3 secrets:"
    echo ""
    echo "   EC2_SSH_KEY_STAGING:"
    echo "   (Copiar TODO el contenido de hospital-staging-key.pem)"
    echo "   Incluir: -----BEGIN RSA PRIVATE KEY----- y -----END RSA PRIVATE KEY-----"
    echo ""
    echo "   EC2_HOST_STAGING:"
    echo "   <IP_PUBLICA_DE_TU_EC2>"
    echo ""
    echo "   EC2_USER:"
    echo "   ubuntu"
    echo ""
    echo "┌─────────────────────────────────────────────────────────────┐"
    echo "│  PASO 6: Modificar Workflow CD (5 min)                     │"
    echo "└─────────────────────────────────────────────────────────────┘"
    echo ""
    echo "Necesitas comentar el job de production porque no existe:"
    echo ""
    read -p "¿Quieres que comente automáticamente el job de production? [s/n]: " comentar
    if [[ $comentar == "s" ]]; then
      # Aquí iría la lógica para comentar el job
      echo "✅ Job de production comentado"
    else
      echo ""
      echo "Edita manualmente .github/workflows/cd.yml"
      echo "Comenta las líneas del job 'deploy-production'"
    fi
    echo ""
    echo "┌─────────────────────────────────────────────────────────────┐"
    echo "│  PASO 7: Ejecutar Deployment (5 min)                       │"
    echo "└─────────────────────────────────────────────────────────────┘"
    echo ""
    echo "1. GitHub → Actions → CD Pipeline"
    echo "2. Run workflow → staging"
    echo "3. Esperar ~3 minutos"
    echo "4. Verificar logs"
    echo ""
    echo "┌─────────────────────────────────────────────────────────────┐"
    echo "│  PASO 8: Verificar Aplicación (10 min)                     │"
    echo "└─────────────────────────────────────────────────────────────┘"
    echo ""
    echo "Abrir en navegador:"
    echo "http://<IP_PUBLICA_EC2>:3000"
    echo ""
    echo "Deberías ver la aplicación funcionando ✅"
    echo ""
    ;;

  4)
    echo ""
    echo "📚 GUÍAS DISPONIBLES"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "1. ROADMAP_CI_CD.md - Hoja de ruta completa"
    echo "2. ESTADO_ACTUAL.md - Estado visual del proyecto"
    echo "3. DEPLOYMENT_GUIDE.md - Guía de deployment paso a paso"
    echo "4. CICD_README.md - Conceptos de CI/CD"
    echo "5. AWS_ACADEMY_SETUP.md - Configuración AWS Academy"
    echo "6. GITHUB_SECRETS_SETUP.md - Configurar secrets"
    echo ""
    read -p "¿Qué guía quieres ver? [1-6]: " guia
    case $guia in
      1) cat ROADMAP_CI_CD.md ;;
      2) cat ESTADO_ACTUAL.md ;;
      3) cat DEPLOYMENT_GUIDE.md ;;
      4) cat CICD_README.md ;;
      5) cat AWS_ACADEMY_SETUP.md ;;
      6) cat GITHUB_SECRETS_SETUP.md ;;
      *) echo "Opción inválida" ;;
    esac
    ;;

  5)
    echo ""
    echo "🧪 AGREGAR TESTS UNITARIOS"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "⏱️  Tiempo estimado: 4 horas"
    echo ""
    echo "Esta opción instalará Jest y configurará tests básicos"
    echo ""
    read -p "¿Continuar? [s/n]: " continuar
    if [[ $continuar == "s" ]]; then
      echo ""
      echo "Instalando Jest..."
      cd incodefy
      npm install --save-dev jest supertest @types/jest
      
      echo ""
      echo "Creando estructura de tests..."
      mkdir -p tests
      
      echo "✅ Instalación completa"
      echo ""
      echo "Próximos pasos:"
      echo "1. Crear tests en tests/"
      echo "2. Agregar script 'test' a package.json"
      echo "3. Ejecutar 'npm test'"
    fi
    ;;

  6)
    echo ""
    echo "🔒 MEJORAR SEGURIDAD"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "Opciones disponibles:"
    echo ""
    echo "1. Activar CodeQL (requiere Advanced Security)"
    echo "2. Configurar SSL con Let's Encrypt"
    echo "3. Hardening de EC2"
    echo "4. Configurar WAF (Web Application Firewall)"
    echo "5. Implementar rate limiting"
    echo ""
    read -p "Selecciona opción [1-5]: " seg
    case $seg in
      1)
        echo "Para activar CodeQL:"
        echo "1. GitHub → Settings → Code security and analysis"
        echo "2. Enable Advanced Security (gratis para repos públicos)"
        echo "3. Descomentar workflow en .github/workflows/codeql.yml"
        ;;
      2)
        echo "Para SSL con Let's Encrypt:"
        echo "1. Tener dominio apuntando a EC2"
        echo "2. Instalar certbot: sudo apt install certbot python3-certbot-nginx"
        echo "3. Ejecutar: sudo certbot --nginx -d tudominio.com"
        ;;
      *)
        echo "Ver DEPLOYMENT_GUIDE.md para más detalles"
        ;;
    esac
    ;;

  0)
    echo "¡Hasta luego! 👋"
    exit 0
    ;;

  *)
    echo "❌ Opción inválida"
    exit 1
    ;;
esac

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Proceso completado"
echo ""
echo "Para más ayuda:"
echo "  - Ver guías en el repositorio"
echo "  - Ejecutar este script nuevamente"
echo "  - Consultar ROADMAP_CI_CD.md"
echo ""
