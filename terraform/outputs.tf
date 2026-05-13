output "backend_public_ip" {
  value = aws_instance.coe_558_project_backend_server.public_ip
}

output "frontend_public_ip" {
  value = aws_instance.coe_558_project_frontend_server.public_ip
}

output "weather_lambda_url" {
  value = aws_lambda_function_url.coe_558_project_weather.function_url
}

output "s3_bucket_name" {
  value = aws_s3_bucket.coe_558_bucket.bucket
}