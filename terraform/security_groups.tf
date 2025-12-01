# ========================================
# SECURITY GROUPS
# ========================================

# Security Group para ALB (Load Balancer)
resource "aws_security_group" "alb" {
  name        = "${var.project_name}-alb-sg-${var.stage}"
  description = "Security group para Application Load Balancer"
  vpc_id      = aws_vpc.main.id

  # Inbound Rules
  ingress {
    description = "HTTP desde Internet"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTPS desde Internet"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Outbound Rules
  egress {
    description = "All outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "${var.project_name}-alb-sg-${var.stage}"
    Project     = var.project_name
    Environment = var.stage
    Resource    = "ALB"
  }
}

# Security Group para instancias EC2
resource "aws_security_group" "ec2_app" {
  name        = "${var.project_name}-ec2-app-sg-${var.stage}"
  description = "Security group for EC2 application instances"
  vpc_id      = aws_vpc.main.id

  # Inbound Rules
  ingress {
    description     = "HTTP desde ALB"
    from_port       = 3000
    to_port         = 3000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  ingress {
    description = "SSH desde IPs administrativas"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = var.admin_ssh_cidrs
  }

  # Outbound Rules
  egress {
    description = "All outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "${var.project_name}-ec2-app-sg-${var.stage}"
    Project     = var.project_name
    Environment = var.stage
    Resource    = "EC2"
  }
}

# Security Group para Lambda Functions
resource "aws_security_group" "lambda" {
  name        = "${var.project_name}-lambda-sg-${var.stage}"
  description = "Security group para Lambda functions"
  vpc_id      = aws_vpc.main.id

  # Outbound Rules (Lambda necesita acceder a DynamoDB y otros servicios)
  egress {
    description = "HTTPS para servicios AWS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description = "HTTP para servicios internos"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "${var.project_name}-lambda-sg-${var.stage}"
    Project     = var.project_name
    Environment = var.stage
    Resource    = "Lambda"
  }
}



# Security Group para VPC Endpoints (opcional, para mayor seguridad)
resource "aws_security_group" "vpc_endpoints" {
  name        = "${var.project_name}-vpc-endpoints-sg-${var.stage}"
  description = "Security group para VPC Endpoints"
  vpc_id      = aws_vpc.main.id

  # Inbound Rules
  ingress {
    description = "HTTPS desde VPC"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
  }

  # Outbound Rules
  egress {
    description = "All outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "${var.project_name}-vpc-endpoints-sg-${var.stage}"
    Project     = var.project_name
    Environment = var.stage
    Resource    = "VPC-Endpoints"
  }
}
