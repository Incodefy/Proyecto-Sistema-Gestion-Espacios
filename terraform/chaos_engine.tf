# Archivo ZIP con el código Lambda
resource "aws_lambda_function" "chaos_engine" {
  function_name = "hospital-chaos-engine"
  role          = aws_iam_role.lambda_exec_role.arn
  handler       = "engine.handler"
  runtime       = "nodejs20.x"
  timeout       = 10

  filename         = "${path.module}/../aws/src/handlers/chaos/engine.zip"
  source_code_hash = filebase64sha256("${path.module}/../aws/src/handlers/chaos/engine.zip")

  environment {
    variables = {
      AWS_REGION = var.region
      STAGE      = var.stage
    }
  }
}

# API Gateway HTTP para exponer la Lambda
resource "aws_apigatewayv2_api" "chaos_api" {
  name          = "hospital-chaos-api"
  protocol_type = "HTTP"
}

resource "aws_apigatewayv2_integration" "chaos_integration" {
  api_id                 = aws_apigatewayv2_api.chaos_api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.chaos_engine.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "chaos_route" {
  api_id    = aws_apigatewayv2_api.chaos_api.id
  route_key = "GET /chaos/engine"
  target    = "integrations/${aws_apigatewayv2_integration.chaos_integration.id}"
}

resource "aws_lambda_permission" "api_gateway_permission" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.chaos_engine.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.chaos_api.execution_arn}/*/*"
}

# Alarmas CloudWatch
resource "aws_cloudwatch_metric_alarm" "chaos_latency_alarm" {
  alarm_name          = "ChaosLatencyHigh"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "Duration"
  namespace           = "AWS/Lambda"
  period              = 60
  statistic           = "Average"
  threshold           = 4000
  alarm_description   = "Latencia alta en la Lambda Chaos Engine"
  dimensions = {
    FunctionName = aws_lambda_function.chaos_engine.function_name
  }
  alarm_actions = [aws_sns_topic.chaos_alerts.arn]
}

# SNS topic para alertas
resource "aws_sns_topic" "chaos_alerts" {
  name = "hpp-chaos-alerts"
}

output "chaos_api_url" {
  value = aws_apigatewayv2_api.chaos_api.api_endpoint
}
