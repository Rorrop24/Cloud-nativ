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
  existing_instance_profile_name = null
  availability_zone              = null
  enable_database                = false
  database_password              = "PasswordForTestsOnly0123456789ABCD"
}

# apply usa SOLO el proveedor simulado; resuelve IDs para probar las referencias.
run "public_network_connected" {
  command = apply

  assert {
    condition     = aws_vpc.main.cidr_block == "10.0.0.0/16" && aws_vpc.main.enable_dns_support && aws_vpc.main.enable_dns_hostnames
    error_message = "La VPC debe usar 10.0.0.0/16 con resolucion y nombres DNS habilitados."
  }

  assert {
    condition     = aws_internet_gateway.main.vpc_id == aws_vpc.main.id && aws_subnet.public.vpc_id == aws_vpc.main.id && aws_subnet.public.cidr_block == "10.0.1.0/24" && aws_subnet.public.map_public_ip_on_launch
    error_message = "El IGW y la subred publica con asignacion de IP deben pertenecer a la VPC nueva."
  }

  assert {
    condition     = aws_subnet.public.availability_zone == "us-east-1a" && output.availability_zone == "us-east-1a" && local.compatible_availability_zones == tolist(["us-east-1a", "us-east-1c"])
    error_message = "La seleccion automatica debe excluir zonas incompatibles o no habilitadas y ser determinista."
  }

  assert {
    condition     = aws_route_table.public.vpc_id == aws_vpc.main.id && anytrue([for route in aws_route_table.public.route : route.cidr_block == "0.0.0.0/0" && route.gateway_id == aws_internet_gateway.main.id])
    error_message = "La tabla publica debe enviar 0.0.0.0/0 al IGW de esta VPC."
  }

  assert {
    condition     = aws_route_table_association.public.subnet_id == aws_subnet.public.id && aws_route_table_association.public.route_table_id == aws_route_table.public.id
    error_message = "La subred publica debe estar asociada a su tabla de rutas."
  }

  assert {
    condition     = aws_instance.rabbitmq.subnet_id == aws_subnet.public.id && aws_instance.rabbitmq.associate_public_ip_address && aws_instance.rabbitmq.vpc_security_group_ids == toset([aws_security_group.rabbitmq.id])
    error_message = "La EC2 debe usar la subred creada, IP publica y el grupo exclusivo de RabbitMQ."
  }

  assert {
    condition     = aws_security_group.rabbitmq.vpc_id == aws_vpc.main.id && aws_security_group.backend.vpc_id == aws_vpc.main.id && output.vpc_id == aws_vpc.main.id && output.public_subnet_id == aws_subnet.public.id && output.backend_security_group_id == aws_security_group.backend.id
    error_message = "Los grupos y outputs deben referenciar la red creada, no recursos externos."
  }

  assert {
    condition     = length(aws_iam_role.rabbitmq) == 1 && length(aws_iam_instance_profile.rabbitmq) == 1 && aws_instance.rabbitmq.iam_instance_profile == aws_iam_instance_profile.rabbitmq[0].name
    error_message = "El modo IAM propio debe seguir creando y asociando su perfil a la instancia."
  }
}

run "isolated_by_default" {
  command = plan

  assert {
    condition     = length(aws_vpc_security_group_ingress_rule.amqp) == 3 && alltrue([for rule in aws_vpc_security_group_ingress_rule.amqp : rule.cidr_ipv4 == null && rule.cidr_ipv6 == null && rule.referenced_security_group_id == aws_security_group.backend.id])
    error_message = "La IP publica no debe permitir entrada arbitraria: AMQP solo desde el grupo del backend."
  }

  assert {
    condition     = aws_instance.rabbitmq.metadata_options[0].http_tokens == "required" && aws_instance.rabbitmq.metadata_options[0].http_put_response_hop_limit == 1
    error_message = "La instancia debe exigir IMDSv2 y limitar el acceso a metadatos al host."
  }

  assert {
    condition     = aws_instance.rabbitmq.root_block_device[0].encrypted && aws_instance.rabbitmq.root_block_device[0].volume_type == "gp3"
    error_message = "Los mensajes deben almacenarse en un disco gp3 cifrado."
  }

  assert {
    condition     = length(yamldecode(local.compose_yaml).services) == 3 && alltrue([for node in values(yamldecode(local.compose_yaml).services) : contains(node.ports, "127.0.0.1:15672:15672") || contains(node.ports, "127.0.0.1:15673:15672") || contains(node.ports, "127.0.0.1:15674:15672")])
    error_message = "El cluster debe tener tres nodos y los dashboards deben escuchar solo en loopback."
  }

  assert {
    condition     = jsondecode(aws_iam_role_policy.secrets[0].policy).Statement[0].Action == ["ssm:GetParameters"] && length(jsondecode(aws_iam_role_policy.secrets[0].policy).Statement[0].Resource) == 2 && alltrue([for arn in jsondecode(aws_iam_role_policy.secrets[0].policy).Statement[0].Resource : !strcontains(arn, "*")])
    error_message = "El rol solo puede leer los dos parametros indicados, sin comodines."
  }

  assert {
    condition     = jsondecode(aws_iam_role_policy.secrets[0].policy).Statement[1].Effect == "Deny" && jsondecode(aws_iam_role_policy.secrets[0].policy).Statement[1].NotResource == jsondecode(aws_iam_role_policy.secrets[0].policy).Statement[0].Resource
    error_message = "La politica administrada de SSM no debe permitir leer parametros ajenos a RabbitMQ."
  }
}

