terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  required_version = ">= 1.6.0"
}

provider "aws" {
  region = var.region
}

# Bucket para almacenar el código Lambda empaquetado (si no existe)
resource "aws_s3_bucket" "lambda_bucket" {
  bucket_prefix = "hpp-chaos-bucket-"
  force_destroy = true
}

# Rol IAM para Lambda
resource "aws_iam_role" "lambda_exec_role" {
  name = "hpp-chaos-engine-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Action = "sts:AssumeRole",
        Effect = "Allow",
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

# Permisos básicos
resource "aws_iam_role_policy_attachment" "lambda_basic_execution" {
  role       = aws_iam_role.lambda_exec_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy_attachment" "dynamodb_access" {
  role       = aws_iam_role.lambda_exec_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonDynamoDBFullAccess"
}

# Incluye DynamoDB y Lambda
module "dynamodb" {
  source = "./dynamodb.tf"
}

module "chaos_engine" {
  source = "./chaos_engine.tf"
}
