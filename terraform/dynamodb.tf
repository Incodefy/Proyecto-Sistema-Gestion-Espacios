# Tabla DynamoDB para configuración del sistema
resource "aws_dynamodb_table" "hpp_parameters" {
  name         = "hospital-backend-dev-parameters"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id"

  attribute {
    name = "id"
    type = "S"
  }

  tags = {
    Environment = var.stage
    Project     = "HospitalPadreHurtado"
  }
}