run "private_backend_access" {
  command = plan

  assert {
    condition     = length(aws_vpc_security_group_ingress_rule.amqp) == 3 && alltrue([for rule in aws_vpc_security_group_ingress_rule.amqp : contains([5672, 5673, 5674], rule.from_port) && rule.from_port == rule.to_port && rule.ip_protocol == "tcp" && rule.security_group_id == aws_security_group.rabbitmq.id && rule.referenced_security_group_id == aws_security_group.backend.id])
    error_message = "El grupo del backend creado debe tener acceso privado a los tres puertos AMQP."
  }
}

run "custom_kms_key" {
  command = plan

  variables {
    secrets_kms_key_arn = "arn:aws:kms:us-east-1:123456789012:key/00000000-0000-0000-0000-000000000000"
  }

  assert {
    condition     = jsondecode(aws_iam_role_policy.secrets[0].policy).Statement[2].Resource == [var.secrets_kms_key_arn] && jsondecode(aws_iam_role_policy.secrets[0].policy).Statement[2].Condition.StringEquals["kms:ViaService"] == "ssm.us-east-1.amazonaws.com"
    error_message = "El descifrado debe limitarse a la clave indicada y al servicio SSM."
  }
}

run "reject_small_instance" {
  command = plan

  variables {
    instance_type = "t3.micro"
  }

  expect_failures = [var.instance_type]
}

run "reject_invalid_account" {
  command = plan

  variables {
    aws_account_id = "correo@example.com"
  }

  expect_failures = [var.aws_account_id]
}

run "existing_lab_profile_without_iam_resources" {
  command = plan

  variables {
    existing_instance_profile_name = "LabInstanceProfile"
  }

  assert {
    condition     = length(aws_iam_role.rabbitmq) == 0 && length(aws_iam_role_policy_attachment.ssm) == 0 && length(aws_iam_role_policy.secrets) == 0 && length(aws_iam_instance_profile.rabbitmq) == 0
    error_message = "El laboratorio no debe crear roles, perfiles ni politicas IAM."
  }

  assert {
    condition     = aws_instance.rabbitmq.iam_instance_profile == "LabInstanceProfile" && output.instance_profile_name == "LabInstanceProfile"
    error_message = "La EC2 debe usar exactamente el perfil existente indicado."
  }
}

run "reject_invalid_profile_name" {
  command = plan

  variables {
    existing_instance_profile_name = "/LabInstanceProfile"
  }

  expect_failures = [var.existing_instance_profile_name]
}

run "explicit_compatible_zone" {
  command = plan

  variables {
    availability_zone = "us-east-1c"
  }

  assert {
    condition     = aws_subnet.public.availability_zone == "us-east-1c"
    error_message = "Debe respetarse una zona explicita que este habilitada y ofrezca la instancia."
  }
}

run "reject_unsupported_zone" {
  command = plan

  variables {
    availability_zone = "us-east-1e"
  }

  expect_failures = [aws_subnet.public]
}

run "reject_no_compatible_zones" {
  command = plan

  override_data {
    target = data.aws_ec2_instance_type_offerings.rabbitmq
    values = {
      locations = []
    }
  }

  expect_failures = [aws_subnet.public]
}

run "reject_zone_in_another_region" {
  command = plan

  variables {
    availability_zone = "us-west-2a"
  }

  expect_failures = [var.availability_zone]
}

run "bootstrap_uses_al2023_minimal_curl" {
  command = plan

  assert {
    condition     = strcontains(local.bootstrap, "dnf install -y docker awscli-2 python3 curl-minimal\n") && !strcontains(local.bootstrap, "dnf install -y docker awscli-2 python3 curl\n")
    error_message = "El arranque debe usar curl-minimal de AL2023, no forzar curl completo ni reemplazar paquetes."
  }
}
