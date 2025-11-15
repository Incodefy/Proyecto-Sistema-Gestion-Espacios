# ========================================
# CloudWatch Dashboards y Alarmas
# Etapa 3: Monitoreo con SLO/SLI
# ========================================

# Variables para métricas
locals {
  dashboard_name = "${var.service_name}-${var.stage}-system-health"
  chaos_dashboard_name = "${var.service_name}-${var.stage}-chaos-experiments"
  
  # Namespaces de métricas
  api_gateway_namespace = "AWS/ApiGateway"
  lambda_namespace = "AWS/Lambda"
  dynamodb_namespace = "AWS/DynamoDB"
  custom_namespace = "HospitalPadreHurtado"
  
  # SLO targets por servicio
  slo_targets = {
    login = {
      availability = 99.9
      latency_p95 = 500
      latency_p99 = 1000
      error_rate = 0.5
    }
    agenda = {
      availability = 99.5
      latency_p95 = 800
      latency_p99 = 1500
      error_rate = 1.0
    }
    personalization = {
      availability = 99.0
      latency_p95 = 1000
      latency_p99 = 2000
      error_rate = 2.0
    }
    catalog = {
      availability = 99.5
      latency_p95 = 600
      latency_p99 = 1200
      error_rate = 1.0
    }
  }
}

# ========================================
# Dashboard Principal: System Health
# ========================================

