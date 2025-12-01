# ========================================
# AWS WAF v2 - Web Application Firewall
# ========================================

resource "aws_wafv2_web_acl" "main" {
  count = var.enable_waf ? 1 : 0

  name  = "${var.project_name}-waf-${var.stage}"
  scope = "REGIONAL"

  default_action {
    allow {}
  }

  # ========================================
  # Regla 1: Rate Limiting (prevenir DDoS)
  # ========================================

  rule {
    name     = "RateLimitRule"
    priority = 1

    action {
      block {
        custom_response {
          response_code = 429
        }
      }
    }

    statement {
      rate_based_statement {
        limit              = 2000
        aggregate_key_type = "IP"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "RateLimitRule"
      sampled_requests_enabled   = true
    }
  }

  # ========================================
  # Regla 2: AWS Managed Rules - Core Rule Set
  # ========================================

  rule {
    name     = "AWSManagedRulesCommonRuleSet"
    priority = 2

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesCommonRuleSet"
        vendor_name = "AWS"

        # Excluir reglas específicas si causan falsos positivos
        # excluded_rule {
        #   name = "SizeRestrictions_BODY"
        # }
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "AWSManagedRulesCommonRuleSetMetric"
      sampled_requests_enabled   = true
    }
  }

  # ========================================
  # Regla 3: SQL Injection Protection
  # ========================================

  rule {
    name     = "SQLInjectionProtection"
    priority = 3

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesSQLiRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "SQLInjectionProtectionMetric"
      sampled_requests_enabled   = true
    }
  }

  # ========================================
  # Regla 4: XSS Protection
  # ========================================

  rule {
    name     = "XSSProtection"
    priority = 4

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesKnownBadInputsRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "XSSProtectionMetric"
      sampled_requests_enabled   = true
    }
  }

  # ========================================
  # Regla 5: Geo-blocking (opcional)
  # ========================================

  rule {
    name     = "GeoBlockingRule"
    priority = 5

    action {
      block {
        custom_response {
          response_code = 403
        }
      }
    }

    statement {
      not_statement {
        statement {
          geo_match_statement {
            country_codes = ["CL", "US", "BR", "AR", "PE", "CO"] # Países permitidos
          }
        }
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "GeoBlockingMetric"
      sampled_requests_enabled   = true
    }
  }

  # ========================================
  # Regla 6: IP Reputation List (Managed)
  # ========================================

  rule {
    name     = "IPReputationList"
    priority = 6

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesAmazonIpReputationList"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "IPReputationListMetric"
      sampled_requests_enabled   = true
    }
  }

  # ========================================
  # Regla 7: Bot Control (opcional)
  # ========================================

  rule {
    name     = "BotControlRule"
    priority = 7

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesBotControlRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "BotControlMetric"
      sampled_requests_enabled   = true
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "${var.project_name}-waf-${var.stage}"
    sampled_requests_enabled   = true
  }

  tags = {
    Name        = "${var.project_name}-waf-${var.stage}"
    Project     = var.project_name
    Environment = var.stage
  }
}

# ========================================
# ASOCIAR WAF CON ALB
# ========================================

resource "aws_wafv2_web_acl_association" "alb" {
  count = var.enable_waf ? 1 : 0

  resource_arn = aws_lb.main.arn
  web_acl_arn  = aws_wafv2_web_acl.main[0].arn
}

# ========================================
# CLOUDWATCH LOG GROUP PARA WAF
# ========================================

resource "aws_cloudwatch_log_group" "waf_logs" {
  count = var.enable_waf ? 1 : 0

  name              = "/aws/waf/${var.project_name}-${var.stage}"
  retention_in_days = 7

  tags = {
    Name        = "${var.project_name}-waf-logs-${var.stage}"
    Project     = var.project_name
    Environment = var.stage
  }
}

# ========================================
# LOGGING CONFIGURATION PARA WAF
# ========================================

resource "aws_wafv2_web_acl_logging_configuration" "main" {
  count = var.enable_waf ? 1 : 0

  resource_arn            = aws_wafv2_web_acl.main[0].arn
  log_destination_configs = [aws_cloudwatch_log_group.waf_logs[0].arn]

  redacted_fields {
    single_header {
      name = "authorization"
    }
  }

  redacted_fields {
    single_header {
      name = "cookie"
    }
  }
}

# ========================================
# CLOUDWATCH ALARM - WAF Blocked Requests
# ========================================

resource "aws_cloudwatch_metric_alarm" "waf_blocked_requests" {
  count = var.enable_waf ? 1 : 0

  alarm_name          = "${var.project_name}-waf-blocked-requests-${var.stage}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "BlockedRequests"
  namespace           = "AWS/WAFV2"
  period              = "300"
  statistic           = "Sum"
  threshold           = "100"

  dimensions = {
    Rule   = "ALL"
    WebACL = aws_wafv2_web_acl.main[0].name
    Region = var.region
  }

  alarm_description = "WAF blocked too many requests - possible attack"
  alarm_actions     = var.security_alert_email != "" ? [aws_sns_topic.security_alerts[0].arn] : []

  tags = {
    Name        = "${var.project_name}-waf-blocked-${var.stage}"
    Project     = var.project_name
    Environment = var.stage
  }
}
