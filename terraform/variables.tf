variable "region" {
  type    = string
  default = "us-east-1"
}

variable "stage" {
  type    = string
  default = "dev"
}

variable "service_name" {
  description = "Service name prefix for chaos engineering resources"
  type        = string
  default     = "feli"
}

variable "project_name" {
  description = "Project name for tagging"
  type        = string
  default     = "Incodefy"
}

variable "alarm_email" {
  description = "Email address for CloudWatch alarm notifications (warning level)"
  type        = string
  default     = ""
}

variable "critical_alarm_email" {
  description = "Email address for critical alarm notifications"
  type        = string
  default     = ""
}

variable "gremlin_enabled" {
  description = "Enable Gremlin Chaos Engineering resources"
  type        = bool
  default     = false
}

variable "gremlin_team_id" {
  description = "Gremlin Team ID"
  type        = string
  default     = ""
  sensitive   = true
}

variable "gremlin_api_key" {
  description = "Gremlin API Key"
  type        = string
  default     = ""
  sensitive   = true
}

variable "gremlin_scheduled_experiments" {
  description = "Enable scheduled chaos experiments"
  type        = bool
  default     = false
}

# ========================================
# NETWORK VARIABLES
# ========================================

variable "vpc_cidr" {
  description = "CIDR block para la VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "availability_zones" {
  description = "Zonas de disponibilidad para redundancia"
  type        = list(string)
  default     = ["us-east-1a", "us-east-1b"]
}

variable "admin_ssh_cidrs" {
  description = "CIDRs permitidos para acceso SSH administrativo"
  type        = list(string)
  default     = ["0.0.0.0/0"] # Cambiar en producción a IPs específicas
  sensitive   = true
}

# ========================================
# EC2 & AUTO SCALING VARIABLES
# ========================================

variable "ec2_ami_id" {
  description = "AMI ID para instancias EC2 (Ubuntu 22.04 LTS recomendado)"
  type        = string
  default     = "ami-0c7217cdde317cfec" # Ubuntu 22.04 LTS en us-east-1
}

variable "ec2_instance_type" {
  description = "Tipo de instancia EC2"
  type        = string
  default     = "t3.micro"
}

variable "asg_min_size" {
  description = "Número mínimo de instancias en Auto Scaling Group"
  type        = number
  default     = 2
}

variable "asg_max_size" {
  description = "Número máximo de instancias en Auto Scaling Group"
  type        = number
  default     = 6
}

variable "asg_desired_capacity" {
  description = "Capacidad deseada de instancias en Auto Scaling Group"
  type        = number
  default     = 2
}



# ========================================
# APPLICATION VARIABLES
# ========================================

variable "session_secret" {
  description = "Session secret para Express.js"
  type        = string
  sensitive   = true
  default     = "" # Definir en terraform.tfvars
}

variable "user_pool_id" {
  description = "Cognito User Pool ID"
  type        = string
  default     = ""
}

variable "user_pool_client_id" {
  description = "Cognito User Pool Client ID"
  type        = string
  default     = ""
}

variable "api_base_url" {
  description = "URL base de la API Lambda"
  type        = string
  default     = ""
}

variable "git_branch" {
  description = "Branch de GitHub a clonar en las instancias EC2"
  type        = string
  default     = "felipe-5"
}

# ========================================
# SECURITY VARIABLES
# ========================================

variable "enable_waf" {
  description = "Habilitar AWS WAF"
  type        = bool
  default     = false
}

variable "enable_guardduty" {
  description = "Habilitar AWS GuardDuty"
  type        = bool
  default     = false
}

variable "security_alert_email" {
  description = "Email para alertas de seguridad"
  type        = string
  default     = ""
}
