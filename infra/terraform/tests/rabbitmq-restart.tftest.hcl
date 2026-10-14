# Proveedor simulado: estas pruebas no se conectan a AWS ni crean recursos.
mock_provider "aws" {
  mock_data "aws_availability_zones" {
    defaults = {
      names = ["us-east-1e", "us-east-1c", "us-east-1a"]
    }
  }
  mock_data "aws_ec2_instance_type_offerings" {
    defaults = {
      locations = ["us-east-1c", "us-east-1a", "us-east-1f"]
    }
  }
  mock_resource "aws_vpc" {
    defaults = {
      id = "vpc-0123456789abcdef0"
    }
  }
  mock_resource "aws_subnet" {
    defaults = {
      id = "subnet-0123456789abcdef0"
    }
  }
  mock_resource "aws_internet_gateway" {
    defaults = {
      id = "igw-0123456789abcdef0"
    }
  }
  mock_resource "aws_route_table" {
    defaults = {
      id = "rtb-0123456789abcdef0"
    }
  }
  mock_data "aws_partition" {
    defaults = {
      partition = "aws"
    }
  }
  mock_data "aws_ssm_parameter" {
    defaults = {
      value = "ami-0123456789abcdef0"
    }
  }
  mock_resource "aws_instance" {
    defaults = {
      id         = "i-0123456789abcdef0"
      private_ip = "10.0.1.10"
    }
  }
}
variables {
  aws_account_id                 = "123456789012"
  existing_instance_profile_name = "LabInstanceProfile"
  enable_database                = false
  enable_application             = false
  rabbitmq_username              = "levelup"
}

run "peers_can_start_before_cluster_is_ready" {
  command = apply

  assert {
    condition = (
      yamldecode(local.compose_yaml).services["rabbitmq-2"].depends_on["rabbitmq-1"].condition == "service_started" &&
      yamldecode(local.compose_yaml).services["rabbitmq-3"].depends_on["rabbitmq-2"].condition == "service_started" &&
      strcontains(aws_instance.rabbitmq.user_data, "up -d --wait --wait-timeout 600")
    )
    error_message = "Los pares deben iniciar sin esperar salud de un nodo aislado; la comprobacion final del cluster debe seguir activa."
  }
}

run "bootstrap_change_preserves_existing_broker" {
  command = plan
  variables { rabbitmq_username = "levelup_next" }

  assert {
    condition     = !strcontains(aws_instance.rabbitmq.user_data, base64encode(local.compose_yaml))
    error_message = "Cambiar el bootstrap no debe actualizar ni reemplazar una EC2 existente con datos RabbitMQ."
  }
}
