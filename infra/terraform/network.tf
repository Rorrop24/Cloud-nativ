data "aws_availability_zones" "available" {
  state = "available"

  filter {
    name   = "zone-type"
    values = ["availability-zone"]
  }
}

data "aws_ec2_instance_type_offerings" "rabbitmq" {
  location_type = "availability-zone"

  filter {
    name   = "instance-type"
    values = [var.instance_type]
  }
}

locals {
  compatible_availability_zones = sort(tolist(setintersection(
    toset(data.aws_availability_zones.available.names),
    toset(data.aws_ec2_instance_type_offerings.rabbitmq.locations),
  )))
  selected_availability_zone = var.availability_zone != null ? var.availability_zone : try(local.compatible_availability_zones[0], null)
}

resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = { Name = "${var.project_name}-${var.environment}-vpc" }
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = { Name = "${var.project_name}-${var.environment}-igw" }
}

resource "aws_subnet" "public" {
  vpc_id                  = aws_vpc.main.id
  availability_zone       = local.selected_availability_zone
  cidr_block              = "10.0.1.0/24"
  map_public_ip_on_launch = true

  tags = { Name = "${var.project_name}-${var.environment}-public" }

  lifecycle {
    precondition {
      condition     = contains(local.compatible_availability_zones, coalesce(local.selected_availability_zone, "unavailable"))
      error_message = "No hay una zona habilitada compatible con ${var.instance_type} en ${var.aws_region}, o availability_zone indica una zona incompatible."
    }
  }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = { Name = "${var.project_name}-${var.environment}-public-routes" }
}

resource "aws_route_table_association" "public" {
  subnet_id      = aws_subnet.public.id
  route_table_id = aws_route_table.public.id
}