resource "aws_cloudwatch_dashboard" "system_health" {
  dashboard_name = local.dashboard_name

  dashboard_body = jsonencode({
    widgets = [
      # ===== ROW 1: AVAILABILITY GAUGES =====
      {
        type = "metric"
        width = 6
        height = 6
        properties = {
          title = "Login Availability (SLO: 99.9%)"
          region = var.region
          metrics = [
            [
              local.custom_namespace,
              "Availability",
              { stat = "Average", period = 300, label = "Current" }
            ]
          ]
          yAxis = {
            left = { min = 95, max = 100 }
          }
          annotations = {
            horizontal = [
              {
                value = local.slo_targets.login.availability
                label = "SLO Target"
                fill = "above"
                color = "#2ca02c"
              },
              {
                value = 99.5
                label = "Warning"
                fill = "between"
                color = "#ff7f0e"
              }
            ]
          }
          view = "gauge"
        }
      },
      {
        type = "metric"
        width = 6
        height = 6
        properties = {
          title = "Agenda Availability (SLO: 99.5%)"
          region = var.region
          metrics = [
            [
              local.custom_namespace,
              "Availability",
              "Service", "Agenda",
              { stat = "Average", period = 300 }
            ]
          ]
          yAxis = {
            left = { min = 95, max = 100 }
          }
          annotations = {
            horizontal = [
              {
                value = local.slo_targets.agenda.availability
                label = "SLO Target"
                fill = "above"
                color = "#2ca02c"
              }
            ]
          }
          view = "gauge"
        }
      },
      {
        type = "metric"
        width = 6
        height = 6
        properties = {
          title = "Catalog Availability (SLO: 99.5%)"
          region = var.region
          metrics = [
            [
              local.custom_namespace,
              "Availability",
              "Service", "Catalog",
              { stat = "Average", period = 300 }
            ]
          ]
          yAxis = {
            left = { min = 95, max = 100 }
          }
          annotations = {
            horizontal = [
              {
                value = local.slo_targets.catalog.availability
                label = "SLO Target"
                fill = "above"
                color = "#2ca02c"
              }
            ]
          }
          view = "gauge"
        }
      },
      {
        type = "metric"
        width = 6
        height = 6
        properties = {
          title = "Error Budget Burn Rate"
          region = var.region
          metrics = [
            [
              local.custom_namespace,
              "ErrorBudgetBurnRate",
              { stat = "Average", period = 300 }
            ]
          ]
          yAxis = {
            left = { min = 0, max = 100 }
          }
          annotations = {
            horizontal = [
              {
                value = 30
                label = "Warning (30%)"
                color = "#ff7f0e"
              },
              {
                value = 70
                label = "Critical (70%)"
                color = "#d62728"
              }
            ]
          }
          view = "gauge"
        }
      },

      # ===== ROW 2: REQUEST RATE & ERROR RATE =====
      {
        type = "metric"
        width = 12
        height = 6
        properties = {
          title = "Request Rate (requests/min)"
          region = var.region
          metrics = [
            [ local.custom_namespace, "RequestCount", { stat = "Sum", period = 60, label = "Total" } ],
            [ "...", "Service", "Login", { stat = "Sum", period = 60, label = "Login" } ],
            [ "...", "Service", "Agenda", { stat = "Sum", period = 60, label = "Agenda" } ],
            [ "...", "Service", "Catalog", { stat = "Sum", period = 60, label = "Catalog" } ],
            [ "...", "Service", "Personalization", { stat = "Sum", period = 60, label = "Personalization" } ]
          ]
          view = "timeSeries"
          stacked = false
          yAxis = {
            left = { min = 0 }
          }
        }
      },
      {
        type = "metric"
        width = 12
        height = 6
        properties = {
          title = "Error Rate by Type (%)"
          region = var.region
          metrics = [
            [ local.custom_namespace, "4XXError", { stat = "Average", period = 300, label = "4xx Errors", color = "#ff7f0e" } ],
            [ ".", "5XXError", { stat = "Average", period = 300, label = "5xx Errors", color = "#d62728" } ]
          ]
          view = "timeSeries"
          stacked = true
          yAxis = {
            left = { min = 0, max = 10 }
          }
          annotations = {
            horizontal = [
              {
                value = 1
                label = "Warning Threshold"
                color = "#ff7f0e"
              },
              {
                value = 5
                label = "Critical Threshold"
                color = "#d62728"
              }
            ]
          }
        }
      },

      # ===== ROW 3: LATENCY PERCENTILES =====
      {
        type = "metric"
        width = 12
        height = 6
        properties = {
          title = "Login Latency (ms)"
          region = var.region
          metrics = [
            [ local.lambda_namespace, "Duration", "FunctionName", "${var.service_name}-${var.stage}-login", { stat = "p50", period = 300, label = "P50" } ],
            [ "...", { stat = "p95", period = 300, label = "P95" } ],
            [ "...", { stat = "p99", period = 300, label = "P99" } ]
          ]
          view = "timeSeries"
          stacked = false
          yAxis = {
            left = { min = 0 }
          }
          annotations = {
            horizontal = [
              {
                value = local.slo_targets.login.latency_p95
                label = "P95 SLO"
                color = "#ff7f0e"
              },
              {
                value = local.slo_targets.login.latency_p99
                label = "P99 SLO"
                color = "#d62728"
              }
            ]
          }
        }
      },
      {
        type = "metric"
        width = 12
        height = 6
        properties = {
          title = "Agenda Latency (ms)"
          region = var.region
          metrics = [
            [ local.lambda_namespace, "Duration", "FunctionName", "${var.service_name}-${var.stage}-getAgenda", { stat = "p50", period = 300, label = "P50" } ],
            [ "...", { stat = "p95", period = 300, label = "P95" } ],
            [ "...", { stat = "p99", period = 300, label = "P99" } ]
          ]
          view = "timeSeries"
          stacked = false
          yAxis = {
            left = { min = 0 }
          }
          annotations = {
            horizontal = [
              {
                value = local.slo_targets.agenda.latency_p95
                label = "P95 SLO"
                color = "#ff7f0e"
              },
              {
                value = local.slo_targets.agenda.latency_p99
                label = "P99 SLO"
                color = "#d62728"
              }
            ]
          }
        }
      },

      # ===== ROW 4: LAMBDA METRICS =====
      {
        type = "metric"
        width = 8
        height = 6
        properties = {
          title = "Lambda Concurrent Executions"
          region = var.region
          metrics = [
            [ local.lambda_namespace, "ConcurrentExecutions", { stat = "Maximum", period = 60 } ]
          ]
          view = "timeSeries"
          stacked = false
          yAxis = {
            left = { min = 0 }
          }
          annotations = {
            horizontal = [
              {
                value = 800
                label = "Reserved Concurrency Limit"
                color = "#d62728"
              }
            ]
          }
        }
      },
      {
        type = "metric"
        width = 8
        height = 6
        properties = {
          title = "Lambda Throttles"
          region = var.region
          metrics = [
            [ local.lambda_namespace, "Throttles", { stat = "Sum", period = 60 } ]
          ]
          view = "singleValue"
          setPeriodToTimeRange = false
        }
      },
      {
        type = "metric"
        width = 8
        height = 6
        properties = {
          title = "Lambda Errors"
          region = var.region
          metrics = [
            [ local.lambda_namespace, "Errors", { stat = "Sum", period = 60 } ]
          ]
          view = "singleValue"
          setPeriodToTimeRange = false
        }
      },

      # ===== ROW 5: DYNAMODB METRICS =====
      {
        type = "metric"
        width = 12
        height = 6
        properties = {
          title = "DynamoDB Read/Write Capacity (Units/sec)"
          region = var.region
          metrics = [
            [ local.dynamodb_namespace, "ConsumedReadCapacityUnits", "TableName", aws_dynamodb_table.agenda.name, { stat = "Sum", period = 60, label = "Read" } ],
            [ ".", "ConsumedWriteCapacityUnits", ".", ".", { stat = "Sum", period = 60, label = "Write" } ]
          ]
          view = "timeSeries"
          stacked = false
          yAxis = {
            left = { min = 0 }
          }
        }
      },
      {
        type = "metric"
        width = 12
        height = 6
        properties = {
          title = "DynamoDB Throttles"
          region = var.region
          metrics = [
            [ local.dynamodb_namespace, "UserErrors", "TableName", aws_dynamodb_table.agenda.name, { stat = "Sum", period = 60 } ]
          ]
          view = "timeSeries"
          stacked = false
          yAxis = {
            left = { min = 0 }
          }
        }
      },

      # ===== ROW 6: COST METRICS =====
      {
        type = "metric"
        width = 24
        height = 6
        properties = {
          title = "Estimated Daily Cost (USD)"
          region = var.region
          metrics = [
            [ local.custom_namespace, "EstimatedCost", "Service", "Lambda", { stat = "Sum", period = 86400 } ],
            [ "...", "Service", "DynamoDB", { stat = "Sum", period = 86400 } ],
            [ "...", "Service", "APIGateway", { stat = "Sum", period = 86400 } ]
          ]
          view = "timeSeries"
          stacked = true
          yAxis = {
            left = { min = 0 }
          }
        }
      }
    ]
  })

  depends_on = [
    aws_dynamodb_table.agenda,
    aws_dynamodb_table.hpp_parameters
  ]
}

