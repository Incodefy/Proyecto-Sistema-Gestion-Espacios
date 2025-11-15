# ========================================
# Terraform Configuration for Gremlin
# IAM Roles, Policies, y Recursos
# ========================================

# IAM Role para Gremlin Lambda Layer
resource "aws_iam_role" "gremlin_execution_role" {
  name = "${var.service_name}-${var.stage}-gremlin-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Environment = var.stage
    Project     = var.project_name
    ManagedBy   = "Terraform"
    Purpose     = "Gremlin Chaos Engineering"
  }
}

# Policy para Gremlin - CloudWatch Metrics
resource "aws_iam_policy" "gremlin_cloudwatch_policy" {
  name        = "${var.service_name}-${var.stage}-gremlin-cloudwatch"
  description = "Permite a Gremlin publicar métricas en CloudWatch"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "CloudWatchMetrics"
        Effect = "Allow"
        Action = [
          "cloudwatch:PutMetricData",
          "cloudwatch:GetMetricStatistics",
          "cloudwatch:ListMetrics"
        ]
        Resource = "*"
      },
      {
        Sid    = "CloudWatchLogs"
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
          "logs:FilterLogEvents"
        ]
        Resource = "arn:aws:logs:${var.region}:*:log-group:/aws/lambda/${var.service_name}-${var.stage}-*"
      }
    ]
  })

  tags = {
    Environment = var.stage
    Project     = var.project_name
  }
}

# Adjuntar policy al role
resource "aws_iam_role_policy_attachment" "gremlin_cloudwatch_attach" {
  role       = aws_iam_role.gremlin_execution_role.name
  policy_arn = aws_iam_policy.gremlin_cloudwatch_policy.arn
}

# Lambda Layer para Gremlin SDK
resource "aws_lambda_layer_version" "gremlin" {
  count               = var.gremlin_enabled ? 1 : 0
  filename            = "${path.module}/../gremlin-layer.zip"
  layer_name          = "${var.service_name}-${var.stage}-gremlin-sdk"
  compatible_runtimes = ["nodejs18.x", "nodejs20.x"]
  description         = "Gremlin SDK for Chaos Engineering"

  source_code_hash = fileexists("${path.module}/../gremlin-layer.zip") ? filebase64sha256("${path.module}/../gremlin-layer.zip") : null

  lifecycle {
    ignore_changes = [source_code_hash]
  }
}

# Secrets Manager para credenciales de Gremlin
resource "aws_secretsmanager_secret" "gremlin_credentials" {
  count       = var.gremlin_enabled ? 1 : 0
  name        = "${var.service_name}-${var.stage}-gremlin-credentials"
  description = "Credenciales de Gremlin para Chaos Engineering"

  tags = {
    Environment = var.stage
    Project     = var.project_name
    ManagedBy   = "Terraform"
  }
}

resource "aws_secretsmanager_secret_version" "gremlin_credentials" {
  count     = var.gremlin_enabled ? 1 : 0
  secret_id = aws_secretsmanager_secret.gremlin_credentials[0].id

  secret_string = jsonencode({
    team_id = var.gremlin_team_id
    api_key = var.gremlin_api_key
  })

  lifecycle {
    ignore_changes = [secret_string]
  }
}

# Policy para acceso a Secrets Manager
resource "aws_iam_policy" "gremlin_secrets_policy" {
  count       = var.gremlin_enabled ? 1 : 0
  name        = "${var.service_name}-${var.stage}-gremlin-secrets"
  description = "Permite acceso a credenciales de Gremlin"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue",
          "secretsmanager:DescribeSecret"
        ]
        Resource = aws_secretsmanager_secret.gremlin_credentials[0].arn
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "gremlin_secrets_attach" {
  count      = var.gremlin_enabled ? 1 : 0
  role       = aws_iam_role.gremlin_execution_role.name
  policy_arn = aws_iam_policy.gremlin_secrets_policy[0].arn
}

# EventBridge Rule para ejecutar experimentos programados
resource "aws_cloudwatch_event_rule" "weekly_chaos_experiment" {
  count               = var.gremlin_enabled && var.gremlin_scheduled_experiments ? 1 : 0
  name                = "${var.service_name}-${var.stage}-weekly-chaos"
  description         = "Ejecuta experimentos de caos semanalmente"
  schedule_expression = "cron(0 14 ? * TUE *)"  # Martes 2 PM UTC

  tags = {
    Environment = var.stage
    Project     = var.project_name
  }
}

