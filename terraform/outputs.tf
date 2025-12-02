# output "lambda_function_name" {
#   value = aws_lambda_function.chaos_engine.function_name
# }

# output "api_endpoint" {
#   value = aws_apigatewayv2_api.chaos_api.api_endpoint
# }

# ========================================
# NETWORK OUTPUTS
# ========================================

output "vpc_id" {
  description = "ID de la VPC"
  value       = aws_vpc.main.id
}

output "vpc_cidr" {
  description = "CIDR block de la VPC"
  value       = aws_vpc.main.cidr_block
}

output "public_subnet_ids" {
  description = "IDs de las subredes públicas"
  value       = [aws_subnet.public_az1.id, aws_subnet.public_az2.id]
}

output "private_subnet_ids" {
  description = "IDs de las subredes privadas"
  value       = [aws_subnet.private_az1.id, aws_subnet.private_az2.id]
}

output "nat_gateway_ip" {
  description = "Elastic IP del NAT Gateway"
  value       = aws_eip.nat.public_ip
}

# ========================================
# LOAD BALANCER OUTPUTS
# ========================================

output "alb_dns_name" {
  description = "DNS name del Application Load Balancer"
  value       = aws_lb.main.dns_name
}

output "alb_arn" {
  description = "ARN del Application Load Balancer"
  value       = aws_lb.main.arn
}

output "alb_zone_id" {
  description = "Zone ID del Application Load Balancer (para Route53)"
  value       = aws_lb.main.zone_id
}

output "target_group_arn" {
  description = "ARN del Target Group"
  value       = aws_lb_target_group.app.arn
}

# ========================================
# AUTO SCALING OUTPUTS
# ========================================

output "autoscaling_group_name" {
  description = "Nombre del Auto Scaling Group"
  value       = aws_autoscaling_group.app.name
}

output "autoscaling_group_arn" {
  description = "ARN del Auto Scaling Group"
  value       = aws_autoscaling_group.app.arn
}

output "launch_template_id" {
  description = "ID del Launch Template"
  value       = aws_launch_template.app.id
}

# ========================================
# SECURITY OUTPUTS
# ========================================

output "alb_security_group_id" {
  description = "ID del Security Group del ALB"
  value       = aws_security_group.alb.id
}

output "ec2_security_group_id" {
  description = "ID del Security Group de EC2"
  value       = aws_security_group.ec2_app.id
}



output "lambda_security_group_id" {
  description = "ID del Security Group de Lambda"
  value       = aws_security_group.lambda.id
}

# ========================================
# APPLICATION URL
# ========================================

output "application_url" {
  description = "URL de la aplicación (via ALB)"
  value       = "http://${aws_lb.main.dns_name}"
}

output "health_check_url" {
  description = "URL del health check"
  value       = "http://${aws_lb.main.dns_name}/health"
}
