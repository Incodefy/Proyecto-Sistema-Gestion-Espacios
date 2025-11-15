variable "region" {
  type    = string
  default = "us-east-1"
}

variable "stage" {
  type    = string
  default = "dev"
}

variable "service_name" {
  description = "Service name prefix for resources"
  type        = string
  default     = "hospital-backend"
}

variable "project_name" {
  description = "Project name for tagging"
  type        = string
  default     = "HospitalPadreHurtado"
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
