# ========================================
# SNS TOPIC PARA ALERTAS DE SEGURIDAD
# ========================================

resource "aws_sns_topic" "security_alerts" {
  count = var.security_alert_email != "" ? 1 : 0

  name = "${var.project_name}-security-alerts-${var.stage}"

  tags = {
    Name        = "${var.project_name}-security-alerts-${var.stage}"
    Project     = var.project_name
    Environment = var.stage
  }
}

resource "aws_sns_topic_subscription" "security_alerts_email" {
  count = var.security_alert_email != "" ? 1 : 0

  topic_arn = aws_sns_topic.security_alerts[0].arn
  protocol  = "email"
  endpoint  = var.security_alert_email
}

# ========================================
# PARAMETER STORE - Gestión Segura de Secrets
# ========================================

resource "aws_ssm_parameter" "session_secret" {
  count = var.session_secret != "" ? 1 : 0

  name        = "/${var.project_name}/${var.stage}/session_secret"
  description = "Session secret for Express.js"
  type        = "SecureString"
  value       = var.session_secret
  tier        = "Standard"

  tags = {
    Name        = "${var.project_name}-session-secret-${var.stage}"
    Project     = var.project_name
    Environment = var.stage
  }
}



resource "aws_ssm_parameter" "user_pool_id" {
  count = var.user_pool_id != "" ? 1 : 0

  name        = "/${var.project_name}/${var.stage}/user_pool_id"
  description = "Cognito User Pool ID"
  type        = "String"
  value       = var.user_pool_id
  tier        = "Standard"

  tags = {
    Name        = "${var.project_name}-user-pool-id-${var.stage}"
    Project     = var.project_name
    Environment = var.stage
  }
}

resource "aws_ssm_parameter" "user_pool_client_id" {
  count = var.user_pool_client_id != "" ? 1 : 0

  name        = "/${var.project_name}/${var.stage}/user_pool_client_id"
  description = "Cognito User Pool Client ID"
  type        = "String"
  value       = var.user_pool_client_id
  tier        = "Standard"

  tags = {
    Name        = "${var.project_name}-user-pool-client-id-${var.stage}"
    Project     = var.project_name
    Environment = var.stage
  }
}

# ========================================
# IAM POLICY - Lectura de Parameter Store
# ========================================

resource "aws_iam_policy" "parameter_store_read" {
  name        = "${var.project_name}-parameter-store-read-${var.stage}"
  description = "Allow reading parameters from Parameter Store"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = [
          "ssm:GetParameter",
          "ssm:GetParameters",
          "ssm:GetParametersByPath"
        ]
        Effect = "Allow"
        Resource = [
          "arn:aws:ssm:${var.region}:*:parameter/${var.project_name}/${var.stage}/*"
        ]
      },
      {
        Action = [
          "kms:Decrypt"
        ]
        Effect   = "Allow"
        Resource = "*"
      }
    ]
  })

  tags = {
    Name        = "${var.project_name}-parameter-store-read-${var.stage}"
    Project     = var.project_name
    Environment = var.stage
  }
}

# Adjuntar política a roles existentes
resource "aws_iam_role_policy_attachment" "ec2_parameter_store" {
  role       = aws_iam_role.ec2_app.name
  policy_arn = aws_iam_policy.parameter_store_read.arn
}

# ========================================
# VPC ENDPOINTS (para mayor seguridad)
# ========================================

# VPC Endpoint para S3
resource "aws_vpc_endpoint" "s3" {
  vpc_id       = aws_vpc.main.id
  service_name = "com.amazonaws.${var.region}.s3"

  tags = {
    Name        = "${var.project_name}-s3-endpoint-${var.stage}"
    Project     = var.project_name
    Environment = var.stage
  }
}

resource "aws_vpc_endpoint_route_table_association" "s3_private" {
  route_table_id  = aws_route_table.private.id
  vpc_endpoint_id = aws_vpc_endpoint.s3.id
}

# VPC Endpoint para DynamoDB
resource "aws_vpc_endpoint" "dynamodb" {
  vpc_id       = aws_vpc.main.id
  service_name = "com.amazonaws.${var.region}.dynamodb"

  tags = {
    Name        = "${var.project_name}-dynamodb-endpoint-${var.stage}"
    Project     = var.project_name
    Environment = var.stage
  }
}

resource "aws_vpc_endpoint_route_table_association" "dynamodb_private" {
  route_table_id  = aws_route_table.private.id
  vpc_endpoint_id = aws_vpc_endpoint.dynamodb.id
}

# VPC Endpoint para SSM (Systems Manager)
resource "aws_vpc_endpoint" "ssm" {
  vpc_id              = aws_vpc.main.id
  service_name        = "com.amazonaws.${var.region}.ssm"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = [aws_subnet.private_az1.id, aws_subnet.private_az2.id]
  security_group_ids  = [aws_security_group.vpc_endpoints.id]
  private_dns_enabled = true

  tags = {
    Name        = "${var.project_name}-ssm-endpoint-${var.stage}"
    Project     = var.project_name
    Environment = var.stage
  }
}

# VPC Endpoint para CloudWatch Logs
resource "aws_vpc_endpoint" "logs" {
  vpc_id              = aws_vpc.main.id
  service_name        = "com.amazonaws.${var.region}.logs"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = [aws_subnet.private_az1.id, aws_subnet.private_az2.id]
  security_group_ids  = [aws_security_group.vpc_endpoints.id]
  private_dns_enabled = true

  tags = {
    Name        = "${var.project_name}-logs-endpoint-${var.stage}"
    Project     = var.project_name
    Environment = var.stage
  }
}

# ========================================
# SECRETS ROTATION (opcional)
# ========================================

# Lambda function para rotar secretos automáticamente
# Esto mejora la seguridad rotando credenciales periódicamente

/*
resource "aws_secretsmanager_secret" "db_credentials" {
  count = var.enable_rds ? 1 : 0

  name = "${var.project_name}-db-credentials-${var.stage}"
  description = "RDS database credentials with automatic rotation"

  tags = {
    Name        = "${var.project_name}-db-credentials-${var.stage}"
    Project     = var.project_name
    Environment = var.stage
  }
}

resource "aws_secretsmanager_secret_version" "db_credentials" {
  count = var.enable_rds ? 1 : 0

  secret_id = aws_secretsmanager_secret.db_credentials[0].id
  secret_string = jsonencode({
    username = var.db_username
    password = var.db_password
    engine   = "mysql"
    host     = aws_db_instance.main[0].address
    port     = 3306
    dbname   = var.db_name
  })
}

resource "aws_secretsmanager_secret_rotation" "db_credentials" {
  count = var.enable_rds ? 1 : 0

  secret_id           = aws_secretsmanager_secret.db_credentials[0].id
  rotation_lambda_arn = aws_lambda_function.secrets_rotator[0].arn

  rotation_rules {
    automatically_after_days = 30
  }
}
*/
