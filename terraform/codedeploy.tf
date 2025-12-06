# ========================================
# AWS CODEDEPLOY - Blue/Green Deployment
# ========================================

# CodeDeploy Application
resource "aws_codedeploy_app" "main" {
  name             = "${var.project_name}-app-${var.stage}"
  compute_platform = "Server"

  tags = {
    Name        = "${var.project_name}-codedeploy-app-${var.stage}"
    Project     = var.project_name
    Environment = var.stage
  }
}

# IAM Role for CodeDeploy
resource "aws_iam_role" "codedeploy" {
  name = "${var.project_name}-codedeploy-role-${var.stage}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "codedeploy.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name        = "${var.project_name}-codedeploy-role-${var.stage}"
    Project     = var.project_name
    Environment = var.stage
  }
}

# Attach AWS managed policy for CodeDeploy
resource "aws_iam_role_policy_attachment" "codedeploy_policy" {
  role       = aws_iam_role.codedeploy.name
  policy_arn = "arn:aws:iam::aws:policy/AWSCodeDeployRole"
}

# SNS Topic for deployment notifications
resource "aws_sns_topic" "codedeploy_notifications" {
  name = "${var.project_name}-codedeploy-notifications-${var.stage}"

  tags = {
    Name        = "${var.project_name}-codedeploy-notifications-${var.stage}"
    Project     = var.project_name
    Environment = var.stage
  }
}

# ========================================
# Blue/Green Deployment Group
# ========================================

resource "aws_codedeploy_deployment_group" "blue_green" {
  app_name               = aws_codedeploy_app.main.name
  deployment_group_name  = "${var.project_name}-blue-green-${var.stage}"
  service_role_arn       = aws_iam_role.codedeploy.arn
  deployment_config_name = "CodeDeployDefault.AllAtOnce"

  # Blue/Green Deployment Configuration
  blue_green_deployment_config {
    # Terminate blue instances after successful deployment
    terminate_blue_instances_on_deployment_success {
      action                       = "TERMINATE"
      termination_wait_time_in_minutes = 5
    }

    # Automatically route traffic after deployment
    deployment_ready_option {
      action_on_timeout = "CONTINUE_DEPLOYMENT"
    }

    # Provision green fleet by copying ASG
    green_fleet_provisioning_option {
      action = "COPY_AUTO_SCALING_GROUP"
    }
  }

  # Auto Scaling Groups
  auto_scaling_groups = [aws_autoscaling_group.app.name]

  # Load Balancer Configuration
  load_balancer_info {
    target_group_pair_info {
      prod_traffic_route {
        listener_arns = [aws_lb_listener.http.arn]
      }

      target_group {
        name = aws_lb_target_group.app_blue.name
      }

      target_group {
        name = aws_lb_target_group.app_green.name
      }
    }
  }

  # Auto Rollback Configuration
  auto_rollback_configuration {
    enabled = true
    events  = ["DEPLOYMENT_FAILURE", "DEPLOYMENT_STOP_ON_ALARM"]
  }

  # CloudWatch Alarms for automatic rollback
  alarm_configuration {
    enabled = true
    alarms = [
      aws_cloudwatch_metric_alarm.deployment_failure.alarm_name
    ]
  }

  # Deployment notifications
  trigger_configuration {
    trigger_events     = ["DeploymentStart", "DeploymentSuccess", "DeploymentFailure", "DeploymentStop"]
    trigger_name       = "${var.project_name}-deployment-trigger-${var.stage}"
    trigger_target_arn = aws_sns_topic.codedeploy_notifications.arn
  }

  tags = {
    Name        = "${var.project_name}-blue-green-dg-${var.stage}"
    Project     = var.project_name
    Environment = var.stage
  }
}

# ========================================
# Canary Deployment Group (Gradual Traffic Shift)
# ========================================