# Lambda Function para ejecutar experimentos
resource "aws_lambda_function" "chaos_executor" {
  count         = var.gremlin_enabled ? 1 : 0
  filename      = "${path.module}/../chaos-executor.zip"
  function_name = "${var.service_name}-${var.stage}-chaos-executor"
  role          = aws_iam_role.gremlin_execution_role.arn
  handler       = "index.handler"
  runtime       = "nodejs20.x"
  timeout       = 900  # 15 minutos

  environment {
    variables = {
      GREMLIN_TEAM_ID     = var.gremlin_team_id
      GREMLIN_API_KEY_ARN = var.gremlin_enabled ? aws_secretsmanager_secret.gremlin_credentials[0].arn : ""
      STAGE               = var.stage
      SERVICE_NAME        = var.service_name
    }
  }

  layers = var.gremlin_enabled ? [aws_lambda_layer_version.gremlin[0].arn] : []

  source_code_hash = fileexists("${path.module}/../chaos-executor.zip") ? filebase64sha256("${path.module}/../chaos-executor.zip") : null

  lifecycle {
    ignore_changes = [source_code_hash]
  }

  tags = {
    Environment = var.stage
    Project     = var.project_name
    Purpose     = "Chaos Engineering Executor"
  }
}

# EventBridge Target
resource "aws_cloudwatch_event_target" "chaos_executor" {
  count     = var.gremlin_enabled && var.gremlin_scheduled_experiments ? 1 : 0
  rule      = aws_cloudwatch_event_rule.weekly_chaos_experiment[0].name
  target_id = "ChaosExecutor"
  arn       = aws_lambda_function.chaos_executor[0].arn

  input = jsonencode({
    experiment = "latencyInjection"
    automated  = true
  })
}

# Permission para EventBridge invocar Lambda
resource "aws_lambda_permission" "allow_eventbridge" {
  count         = var.gremlin_enabled && var.gremlin_scheduled_experiments ? 1 : 0
  statement_id  = "AllowEventBridgeInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.chaos_executor[0].function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.weekly_chaos_experiment[0].arn
}

# S3 Bucket para reportes de experimentos
resource "aws_s3_bucket" "chaos_reports" {
  count  = var.gremlin_enabled ? 1 : 0
  bucket = "${var.service_name}-${var.stage}-chaos-reports"

  tags = {
    Environment = var.stage
    Project     = var.project_name
    Purpose     = "Chaos Experiment Reports"
  }
}

resource "aws_s3_bucket_versioning" "chaos_reports" {
  count  = var.gremlin_enabled ? 1 : 0
  bucket = aws_s3_bucket.chaos_reports[0].id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "chaos_reports" {
  count  = var.gremlin_enabled ? 1 : 0
  bucket = aws_s3_bucket.chaos_reports[0].id

  rule {
    id     = "delete_old_reports"
    status = "Enabled"

    expiration {
      days = 90
    }

    noncurrent_version_expiration {
      noncurrent_days = 30
    }
  }
}

# Policy para escribir reportes en S3
resource "aws_iam_policy" "gremlin_s3_policy" {
  count       = var.gremlin_enabled ? 1 : 0
  name        = "${var.service_name}-${var.stage}-gremlin-s3"
  description = "Permite a Gremlin guardar reportes en S3"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject",
          "s3:ListBucket"
        ]
        Resource = [
          aws_s3_bucket.chaos_reports[0].arn,
          "${aws_s3_bucket.chaos_reports[0].arn}/*"
        ]
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "gremlin_s3_attach" {
  count      = var.gremlin_enabled ? 1 : 0
  role       = aws_iam_role.gremlin_execution_role.name
  policy_arn = aws_iam_policy.gremlin_s3_policy[0].arn
}

# CloudWatch Log Group para experimentos
resource "aws_cloudwatch_log_group" "chaos_experiments" {
  count             = var.gremlin_enabled ? 1 : 0
  name              = "/aws/lambda/${var.service_name}-${var.stage}-chaos-executor"
  retention_in_days = 30

  tags = {
    Environment = var.stage
    Project     = var.project_name
  }
}

# ========================================
# Outputs
# ========================================

output "gremlin_role_arn" {
  description = "ARN del IAM Role para Gremlin"
  value       = aws_iam_role.gremlin_execution_role.arn
}

output "gremlin_layer_arn" {
  description = "ARN del Lambda Layer de Gremlin"
  value       = var.gremlin_enabled ? aws_lambda_layer_version.gremlin[0].arn : ""
}

output "gremlin_secrets_arn" {
  description = "ARN del secret de credenciales de Gremlin"
  value       = var.gremlin_enabled ? aws_secretsmanager_secret.gremlin_credentials[0].arn : ""
}

output "chaos_executor_function_name" {
  description = "Nombre de la Lambda que ejecuta experimentos"
  value       = var.gremlin_enabled ? aws_lambda_function.chaos_executor[0].function_name : ""
}

output "chaos_reports_bucket" {
  description = "Bucket S3 para reportes de experimentos"
  value       = var.gremlin_enabled ? aws_s3_bucket.chaos_reports[0].bucket : ""
}
