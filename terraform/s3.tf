resource "aws_s3_bucket" "coe_558_bucket" {
  bucket = "coe-558-project-bucket"

  tags = {
    Project = "coe-558-project"
  }
}

resource "aws_s3_bucket_public_access_block" "coe_558_bucket" {
  bucket = aws_s3_bucket.coe_558_bucket.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}