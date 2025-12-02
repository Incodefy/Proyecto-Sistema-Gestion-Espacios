# ========================================
# IAM INSTANCE PROFILE para EC2
# ========================================

resource "aws_iam_role" "ec2_app" {
  name = "${var.project_name}-ec2-app-role-${var.stage}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name        = "${var.project_name}-ec2-app-role-${var.stage}"
    Project     = var.project_name
    Environment = var.stage
  }
}

# Política para que EC2 pueda escribir logs en CloudWatch
resource "aws_iam_role_policy" "ec2_cloudwatch_logs" {
  name = "${var.project_name}-ec2-cloudwatch-logs-${var.stage}"
  role = aws_iam_role.ec2_app.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
          "logs:DescribeLogStreams"
        ]
        Effect   = "Allow"
        Resource = "arn:aws:logs:${var.region}:*:log-group:/aws/ec2/${var.project_name}/*"
      }
    ]
  })
}

# Política para acceso a Parameter Store
resource "aws_iam_role_policy" "ec2_parameter_store" {
  name = "${var.project_name}-ec2-parameter-store-${var.stage}"
  role = aws_iam_role.ec2_app.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = [
          "ssm:GetParameter",
          "ssm:GetParameters",
          "ssm:GetParametersByPath"
        ]
        Effect   = "Allow"
        Resource = "arn:aws:ssm:${var.region}:*:parameter/${var.project_name}/${var.stage}/*"
      },
      {
        Action   = ["kms:Decrypt"]
        Effect   = "Allow"
        Resource = "*"
      }
    ]
  })
}

# Política básica de EC2
resource "aws_iam_role_policy_attachment" "ec2_ssm" {
  role       = aws_iam_role.ec2_app.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

# Instance Profile
resource "aws_iam_instance_profile" "ec2_app" {
  name = "${var.project_name}-ec2-app-profile-${var.stage}"
  role = aws_iam_role.ec2_app.name

  tags = {
    Name        = "${var.project_name}-ec2-app-profile-${var.stage}"
    Project     = var.project_name
    Environment = var.stage
  }
}

# ========================================
# LAUNCH TEMPLATE
# ========================================

resource "aws_launch_template" "app" {
  name_prefix   = "${var.project_name}-lt-${var.stage}-"
  image_id      = var.ec2_ami_id
  instance_type = var.ec2_instance_type

  vpc_security_group_ids = [aws_security_group.ec2_app.id]

  iam_instance_profile {
    name = aws_iam_instance_profile.ec2_app.name
  }

  user_data = base64encode(templatefile("${path.module}/user-data.sh.tpl", {
    project_name     = var.project_name
    stage            = var.stage
    region           = var.region
    session_secret   = var.session_secret
    user_pool_id     = var.user_pool_id
    user_pool_client = var.user_pool_client_id
    api_base_url     = var.api_base_url
    alb_dns_name     = aws_lb.main.dns_name
  }))

  monitoring {
    enabled = true
  }

  tag_specifications {
    resource_type = "instance"

    tags = {
      Name        = "${var.project_name}-app-${var.stage}"
      Project     = var.project_name
      Environment = var.stage
    }
  }

  tag_specifications {
    resource_type = "volume"

    tags = {
      Name        = "${var.project_name}-app-volume-${var.stage}"
      Project     = var.project_name
      Environment = var.stage
    }
  }
}

# ========================================
# AUTO SCALING GROUP
# ========================================

resource "aws_autoscaling_group" "app" {
  name = "${var.project_name}-asg-${var.stage}"
  vpc_zone_identifier = [
    aws_subnet.private_az1.id,
    aws_subnet.private_az2.id
  ]
  target_group_arns         = [aws_lb_target_group.app.arn]
  health_check_type         = "ELB"
  health_check_grace_period = 600  # 10 minutos para dar tiempo a npm install
  default_instance_warmup   = 600  # 10 minutos de warmup

  min_size         = var.asg_min_size
  max_size         = var.asg_max_size
  desired_capacity = var.asg_desired_capacity

  launch_template {
    id      = aws_launch_template.app.id
    version = "$Latest"
  }

  enabled_metrics = [
    "GroupDesiredCapacity",
    "GroupInServiceInstances",
    "GroupMaxSize",
    "GroupMinSize",
    "GroupPendingInstances",
    "GroupStandbyInstances",
    "GroupTerminatingInstances",
    "GroupTotalInstances"
  ]

  tag {
    key                 = "Name"
    value               = "${var.project_name}-asg-instance-${var.stage}"
    propagate_at_launch = true
  }

  tag {
    key                 = "Project"
    value               = var.project_name
    propagate_at_launch = true
  }

  tag {
    key                 = "Environment"
    value               = var.stage
    propagate_at_launch = true
  }

  lifecycle {
    create_before_destroy = true
  }
}

# ========================================
# AUTO SCALING POLICIES
# ========================================

# Scale Up Policy (basado en CPU)
resource "aws_autoscaling_policy" "scale_up" {
  name                   = "${var.project_name}-scale-up-${var.stage}"
  scaling_adjustment     = 1
  adjustment_type        = "ChangeInCapacity"
  cooldown               = 300
  autoscaling_group_name = aws_autoscaling_group.app.name
}

# Scale Down Policy
resource "aws_autoscaling_policy" "scale_down" {
  name                   = "${var.project_name}-scale-down-${var.stage}"
  scaling_adjustment     = -1
  adjustment_type        = "ChangeInCapacity"
  cooldown               = 300
  autoscaling_group_name = aws_autoscaling_group.app.name
}

# Target Tracking Scaling Policy (recomendado)
resource "aws_autoscaling_policy" "target_tracking" {
  name                   = "${var.project_name}-target-tracking-${var.stage}"
  autoscaling_group_name = aws_autoscaling_group.app.name
  policy_type            = "TargetTrackingScaling"

  target_tracking_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ASGAverageCPUUtilization"
    }
    target_value = 70.0
  }
}

# ========================================
# CLOUDWATCH ALARMS
# ========================================

# Alarm - High CPU (scale up)
resource "aws_cloudwatch_metric_alarm" "high_cpu" {
  alarm_name          = "${var.project_name}-high-cpu-${var.stage}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/EC2"
  period              = "120"
  statistic           = "Average"
  threshold           = "70"

  dimensions = {
    AutoScalingGroupName = aws_autoscaling_group.app.name
  }

  alarm_description = "This metric monitors EC2 CPU utilization"
  alarm_actions     = [aws_autoscaling_policy.scale_up.arn]

  tags = {
    Name        = "${var.project_name}-high-cpu-alarm-${var.stage}"
    Project     = var.project_name
    Environment = var.stage
  }
}

# Alarm - Low CPU (scale down)
resource "aws_cloudwatch_metric_alarm" "low_cpu" {
  alarm_name          = "${var.project_name}-low-cpu-${var.stage}"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/EC2"
  period              = "120"
  statistic           = "Average"
  threshold           = "20"

  dimensions = {
    AutoScalingGroupName = aws_autoscaling_group.app.name
  }

  alarm_description = "This metric monitors EC2 CPU utilization for scaling down"
  alarm_actions     = [aws_autoscaling_policy.scale_down.arn]

  tags = {
    Name        = "${var.project_name}-low-cpu-alarm-${var.stage}"
    Project     = var.project_name
    Environment = var.stage
  }
}
