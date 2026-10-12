# Proveedor simulado: estas pruebas no se conectan a AWS ni crean recursos.
mock_provider "aws" {
  mock_data "aws_subnet" {
    defaults = {
      vpc_id = "vpc-0123456789abcdef0"
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
  aws_account_id = "123456789012"
  subnet_id      = "subnet-0123456789abcdef0"
}

run "isolated_by_default" {
  command = plan

  assert {
    condition     = length(aws_vpc_security_group_ingress_rule.amqp) == 0
    error_message = "No deben existir reglas entrantes cuando no se indican security groups del backend."
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
    condition     = jsondecode(aws_iam_role_policy.secrets.policy).Statement[0].Action == ["ssm:GetParameters"] && length(jsondecode(aws_iam_role_policy.secrets.policy).Statement[0].Resource) == 2 && alltrue([for arn in jsondecode(aws_iam_role_policy.secrets.policy).Statement[0].Resource : !strcontains(arn, "*")])
    error_message = "El rol solo puede leer los dos parametros indicados, sin comodines."
  }

  assert {
    condition     = jsondecode(aws_iam_role_policy.secrets.policy).Statement[1].Effect == "Deny" && jsondecode(aws_iam_role_policy.secrets.policy).Statement[1].NotResource == jsondecode(aws_iam_role_policy.secrets.policy).Statement[0].Resource
    error_message = "La politica administrada de SSM no debe permitir leer parametros ajenos a RabbitMQ."
  }
}

run "private_backend_access" {
  command = plan

  variables {
    backend_security_group_ids = ["sg-0123456789abcdef0", "sg-fedcba98765432100"]
  }

  assert {
    condition     = length(aws_vpc_security_group_ingress_rule.amqp) == 6 && alltrue([for rule in aws_vpc_security_group_ingress_rule.amqp : contains([5672, 5673, 5674], rule.from_port) && rule.from_port == rule.to_port && rule.ip_protocol == "tcp" && rule.cidr_ipv4 == null])
    error_message = "Los dos backends solo deben tener acceso a los tres puertos AMQP, sin acceso por CIDR publico."
  }
}

run "custom_kms_key" {
  command = plan

  variables {
    secrets_kms_key_arn = "arn:aws:kms:us-east-1:123456789012:key/00000000-0000-0000-0000-000000000000"
  }

  assert {
    condition     = jsondecode(aws_iam_role_policy.secrets.policy).Statement[2].Resource == [var.secrets_kms_key_arn] && jsondecode(aws_iam_role_policy.secrets.policy).Statement[2].Condition.StringEquals["kms:ViaService"] == "ssm.us-east-1.amazonaws.com"
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

run "reject_invalid_subnet" {
  command = plan

  variables {
    subnet_id = "red-local"
  }

  expect_failures = [var.subnet_id]
}