# ========================================
# Dashboard de Chaos Engineering
# ========================================

resource "aws_cloudwatch_dashboard" "chaos_experiments" {
  dashboard_name = local.chaos_dashboard_name

  dashboard_body = jsonencode({
    widgets = [
      # Active Experiments
      {
        type = "metric"
        width = 6
        height = 6
        properties = {
          title = "Active Chaos Experiments"
          region = var.region
          metrics = [
            [ local.custom_namespace, "ActiveExperiments", { stat = "Sum", period = 60 } ]
          ]
          view = "singleValue"
        }
      },
      
      # Experiment Results
      {
        type = "metric"
        width = 6
        height = 6
        properties = {
          title = "Experiment Success Rate"
          region = var.region
          metrics = [
            [ local.custom_namespace, "ExperimentSuccess", { stat = "Average", period = 300 } ]
          ]
          view = "gauge"
          yAxis = {
            left = { min = 0, max = 100 }
          }
        }
      },

      # Recovery Time
      {
        type = "metric"
        width = 12
        height = 6
        properties = {
          title = "System Recovery Time (seconds)"
          region = var.region
          metrics = [
            [ local.custom_namespace, "RecoveryTime", { stat = "Average", period = 300 } ]
          ]
          view = "timeSeries"
          yAxis = {
            left = { min = 0 }
          }
          annotations = {
            horizontal = [
              {
                value = 60
                label = "SLO Target (1 min)"
                color = "#2ca02c"
              },
              {
                value = 300
                label = "Max Acceptable (5 min)"
                color = "#d62728"
              }
            ]
          }
        }
      },

      # Blast Radius
      {
        type = "metric"
        width = 12
        height = 6
        properties = {
          title = "Affected Services"
          region = var.region
          metrics = [
            [ local.custom_namespace, "AffectedServices", "Service", "Login", { stat = "Sum", period = 60 } ],
            [ "...", "Service", "Agenda", { stat = "Sum", period = 60 } ],
            [ "...", "Service", "Catalog", { stat = "Sum", period = 60 } ]
          ]
          view = "timeSeries"
          stacked = true
        }
      },

      # Experiment History
      {
        type = "log"
        width = 24
        height = 6
        properties = {
          title = "Chaos Experiment Logs"
          region = var.region
          query = <<-EOT
            SOURCE '/aws/lambda/${var.service_name}-${var.stage}-chaos-experiment'
            | fields @timestamp, @message
            | filter @message like /CHAOS_EXPERIMENT/
            | sort @timestamp desc
            | limit 20
          EOT
        }
      }
    ]
  })
}

