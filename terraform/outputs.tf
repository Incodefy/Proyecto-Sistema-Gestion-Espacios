output "dynamodb_table_name" {
  value = aws_dynamodb_table.hpp_parameters.name
}

output "lambda_function_name" {
  value = aws_lambda_function.chaos_engine.function_name
}

output "api_endpoint" {
  value = aws_apigatewayv2_api.chaos_api.api_endpoint
}
