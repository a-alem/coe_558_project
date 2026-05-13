// VPC
resource "aws_vpc" "coe_558_vpc" {
  cidr_block = "10.50.0.0/16"

  tags = {
    Name = "coe-558-vpc"
    project = "coe-558"
  }
}

// Gateways
resource "aws_internet_gateway" "coe_558_igw" {
  vpc_id = aws_vpc.coe_558_vpc.id

  tags = {
    Name    = "coe-558-igw"
    project = "coe-558"
  }
}

// Routing tables
resource "aws_route_table" "coe_558_public_rt" {
  vpc_id = aws_vpc.coe_558_vpc.id

  tags = {
    Name    = "coe-558-public-rt"
    project = "coe-558"
  }
}

// Default routes
resource "aws_route" "coe_558_public_internet_route" {
  route_table_id         = aws_route_table.coe_558_public_rt.id
  destination_cidr_block = "0.0.0.0/0"
  gateway_id             = aws_internet_gateway.coe_558_igw.id
}

// Route table associations
resource "aws_route_table_association" "coe_558_public_assoc" {
  subnet_id      = aws_subnet.coe_558_subnet_public.id
  route_table_id = aws_route_table.coe_558_public_rt.id
}

// Subnets
resource "aws_subnet" "coe_558_subnet_public" {
  vpc_id     = aws_vpc.coe_558_vpc.id
  availability_zone = var.av_zone
  map_public_ip_on_launch = true # This sets a subnet as public
  cidr_block = "10.50.0.0/20"

  tags = {
    Name = "coe-558-subnet-public1-eu-central-1a"
    project = "coe-558"
  }
}

resource "aws_subnet" "coe_558_subnet_private" {
  vpc_id     = aws_vpc.coe_558_vpc.id
  availability_zone = var.av_zone
  cidr_block = "10.50.128.0/20"

  tags = {
    Name = "coe-558-subnet-private1-eu-central-1a"
    project = "coe-558"
  }
}

// Security groups
resource "aws_security_group" "allow_https_ssh_coe_558" {
  name        = "allow_ssh_coe_558"
  description = "Allow HTTPS and HTTP and SSH inbound traffic and all outbound traffic for coe 558 vpc"
  vpc_id      = aws_vpc.coe_558_vpc.id

  tags = {
    Name = "allow_https_http_ssh_coe_558"
  }
}

resource "aws_vpc_security_group_ingress_rule" "allow_ssh_coe_558" {
  security_group_id = aws_security_group.allow_https_ssh_coe_558.id
  cidr_ipv4         = "0.0.0.0/0"
  from_port         = 22
  ip_protocol       = "tcp"
  to_port           = 22
}

resource "aws_vpc_security_group_ingress_rule" "allow_https_coe_558" {
  security_group_id = aws_security_group.allow_https_ssh_coe_558.id
  cidr_ipv4         = "0.0.0.0/0"
  from_port         = 443
  ip_protocol       = "tcp"
  to_port           = 443
}

resource "aws_vpc_security_group_ingress_rule" "allow_http_coe_558" {
  security_group_id = aws_security_group.allow_https_ssh_coe_558.id
  cidr_ipv4         = "0.0.0.0/0"
  from_port         = 80
  ip_protocol       = "tcp"
  to_port           = 80
}

resource "aws_vpc_security_group_egress_rule" "allow_all_return_traffic_ipv4_coe_558" {
  security_group_id = aws_security_group.allow_https_ssh_coe_558.id
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "-1" # all ports
}

resource "aws_vpc_security_group_egress_rule" "allow_all_return_traffic_ipv6_coe_558" {
  security_group_id = aws_security_group.allow_https_ssh_coe_558.id
  cidr_ipv6         = "::/0"
  ip_protocol       = "-1" # all ports
}