# ========================================
# CloudWatch Alarms - Nivel 1: Warning
# ========================================

resource "aws_cloudwatch_metric_alarm" "availability_warning" {
  for_each = local.slo_targets

  alarm_name          = "${var.service_name}-${var.stage}-${each.key}-availability-warning"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 2
  metric_name         = "Availability"
  namespace           = local.custom_namespace
  period              = 300
  statistic           = "Average"
  threshold           = each.value.availability - 0.05  # 0.05% debajo del SLO
  alarm_description   = "Availability for ${each.key} is below ${each.value.availability - 0.05}%"
  treat_missing_data  = "notBreaching"

  dimensions = {
    Service = title(each.key)
  }

  alarm_actions = [aws_sns_topic.cloudwatch_alarms.arn]
  ok_actions    = [aws_sns_topic.cloudwatch_alarms.arn]

  tags = {
    Environment = var.stage
    Severity    = "warning"
    Service     = each.key
  }
}

resource "aws_cloudwatch_metric_alarm" "latency_p95_warning" {
  for_each = local.slo_targets

  alarm_name          = "${var.service_name}-${var.stage}-${each.key}-latency-p95-warning"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "Duration"
  namespace           = local.lambda_namespace
  period              = 300
  extended_statistic  = "p95"
  threshold           = each.value.latency_p95 * 0.8  # 80% del SLO
  alarm_description   = "P95 latency for ${each.key} is above ${each.value.latency_p95 * 0.8}ms"
  treat_missing_data  = "notBreaching"

  dimensions = {
    FunctionName = "${var.service_name}-${var.stage}-${each.key}"
  }

  alarm_actions = [aws_sns_topic.cloudwatch_alarms.arn]

  tags = {
    Environment = var.stage
    Severity    = "warning"
    Service     = each.key
  }
}

resource "aws_cloudwatch_metric_alarm" "error_rate_warning" {
  for_each = local.slo_targets

  alarm_name          = "${var.service_name}-${var.stage}-${each.key}-error-rate-warning"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "Errors"
  namespace           = local.lambda_namespace
  period              = 300
  statistic           = "Sum"
  threshold           = 10  # 10 errores en 5 minutos
  alarm_description   = "Error rate for ${each.key} is high"
  treat_missing_data  = "notBreaching"

  dimensions = {
    FunctionName = "${var.service_name}-${var.stage}-${each.key}"
  }

  alarm_actions = [aws_sns_topic.cloudwatch_alarms.arn]

  tags = {
    Environment = var.stage
    Severity    = "warning"
    Service     = each.key
  }
}

# ========================================
# CloudWatch Alarms - Nivel 2: Critical
# ========================================

resource "aws_cloudwatch_metric_alarm" "availability_critical" {
  for_each = local.slo_targets

  alarm_name          = "${var.service_name}-${var.stage}-${each.key}-availability-critical"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 1
  metric_name         = "Availability"
  namespace           = local.custom_namespace
  period              = 300
  statistic           = "Average"
  threshold           = 99.0  # Hard threshold
  alarm_description   = "CRITICAL: Availability for ${each.key} is below 99%"
  treat_missing_data  = "breaching"

  dimensions = {
    Service = title(each.key)
  }

  alarm_actions = [aws_sns_topic.critical_alarms.arn]
  ok_actions    = [aws_sns_topic.critical_alarms.arn]

  tags = {
    Environment = var.stage
    Severity    = "critical"
    Service     = each.key
  }
}

