resource "aws_lambda_function" "coe_558_project_weather" {
  function_name = "coe-558-project-weather"
  role          = aws_iam_role.coe_558_project_weather_lambda.arn
  runtime       = "python3.12"
  handler       = "handler.lambda_handler"

  filename         = var.lambda_zip_path
  source_code_hash = filebase64sha256(var.lambda_zip_path)

  timeout = 15

  tags = {
    Project = "coe-558-project"
  }
}

resource "aws_lambda_function_url" "coe_558_project_weather" {
  function_name      = aws_lambda_function.coe_558_project_weather.function_name
  authorization_type = "NONE"

  cors {
    allow_credentials = false
    allow_origins     = ["*"]
    allow_methods     = ["GET"]
    allow_headers     = ["*"]
    max_age           = 3600
  }
}