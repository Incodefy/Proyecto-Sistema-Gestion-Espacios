#!/bin/bash
# ========================================
# Blue/Green Deployment Script for EC2
# ========================================

set -e

PROJECT_NAME=${1:-"incodefy"}
STAGE=${2:-"dev"}
REGION=${3:-"us-east-2"}
DEPLOYMENT_TYPE=${4:-"blue-green"}  # blue-green or canary

echo "=================================="
echo "Blue/Green Deployment Script"
echo "=================================="
echo "Project: $PROJECT_NAME"
echo "Stage: $STAGE"
echo "Region: $REGION"
echo "Type: $DEPLOYMENT_TYPE"
echo "=================================="
echo ""

# Get CodeDeploy Application Name
APP_NAME="${PROJECT_NAME}-app-${STAGE}"
DEPLOYMENT_GROUP="${PROJECT_NAME}-${DEPLOYMENT_TYPE}-${STAGE}"
S3_BUCKET="${PROJECT_NAME}-codedeploy-artifacts-${STAGE}"

echo "📦 Step 1: Creating deployment package..."
cd ../incodefy

# Create appspec.yml for CodeDeploy
cat > appspec.yml << 'EOF'
version: 0.0
os: linux
files:
  - source: /
    destination: /home/ubuntu/app
hooks:
  BeforeInstall:
    - location: scripts/before_install.sh
      timeout: 300
      runas: ubuntu
  AfterInstall:
    - location: scripts/after_install.sh
      timeout: 300
      runas: ubuntu
  ApplicationStart:
    - location: scripts/application_start.sh
      timeout: 300
      runas: ubuntu
  ApplicationStop:
    - location: scripts/application_stop.sh
      timeout: 60
      runas: ubuntu
  ValidateService:
    - location: scripts/validate_service.sh
      timeout: 300
      runas: ubuntu
EOF

# Create deployment scripts
mkdir -p scripts

cat > scripts/before_install.sh << 'EOF'
#!/bin/bash
echo "BeforeInstall: Preparing environment..."
sudo apt-get update
sudo apt-get install -y nodejs npm
EOF

cat > scripts/after_install.sh << 'EOF'
#!/bin/bash
echo "AfterInstall: Installing dependencies..."
cd /home/ubuntu/app
npm ci --production
EOF

cat > scripts/application_stop.sh << 'EOF'
#!/bin/bash
echo "ApplicationStop: Stopping old version..."
pm2 stop all || true
EOF

cat > scripts/application_start.sh << 'EOF'
#!/bin/bash
echo "ApplicationStart: Starting new version..."
cd /home/ubuntu/app
pm2 start server.js --name incodefy-app
pm2 save
EOF

cat > scripts/validate_service.sh << 'EOF'
#!/bin/bash
echo "ValidateService: Health check..."
sleep 10
curl -f http://localhost:3000/health || exit 1
echo "Health check passed!"
EOF

chmod +x scripts/*.sh

# Create deployment package
echo "📦 Creating deployment package..."
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
PACKAGE_NAME="deployment-${TIMESTAMP}.zip"

zip -r $PACKAGE_NAME . \
  -x "*.git*" \
  -x "node_modules/*" \
  -x "coverage/*" \
  -x "*.log" \
  -x "*.md"

echo "✅ Package created: $PACKAGE_NAME"
echo ""

# Upload to S3
echo "☁️  Step 2: Uploading to S3..."
aws s3 cp $PACKAGE_NAME s3://$S3_BUCKET/$PACKAGE_NAME --region $REGION

S3_LOCATION="s3://$S3_BUCKET/$PACKAGE_NAME"
echo "✅ Uploaded to: $S3_LOCATION"
echo ""

# Create deployment
echo "🚀 Step 3: Creating CodeDeploy deployment..."

DEPLOYMENT_ID=$(aws deploy create-deployment \
  --application-name $APP_NAME \
  --deployment-group-name $DEPLOYMENT_GROUP \
  --s3-location bucket=$S3_BUCKET,key=$PACKAGE_NAME,bundleType=zip \
  --region $REGION \
  --query 'deploymentId' \
  --output text)

echo "✅ Deployment created: $DEPLOYMENT_ID"
echo ""

# Monitor deployment
echo "📊 Step 4: Monitoring deployment..."
echo "Deployment ID: $DEPLOYMENT_ID"
echo ""

while true; do
  STATUS=$(aws deploy get-deployment \
    --deployment-id $DEPLOYMENT_ID \
    --region $REGION \
    --query 'deploymentInfo.status' \
    --output text)

  echo "⏳ Status: $STATUS"

  case $STATUS in
    "Succeeded")
      echo ""
      echo "🎉 Deployment SUCCEEDED!"
      echo ""
      aws deploy get-deployment \
        --deployment-id $DEPLOYMENT_ID \
        --region $REGION \
        --output table
      exit 0
      ;;
    "Failed"|"Stopped")
      echo ""
      echo "❌ Deployment FAILED!"
      echo ""
      aws deploy get-deployment \
        --deployment-id $DEPLOYMENT_ID \
        --region $REGION \
        --output table
      exit 1
      ;;
    *)
      sleep 10
      ;;
  esac
done