resource "aws_codedeploy_deployment_group" "canary" {
  app_name               = aws_codedeploy_app.main.name
  deployment_group_name  = "${var.project_name}-canary-${var.stage}"
  service_role_arn       = aws_iam_role.codedeploy.arn
  
  # Canary deployment: 10% every 5 minutes
  deployment_config_name = "CodeDeployDefault.LambdaCanary10Percent5Minutes"

  blue_green_deployment_config {
    terminate_blue_instances_on_deployment_success {
      action                       = "TERMINATE"
      termination_wait_time_in_minutes = 10
    }

    deployment_ready_option {
      action_on_timeout    = "CONTINUE_DEPLOYMENT"
      wait_time_in_minutes = 5
    }

    green_fleet_provisioning_option {
      action = "COPY_AUTO_SCALING_GROUP"
    }
  }

  auto_scaling_groups = [aws_autoscaling_group.app.name]

  load_balancer_info {
    target_group_pair_info {
      prod_traffic_route {
        listener_arns = [aws_lb_listener.http.arn]
      }

      target_group {
        name = aws_lb_target_group.app_blue.name
      }

      target_group {
        name = aws_lb_target_group.app_green.name
      }
    }
  }

  auto_rollback_configuration {
    enabled = true
    events  = ["DEPLOYMENT_FAILURE", "DEPLOYMENT_STOP_ON_ALARM"]
  }

  alarm_configuration {
    enabled = true
    alarms = [
      aws_cloudwatch_metric_alarm.deployment_failure.alarm_name,
      aws_cloudwatch_metric_alarm.high_error_rate.alarm_name
    ]
  }

  trigger_configuration {
    trigger_events     = ["DeploymentStart", "DeploymentSuccess", "DeploymentFailure", "DeploymentStop", "DeploymentRollback"]
    trigger_name       = "${var.project_name}-canary-trigger-${var.stage}"
    trigger_target_arn = aws_sns_topic.codedeploy_notifications.arn
  }

  tags = {
    Name        = "${var.project_name}-canary-dg-${var.stage}"
    Project     = var.project_name
    Environment = var.stage
  }
}

# ========================================
# CloudWatch Alarms for Deployment
# ========================================

# Alarm for deployment failures
resource "aws_cloudwatch_metric_alarm" "deployment_failure" {
  alarm_name          = "${var.project_name}-deployment-failure-${var.stage}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "UnhealthyHostCount"
  namespace           = "AWS/ApplicationELB"
  period              = 60
  statistic           = "Average"
  threshold           = 1
  alarm_description   = "Triggers when unhealthy hosts detected during deployment"
  treat_missing_data  = "notBreaching"

  dimensions = {
    TargetGroup  = aws_lb_target_group.app_green.arn_suffix
    LoadBalancer = aws_lb.main.arn_suffix
  }

  alarm_actions = [aws_sns_topic.codedeploy_notifications.arn]

  tags = {
    Name        = "${var.project_name}-deployment-failure-alarm-${var.stage}"
    Project     = var.project_name
    Environment = var.stage
  }
}

# Alarm for high error rate (5xx errors)
resource "aws_cloudwatch_metric_alarm" "high_error_rate" {
  alarm_name          = "${var.project_name}-high-error-rate-${var.stage}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "HTTPCode_Target_5XX_Count"
  namespace           = "AWS/ApplicationELB"
  period              = 60
  statistic           = "Sum"
  threshold           = 10
  alarm_description   = "Triggers when 5xx errors exceed threshold during deployment"
  treat_missing_data  = "notBreaching"

  dimensions = {
    TargetGroup  = aws_lb_target_group.app_green.arn_suffix
    LoadBalancer = aws_lb.main.arn_suffix
  }

  alarm_actions = [aws_sns_topic.codedeploy_notifications.arn]

  tags = {
    Name        = "${var.project_name}-high-error-rate-alarm-${var.stage}"
    Project     = var.project_name
    Environment = var.stage
  }
}

# Alarm for high response time
resource "aws_cloudwatch_metric_alarm" "high_latency" {
  alarm_name          = "${var.project_name}-high-latency-${var.stage}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "TargetResponseTime"
  namespace           = "AWS/ApplicationELB"
  period              = 60
  statistic           = "Average"
  threshold           = 2.0  # 2 seconds
  alarm_description   = "Triggers when average response time exceeds 2 seconds"
  treat_missing_data  = "notBreaching"

  dimensions = {
    TargetGroup  = aws_lb_target_group.app_green.arn_suffix
    LoadBalancer = aws_lb.main.arn_suffix
  }

  alarm_actions = [aws_sns_topic.codedeploy_notifications.arn]

  tags = {
    Name        = "${var.project_name}-high-latency-alarm-${var.stage}"
    Project     = var.project_name
    Environment = var.stage
  }
}

# ========================================
# S3 Bucket for CodeDeploy Artifacts
# ========================================

resource "aws_s3_bucket" "codedeploy_artifacts" {
  bucket = "${var.project_name}-codedeploy-artifacts-${var.stage}"

  tags = {
    Name        = "${var.project_name}-codedeploy-artifacts-${var.stage}"
    Project     = var.project_name
    Environment = var.stage
  }
}

resource "aws_s3_bucket_versioning" "codedeploy_artifacts" {
  bucket = aws_s3_bucket.codedeploy_artifacts.id
  
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "codedeploy_artifacts" {
  bucket = aws_s3_bucket.codedeploy_artifacts.id

  rule {
    id     = "delete-old-versions"
    status = "Enabled"

    noncurrent_version_expiration {
      noncurrent_days = 30
    }
  }
}

resource "aws_s3_bucket_public_access_block" "codedeploy_artifacts" {
  bucket = aws_s3_bucket.codedeploy_artifacts.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}
