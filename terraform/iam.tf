resource "aws_iam_role" "coe_558_project_weather_lambda" {
  name = "coe-558-project-weather-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "coe_558_project_weather_lambda_basic" {
  role       = aws_iam_role.coe_558_project_weather_lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role" "coe_558_project_backend_ec2" {
  name = "coe-558-project-backend-ec2-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })
}

resource "aws_iam_instance_profile" "coe_558_project_backend" {
  name = "coe-558-project-backend-profile"
  role = aws_iam_role.coe_558_project_backend_ec2.name
}

resource "aws_iam_policy" "coe_558_project_backend_s3" {
  name = "coe-558-project-backend-s3-policy"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject",
          "s3:DeleteObject"
        ]
        Resource = "${aws_s3_bucket.coe_558_bucket.arn}/*"
      },
      {
        Effect = "Allow"
        Action = [
          "s3:ListBucket"
        ]
        Resource = aws_s3_bucket.coe_558_bucket.arn
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "coe_558_project_backend_s3" {
  role       = aws_iam_role.coe_558_project_backend_ec2.name
  policy_arn = aws_iam_policy.coe_558_project_backend_s3.arn
}

resource "aws_iam_user" "coe_558_project_github_actions" {
  name = "coe-558-project-github-actions-user"

  tags = {
    Project = "coe-558-project"
    Name    = "coe-558-project-github-actions-user"
  }
}

resource "aws_iam_user_policy_attachment" "coe_558_project_github_actions_admin" {
  user       = aws_iam_user.coe_558_project_github_actions.name
  policy_arn = "arn:aws:iam::aws:policy/AdministratorAccess"
}