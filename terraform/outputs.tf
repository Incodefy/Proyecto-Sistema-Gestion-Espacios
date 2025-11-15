output "dynamodb_table_name" {
  value = aws_dynamodb_table.hpp_parameters.name
}

output "parameters_table_arn" {
  description = "ARN of the Parameters DynamoDB table"
  value       = aws_dynamodb_table.hpp_parameters.arn
}

output "activity_logs_table_arn" {
  description = "ARN of the Activity Logs DynamoDB table"
  value       = aws_dynamodb_table.activity_logs.arn
}

output "user_roles_table_arn" {
  description = "ARN of the User Roles DynamoDB table"
  value       = aws_dynamodb_table.user_roles.arn
}

output "permissions_table_arn" {
  description = "ARN of the Permissions DynamoDB table"
  value       = aws_dynamodb_table.permissions.arn
}

output "agenda_table_arn" {
  description = "ARN of the Agenda DynamoDB table"
  value       = aws_dynamodb_table.agenda.arn
}

output "catalogo_table_arn" {
  description = "ARN of the Catalogo DynamoDB table"
  value       = aws_dynamodb_table.catalogo.arn
}

output "box_instrumento_table_arn" {
  description = "ARN of the Box-Instrumento DynamoDB table"
  value       = aws_dynamodb_table.box_instrumento.arn
}

output "notificaciones_table_arn" {
  description = "ARN of the Notificaciones DynamoDB table"
  value       = aws_dynamodb_table.notificaciones.arn
}

output "processed_messages_table_arn" {
  description = "ARN of the Processed Messages DynamoDB table"
  value       = aws_dynamodb_table.processed_messages.arn
}

output "lambda_function_name" {
  value = aws_lambda_function.chaos_engine.function_name
}

output "api_endpoint" {
  value = aws_apigatewayv2_api.chaos_api.api_endpoint
}
