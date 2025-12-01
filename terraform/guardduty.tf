# ========================================
# AWS GUARDDUTY - Detección de Amenazas
# ========================================

resource "aws_guardduty_detector" "main" {
  count = var.enable_guardduty ? 1 : 0

  enable = true

  datasources {
    s3_logs {
      enable = true
    }
    kubernetes {
      audit_logs {
        enable = false # No se usa Kubernetes en este proyecto
      }
    }
    malware_protection {
      scan_ec2_instance_with_findings {
        ebs_volumes {
          enable = true
        }
      }
    }
  }

  finding_publishing_frequency = "FIFTEEN_MINUTES"

  tags = {
    Name        = "${var.project_name}-guardduty-${var.stage}"
    Project     = var.project_name
    Environment = var.stage
  }
}

# ========================================
# SNS TOPIC PARA NOTIFICACIONES DE GUARDDUTY
# ========================================

resource "aws_sns_topic" "guardduty_alerts" {
  count = var.enable_guardduty ? 1 : 0

  name = "${var.project_name}-guardduty-alerts-${var.stage}"

  tags = {
    Name        = "${var.project_name}-guardduty-alerts-${var.stage}"
    Project     = var.project_name
    Environment = var.stage
  }
}

resource "aws_sns_topic_subscription" "guardduty_email" {
  count = var.enable_guardduty && var.security_alert_email != "" ? 1 : 0

  topic_arn = aws_sns_topic.guardduty_alerts[0].arn
  protocol  = "email"
  endpoint  = var.security_alert_email
}

# ========================================
# EVENTBRIDGE RULE PARA CAPTURAR FINDINGS
# ========================================

resource "aws_cloudwatch_event_rule" "guardduty_findings" {
  count = var.enable_guardduty ? 1 : 0

  name        = "${var.project_name}-guardduty-findings-${var.stage}"
  description = "Capture GuardDuty findings with Medium to High severity"

  event_pattern = jsonencode({
    source      = ["aws.guardduty"]
    detail-type = ["GuardDuty Finding"]
    detail = {
      severity = [4, 4.0, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9,
        5, 5.0, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9,
        6, 6.0, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9,
        7, 7.0, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9,
      8, 8.0, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 8.9] # Medium (4.0-6.9) y High (7.0-8.9)
    }
  })

  tags = {
    Name        = "${var.project_name}-guardduty-findings-${var.stage}"
    Project     = var.project_name
    Environment = var.stage
  }
}

resource "aws_cloudwatch_event_target" "guardduty_sns" {
  count = var.enable_guardduty ? 1 : 0

  rule      = aws_cloudwatch_event_rule.guardduty_findings[0].name
  target_id = "SendToSNS"
  arn       = aws_sns_topic.guardduty_alerts[0].arn
}

# ========================================
# SNS TOPIC POLICY
# ========================================

resource "aws_sns_topic_policy" "guardduty_alerts" {
  count = var.enable_guardduty ? 1 : 0

  arn = aws_sns_topic.guardduty_alerts[0].arn

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "events.amazonaws.com"
        }
        Action   = "SNS:Publish"
        Resource = aws_sns_topic.guardduty_alerts[0].arn
      }
    ]
  })
}

# ========================================
# CLOUDWATCH LOG GROUP PARA GUARDDUTY
# ========================================

resource "aws_cloudwatch_log_group" "guardduty_logs" {
  count = var.enable_guardduty ? 1 : 0

  name              = "/aws/guardduty/${var.project_name}-${var.stage}"
  retention_in_days = 30

  tags = {
    Name        = "${var.project_name}-guardduty-logs-${var.stage}"
    Project     = var.project_name
    Environment = var.stage
  }
}

# ========================================
# LAMBDA PARA AUTOMATIZAR RESPUESTAS (OPCIONAL)
# ========================================

# Esta función Lambda puede tomar acciones automáticas basadas en findings
# Por ejemplo: aislar instancias comprometidas, bloquear IPs, etc.

/*
resource "aws_lambda_function" "guardduty_responder" {
  count = var.enable_guardduty ? 1 : 0

  filename      = "${path.module}/guardduty-responder.zip"
  function_name = "${var.project_name}-guardduty-responder-${var.stage}"
  role          = aws_iam_role.guardduty_responder[0].arn
  handler       = "index.handler"
  runtime       = "python3.11"
  timeout       = 60

  environment {
    variables = {
      PROJECT_NAME = var.project_name
      STAGE        = var.stage
    }
  }

  tags = {
    Name        = "${var.project_name}-guardduty-responder-${var.stage}"
    Project     = var.project_name
    Environment = var.stage
  }
}

resource "aws_iam_role" "guardduty_responder" {
  count = var.enable_guardduty ? 1 : 0

  name = "${var.project_name}-guardduty-responder-role-${var.stage}"

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
    Name        = "${var.project_name}-guardduty-responder-role-${var.stage}"
    Project     = var.project_name
    Environment = var.stage
  }
}

resource "aws_iam_role_policy_attachment" "guardduty_responder_basic" {
  count = var.enable_guardduty ? 1 : 0

  role       = aws_iam_role.guardduty_responder[0].name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_lambda_permission" "guardduty_invoke" {
  count = var.enable_guardduty ? 1 : 0

  statement_id  = "AllowExecutionFromEventBridge"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.guardduty_responder[0].function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.guardduty_findings[0].arn
}

resource "aws_cloudwatch_event_target" "guardduty_lambda" {
  count = var.enable_guardduty ? 1 : 0

  rule      = aws_cloudwatch_event_rule.guardduty_findings[0].name
  target_id = "InvokeLambda"
  arn       = aws_lambda_function.guardduty_responder[0].arn
}
*/
