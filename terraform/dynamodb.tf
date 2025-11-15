# ===================================================================
# TABLAS DYNAMODB - DOMINIO
# ===================================================================

# Tabla de Parámetros de configuración del sistema
resource "aws_dynamodb_table" "hpp_parameters" {
  name         = "${var.service_name}-${var.stage}-parameters"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "user_sub"
  range_key    = "parameter_key"

  attribute {
    name = "user_sub"
    type = "S"
  }

  attribute {
    name = "parameter_key"
    type = "S"
  }

  tags = {
    Environment = var.stage
    Project     = "HospitalPadreHurtado"
    ManagedBy   = "Terraform"
  }
}

# Tabla de Activity Logs
resource "aws_dynamodb_table" "activity_logs" {
  name         = "${var.service_name}-${var.stage}-activity-logs"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "user_sub"
  range_key    = "timestamp"

  attribute {
    name = "user_sub"
    type = "S"
  }

  attribute {
    name = "timestamp"
    type = "N"
  }

  attribute {
    name = "action_type"
    type = "S"
  }

  global_secondary_index {
    name            = "ActionTypeIndex"
    hash_key        = "action_type"
    range_key       = "timestamp"
    projection_type = "ALL"
  }

  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  tags = {
    Environment = var.stage
    Project     = "HospitalPadreHurtado"
    ManagedBy   = "Terraform"
  }
}

# Tabla de Roles y Permisos
resource "aws_dynamodb_table" "user_roles" {
  name         = "${var.service_name}-${var.stage}-user-roles"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "user_sub"
  range_key    = "role_name"

  attribute {
    name = "user_sub"
    type = "S"
  }

  attribute {
    name = "role_name"
    type = "S"
  }

  attribute {
    name = "role_type"
    type = "S"
  }

  global_secondary_index {
    name            = "RoleTypeIndex"
    hash_key        = "role_type"
    range_key       = "user_sub"
    projection_type = "ALL"
  }

  tags = {
    Environment = var.stage
    Project     = "HospitalPadreHurtado"
    ManagedBy   = "Terraform"
  }
}

# Tabla de Permisos
resource "aws_dynamodb_table" "permissions" {
  name         = "${var.service_name}-${var.stage}-permissions"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "permission_id"

  attribute {
    name = "permission_id"
    type = "S"
  }

  attribute {
    name = "category"
    type = "S"
  }

  global_secondary_index {
    name            = "CategoryIndex"
    hash_key        = "category"
    projection_type = "ALL"
  }

  tags = {
    Environment = var.stage
    Project     = "HospitalPadreHurtado"
    ManagedBy   = "Terraform"
  }
}

# Tabla de Agenda
resource "aws_dynamodb_table" "agenda" {
  name         = "${var.service_name}-${var.stage}-agenda"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "PK"
  range_key    = "SK"

  attribute {
    name = "PK"
    type = "S"
  }

  attribute {
    name = "SK"
    type = "S"
  }

  attribute {
    name = "GSI1PK"
    type = "S"
  }

  attribute {
    name = "GSI1SK"
    type = "S"
  }

  attribute {
    name = "GSI2PK"
    type = "S"
  }

  attribute {
    name = "GSI2SK"
    type = "S"
  }

  global_secondary_index {
    name            = "MedicoFechaIndex"
    hash_key        = "GSI1PK"
    range_key       = "GSI1SK"
    projection_type = "ALL"
  }

  global_secondary_index {
    name            = "FechaIndex"
    hash_key        = "GSI2PK"
    range_key       = "GSI2SK"
    projection_type = "ALL"
  }

  tags = {
    Environment = var.stage
    Project     = "HospitalPadreHurtado"
    ManagedBy   = "Terraform"
  }
}

# Tabla de Catálogo (Médicos, Especialidades, Boxes, Pasillos)
resource "aws_dynamodb_table" "catalogo" {
  name         = "${var.service_name}-${var.stage}-catalogo"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "PK"
  range_key    = "SK"

  attribute {
    name = "PK"
    type = "S"
  }

  attribute {
    name = "SK"
    type = "S"
  }

  attribute {
    name = "GSI1PK"
    type = "S"
  }

  attribute {
    name = "GSI1SK"
    type = "S"
  }

  global_secondary_index {
    name            = "TipoEntidadIndex"
    hash_key        = "GSI1PK"
    range_key       = "GSI1SK"
    projection_type = "ALL"
  }

  tags = {
    Environment = var.stage
    Project     = "HospitalPadreHurtado"
    ManagedBy   = "Terraform"
  }
}

# Tabla de relación Box-Instrumento
resource "aws_dynamodb_table" "box_instrumento" {
  name         = "${var.service_name}-${var.stage}-box-instrumento"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "PK"
  range_key    = "SK"

  attribute {
    name = "PK"
    type = "S"
  }

  attribute {
    name = "SK"
    type = "S"
  }

  attribute {
    name = "GSI1PK"
    type = "S"
  }

  attribute {
    name = "GSI1SK"
    type = "S"
  }

  global_secondary_index {
    name            = "InstrumentoBoxIndex"
    hash_key        = "GSI1PK"
    range_key       = "GSI1SK"
    projection_type = "ALL"
  }

  tags = {
    Environment = var.stage
    Project     = "HospitalPadreHurtado"
    ManagedBy   = "Terraform"
  }
}

# Tabla de Notificaciones
resource "aws_dynamodb_table" "notificaciones" {
  name         = "${var.service_name}-${var.stage}-notificaciones"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "PK"
  range_key    = "SK"

  attribute {
    name = "PK"
    type = "S"
  }

  attribute {
    name = "SK"
    type = "S"
  }

  attribute {
    name = "GSI1PK"
    type = "S"
  }

  attribute {
    name = "GSI1SK"
    type = "S"
  }

  global_secondary_index {
    name            = "FechaIndex"
    hash_key        = "GSI1PK"
    range_key       = "GSI1SK"
    projection_type = "ALL"
  }

  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  tags = {
    Environment = var.stage
    Project     = "HospitalPadreHurtado"
    ManagedBy   = "Terraform"
  }
}

# Tabla de Mensajes Procesados (Idempotencia)
resource "aws_dynamodb_table" "processed_messages" {
  name         = "${var.service_name}-${var.stage}-processed-messages"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "message_id"

  attribute {
    name = "message_id"
    type = "S"
  }

  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  tags = {
    Environment = var.stage
    Project     = "HospitalPadreHurtado"
    ManagedBy   = "Terraform"
  }
}
