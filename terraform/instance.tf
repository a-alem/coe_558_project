// Key pairs
resource "aws_key_pair" "coe_558_project_frontend_server" {
  key_name   = "coe-558-project-frontend-server-key"
  public_key = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIMd0NCAtDWsjdrXKru7nRIVrWWF8nFHUeajyqxGE+n+I coe558 project frontend"
}

resource "aws_key_pair" "coe_558_project_backend_server" {
  key_name   = "coe-558-project-backend-server-key"
  public_key = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIBd/J1+9DVLoxxlCAA2AwEvMBljOhnsMjnXynX3SZmLz coe558 project backend"
}

// Instances EC2
resource "aws_instance" "coe_558_project_frontend_server" {
  ami = "ami-0281b0943230d40d1"
  instance_type = "t3.medium"
  availability_zone = var.av_zone
  subnet_id = aws_subnet.coe_558_subnet_public.id
  key_name = aws_key_pair.coe_558_project_frontend_server.key_name
  user_data = file("${path.module}/scripts/install_docker.sh")
  vpc_security_group_ids = [
    aws_security_group.allow_https_ssh_coe_558.id
  ]
  tags = {
    Name = "coe-558-project-frontend-instance"
  }
}

resource "aws_instance" "coe_558_project_backend_server" {
  ami = "ami-0281b0943230d40d1"
  instance_type = "t3.large"
  availability_zone = var.av_zone
  subnet_id = aws_subnet.coe_558_subnet_public.id
  key_name = aws_key_pair.coe_558_project_backend_server.key_name
  user_data = file("${path.module}/scripts/install_docker.sh")
  iam_instance_profile = aws_iam_instance_profile.coe_558_project_backend.name
  root_block_device {
    volume_size = 60
  }
  vpc_security_group_ids = [
    aws_security_group.allow_https_ssh_coe_558.id
  ]
  tags = {
    Name = "coe-558-project-backend-instance"
  }
}