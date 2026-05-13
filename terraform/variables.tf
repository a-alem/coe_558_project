variable "region" {
  description = "Region of AWS"
  type = string
  default = "eu-central-1"
}

variable "av_zone" {
  description = "Availability Zone of AWS Region"
  type = string
  default = "eu-central-1a"
}

variable "lambda_zip_path" {
  type    = string
  default = "../apps/weather_lambda/weather-lambda.zip"
}