resource "aws_cloudwatch_metric_alarm" "latency_p99_critical" {
  for_each = local.slo_targets

  alarm_name          = "${var.service_name}-${var.stage}-${each.key}-latency-p99-critical"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "Duration"
  namespace           = local.lambda_namespace
  period              = 300
  extended_statistic  = "p99"
  threshold           = each.value.latency_p99 * 1.2  # 120% del SLO
  alarm_description   = "CRITICAL: P99 latency for ${each.key} is above ${each.value.latency_p99 * 1.2}ms"
  treat_missing_data  = "notBreaching"

  dimensions = {
    FunctionName = "${var.service_name}-${var.stage}-${each.key}"
  }

  alarm_actions = [aws_sns_topic.critical_alarms.arn]

  tags = {
    Environment = var.stage
    Severity    = "critical"
    Service     = each.key
  }
}

resource "aws_cloudwatch_metric_alarm" "lambda_throttles" {
  alarm_name          = "${var.service_name}-${var.stage}-lambda-throttles"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "Throttles"
  namespace           = local.lambda_namespace
  period              = 60
  statistic           = "Sum"
  threshold           = 100
  alarm_description   = "CRITICAL: Lambda throttling detected (>100 throttles/min)"
  treat_missing_data  = "notBreaching"

  alarm_actions = [aws_sns_topic.critical_alarms.arn]

  tags = {
    Environment = var.stage
    Severity    = "critical"
  }
}

resource "aws_cloudwatch_metric_alarm" "dynamodb_throttles" {
  alarm_name          = "${var.service_name}-${var.stage}-dynamodb-throttles"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "UserErrors"
  namespace           = local.dynamodb_namespace
  period              = 60
  statistic           = "Sum"
  threshold           = 50
  alarm_description   = "CRITICAL: DynamoDB throttling detected"
  treat_missing_data  = "notBreaching"

  alarm_actions = [aws_sns_topic.critical_alarms.arn]

  tags = {
    Environment = var.stage
    Severity    = "critical"
  }
}

# ========================================
# SNS Topics para Alarmas
# ========================================

resource "aws_sns_topic" "cloudwatch_alarms" {
  name = "${var.service_name}-${var.stage}-cloudwatch-alarms"

  tags = {
    Environment = var.stage
    Purpose     = "CloudWatch alarm notifications"
  }
}

resource "aws_sns_topic" "critical_alarms" {
  name = "${var.service_name}-${var.stage}-critical-alarms"

  tags = {
    Environment = var.stage
    Purpose     = "Critical alarm notifications"
  }
}

# Suscripciones (agregar emails manualmente o via variables)
resource "aws_sns_topic_subscription" "alarms_email" {
  count     = var.alarm_email != "" ? 1 : 0
  topic_arn = aws_sns_topic.cloudwatch_alarms.arn
  protocol  = "email"
  endpoint  = var.alarm_email
}

resource "aws_sns_topic_subscription" "critical_email" {
  count     = var.critical_alarm_email != "" ? 1 : 0
  topic_arn = aws_sns_topic.critical_alarms.arn
  protocol  = "email"
  endpoint  = var.critical_alarm_email
}

# ========================================
# Outputs
# ========================================

output "system_health_dashboard_url" {
  description = "URL to the System Health CloudWatch Dashboard"
  value       = "https://console.aws.amazon.com/cloudwatch/home?region=${var.region}#dashboards:name=${local.dashboard_name}"
}

output "chaos_dashboard_url" {
  description = "URL to the Chaos Experiments CloudWatch Dashboard"
  value       = "https://console.aws.amazon.com/cloudwatch/home?region=${var.region}#dashboards:name=${local.chaos_dashboard_name}"
}

output "alarm_topic_arn" {
  description = "ARN of the CloudWatch alarms SNS topic"
  value       = aws_sns_topic.cloudwatch_alarms.arn
}

output "critical_alarm_topic_arn" {
  description = "ARN of the critical alarms SNS topic"
  value       = aws_sns_topic.critical_alarms.arn
}
