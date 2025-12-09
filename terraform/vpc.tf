# ========================================
# VPC PERSONALIZADA - Incodefy
# ========================================

resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name        = "${var.project_name}-vpc-${var.stage}"
    Project     = var.project_name
    Environment = var.stage
    ManagedBy   = "Terraform"
  }
}

# ========================================
# INTERNET GATEWAY
# ========================================

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name        = "${var.project_name}-igw-${var.stage}"
    Project     = var.project_name
    Environment = var.stage
  }
}

# ========================================
# ELASTIC IPs PARA NAT GATEWAYS
# ========================================

resource "aws_eip" "nat_az1" {
  domain     = "vpc"
  depends_on = [aws_internet_gateway.main]

  tags = {
    Name        = "${var.project_name}-nat-eip-az1-${var.stage}"
    Project     = var.project_name
    Environment = var.stage
    AZ          = var.availability_zones[0]
  }
}

resource "aws_eip" "nat_az2" {
  domain     = "vpc"
  depends_on = [aws_internet_gateway.main]

  tags = {
    Name        = "${var.project_name}-nat-eip-az2-${var.stage}"
    Project     = var.project_name
    Environment = var.stage
    AZ          = var.availability_zones[1]
  }
}

# ========================================
# NAT GATEWAYS (uno por AZ para alta disponibilidad)
# ========================================

resource "aws_nat_gateway" "az1" {
  allocation_id = aws_eip.nat_az1.id
  subnet_id     = aws_subnet.public_az1.id

  tags = {
    Name        = "${var.project_name}-nat-az1-${var.stage}"
    Project     = var.project_name
    Environment = var.stage
    AZ          = var.availability_zones[0]
  }

  depends_on = [aws_internet_gateway.main]
}

resource "aws_nat_gateway" "az2" {
  allocation_id = aws_eip.nat_az2.id
  subnet_id     = aws_subnet.public_az2.id

  tags = {
    Name        = "${var.project_name}-nat-az2-${var.stage}"
    Project     = var.project_name
    Environment = var.stage
    AZ          = var.availability_zones[1]
  }

  depends_on = [aws_internet_gateway.main]
}

# ========================================
# SUBREDES PÚBLICAS (2 AZs para redundancia)
# ========================================

resource "aws_subnet" "public_az1" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.1.0/24"
  availability_zone       = var.availability_zones[0]
  map_public_ip_on_launch = true

  tags = {
    Name        = "${var.project_name}-public-subnet-az1-${var.stage}"
    Type        = "Public"
    Project     = var.project_name
    Environment = var.stage
    AZ          = var.availability_zones[0]
  }
}

resource "aws_subnet" "public_az2" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.2.0/24"
  availability_zone       = var.availability_zones[1]
  map_public_ip_on_launch = true

  tags = {
    Name        = "${var.project_name}-public-subnet-az2-${var.stage}"
    Type        = "Public"
    Project     = var.project_name
    Environment = var.stage
    AZ          = var.availability_zones[1]
  }
}

# ========================================
# SUBREDES PRIVADAS (2 AZs para redundancia)
# ========================================

resource "aws_subnet" "private_az1" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.11.0/24"
  availability_zone = var.availability_zones[0]

  tags = {
    Name        = "${var.project_name}-private-subnet-az1-${var.stage}"
    Type        = "Private"
    Project     = var.project_name
    Environment = var.stage
    AZ          = var.availability_zones[0]
  }
}

resource "aws_subnet" "private_az2" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.12.0/24"
  availability_zone = var.availability_zones[1]

  tags = {
    Name        = "${var.project_name}-private-subnet-az2-${var.stage}"
    Type        = "Private"
    Project     = var.project_name
    Environment = var.stage
    AZ          = var.availability_zones[1]
  }
}

# ========================================
# TABLAS DE RUTAS - SUBRED PÚBLICA
# ========================================

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = {
    Name        = "${var.project_name}-public-rt-${var.stage}"
    Type        = "Public"
    Project     = var.project_name
    Environment = var.stage
  }
}

resource "aws_route_table_association" "public_az1" {
  subnet_id      = aws_subnet.public_az1.id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table_association" "public_az2" {
  subnet_id      = aws_subnet.public_az2.id
  route_table_id = aws_route_table.public.id
}

# ========================================
# TABLAS DE RUTAS - SUBREDES PRIVADAS (una por AZ)
# ========================================

resource "aws_route_table" "private_az1" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.az1.id
  }

  tags = {
    Name        = "${var.project_name}-private-rt-az1-${var.stage}"
    Type        = "Private"
    Project     = var.project_name
    Environment = var.stage
    AZ          = var.availability_zones[0]
  }
}

resource "aws_route_table" "private_az2" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.az2.id
  }

  tags = {
    Name        = "${var.project_name}-private-rt-az2-${var.stage}"
    Type        = "Private"
    Project     = var.project_name
    Environment = var.stage
    AZ          = var.availability_zones[1]
  }
}

resource "aws_route_table_association" "private_az1" {
  subnet_id      = aws_subnet.private_az1.id
  route_table_id = aws_route_table.private_az1.id
}

resource "aws_route_table_association" "private_az2" {
  subnet_id      = aws_subnet.private_az2.id
  route_table_id = aws_route_table.private_az2.id
}

# ========================================
# VPC FLOW LOGS
# ========================================

# CloudWatch Log Group para VPC Flow Logs
resource "aws_cloudwatch_log_group" "vpc_flow_logs" {
  name              = "/aws/vpc/${var.project_name}-${var.stage}"
  retention_in_days = 7

  tags = {
    Name        = "${var.project_name}-vpc-flow-logs-${var.stage}"
    Project     = var.project_name
    Environment = var.stage
  }
}

# IAM Role para VPC Flow Logs
resource "aws_iam_role" "vpc_flow_logs" {
  name = "${var.project_name}-vpc-flow-logs-role-${var.stage}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "vpc-flow-logs.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name        = "${var.project_name}-vpc-flow-logs-role-${var.stage}"
    Project     = var.project_name
    Environment = var.stage
  }
}

resource "aws_iam_role_policy" "vpc_flow_logs" {
  name = "${var.project_name}-vpc-flow-logs-policy-${var.stage}"
  role = aws_iam_role.vpc_flow_logs.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
          "logs:DescribeLogGroups",
          "logs:DescribeLogStreams"
        ]
        Effect   = "Allow"
        Resource = "*"
      }
    ]
  })
}

# VPC Flow Logs
resource "aws_flow_log" "main" {
  iam_role_arn    = aws_iam_role.vpc_flow_logs.arn
  log_destination = aws_cloudwatch_log_group.vpc_flow_logs.arn
  traffic_type    = "ALL"
  vpc_id          = aws_vpc.main.id

  tags = {
    Name        = "${var.project_name}-vpc-flow-log-${var.stage}"
    Project     = var.project_name
    Environment = var.stage
  }
}
