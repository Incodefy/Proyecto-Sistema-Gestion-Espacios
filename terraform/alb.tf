# ========================================
# APPLICATION LOAD BALANCER
# ========================================

resource "aws_lb" "main" {
  name               = "${var.project_name}-alb-${var.stage}"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets = [
    aws_subnet.public_az1.id,
    aws_subnet.public_az2.id
  ]

  enable_deletion_protection       = false
  enable_http2                     = true
  enable_cross_zone_load_balancing = true

  tags = {
    Name        = "${var.project_name}-alb-${var.stage}"
    Project     = var.project_name
    Environment = var.stage
  }
}

# ========================================
# TARGET GROUPS para Blue/Green Deployment
# ========================================

# Blue Target Group (Production)
resource "aws_lb_target_group" "app_blue" {
  name     = "${var.project_name}-tg-blue-${var.stage}"
  port     = 3000
  protocol = "HTTP"
  vpc_id   = aws_vpc.main.id

  health_check {
    enabled             = true
    healthy_threshold   = 2
    interval            = 30
    matcher             = "200,302"
    path                = "/health"
    port                = "traffic-port"
    protocol            = "HTTP"
    timeout             = 5
    unhealthy_threshold = 3
  }

  deregistration_delay = 30

  stickiness {
    type            = "lb_cookie"
    cookie_duration = 86400
    enabled         = true
  }

  tags = {
    Name        = "${var.project_name}-tg-blue-${var.stage}"
    Project     = var.project_name
    Environment = var.stage
    Color       = "blue"
  }
}

# Green Target Group (New version for deployment)
resource "aws_lb_target_group" "app_green" {
  name     = "${var.project_name}-tg-green-${var.stage}"
  port     = 3000
  protocol = "HTTP"
  vpc_id   = aws_vpc.main.id

  health_check {
    enabled             = true
    healthy_threshold   = 2
    interval            = 30
    matcher             = "200,302"
    path                = "/health"
    port                = "traffic-port"
    protocol            = "HTTP"
    timeout             = 5
    unhealthy_threshold = 3
  }

  deregistration_delay = 30

  stickiness {
    type            = "lb_cookie"
    cookie_duration = 86400
    enabled         = true
  }

  tags = {
    Name        = "${var.project_name}-tg-green-${var.stage}"
    Project     = var.project_name
    Environment = var.stage
    Color       = "green"
  }
}

# Backwards compatibility alias
resource "aws_lb_target_group" "app" {
  name     = "${var.project_name}-tg-${var.stage}"
  port     = 3000
  protocol = "HTTP"
  vpc_id   = aws_vpc.main.id

  health_check {
    enabled             = true
    healthy_threshold   = 2
    interval            = 30
    matcher             = "200,302"
    path                = "/health"
    port                = "traffic-port"
    protocol            = "HTTP"
    timeout             = 5
    unhealthy_threshold = 3
  }

  deregistration_delay = 30

  stickiness {
    type            = "lb_cookie"
    cookie_duration = 86400
    enabled         = true
  }

  tags = {
    Name        = "${var.project_name}-tg-${var.stage}"
    Project     = var.project_name
    Environment = var.stage
    Color       = "legacy"
  }
}

# ========================================
# LISTENER HTTP con Traffic Weighting (Blue/Green)
# ========================================

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port              = "80"
  protocol          = "HTTP"

  default_action {
    type = "forward"
    
    forward {
      target_group {
        arn    = aws_lb_target_group.app_blue.arn
        weight = 100  # 100% to Blue (production)
      }
      
      target_group {
        arn    = aws_lb_target_group.app_green.arn
        weight = 0    # 0% to Green (staging/new version)
      }
      
      stickiness {
        enabled  = true
        duration = 3600  # 1 hour
      }
    }
  }
}

# ========================================
# LISTENER HTTPS
# ========================================

# Nota: Para usar HTTPS en producción, necesitas un certificado SSL
# Puedes crearlo con AWS Certificate Manager (ACM)
# Por ahora, el listener HTTP funcionará en el puerto 80

# Descomenta esto cuando tengas un certificado ACM:
/*
resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.main.arn
  port              = "443"
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS-1-2-2017-01"
  certificate_arn   = var.acm_certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.app.arn
  }
}
*/
