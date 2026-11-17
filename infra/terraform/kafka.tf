# EP3: cluster Kafka (3 nodos Zookeeper + 3 brokers + Kafka-UI) en una EC2 propia.
# Los brokers solo aceptan conexiones desde el security group del backend.
# Kafka-UI escucha en 127.0.0.1:8095 de la EC2 y se abre por tunel SSM.

variable "kafka_instance_type" {
  description = "Tipo de la EC2 de Kafka. Tres brokers y tres Zookeeper necesitan al menos 8 GiB."
  type        = string
  default     = "t3.large"
  validation {
    condition     = can(regex("^t3a?\\.(large|xlarge|2xlarge)$", var.kafka_instance_type))
    error_message = "Kafka necesita una t3/t3a large o superior."
  }
}

variable "kafka_volume_size_gib" {
  description = "Disco de la EC2 de Kafka en GiB."
  type        = number
  default     = 40
  validation {
    condition     = var.kafka_volume_size_gib >= 30 && var.kafka_volume_size_gib <= 200 && floor(var.kafka_volume_size_gib) == var.kafka_volume_size_gib
    error_message = "Indica un entero entre 30 y 200."
  }
}

data "aws_ec2_instance_type_offerings" "kafka" {
  count         = var.enable_application ? 1 : 0
  location_type = "availability-zone"
  filter {
    name   = "instance-type"
    values = [var.kafka_instance_type]
  }
}

locals {
  kafka_name  = "${var.project_name}-${var.environment}-kafka"
  kafka_ports = [9092, 9093, 9094]

  # Unica fuente de nombres: el mismo archivo que leen los servicios Java.
  kafka_defaults = split("\n", replace(file("${path.module}/../../services/kafka-common/src/main/resources/kafka-defaults.properties"), "\r", ""))
  kafka_topics = [for line in local.kafka_defaults : trimspace(split("=", line)[1])
  if can(regex("^app\\.kafka\\.topics\\.[a-z-]+=", line))]

  kafka_bootstrap = var.enable_application ? join(",", [for port in local.kafka_ports : "${aws_instance.kafka[0].private_ip}:${port}"]) : ""
}

resource "aws_security_group" "kafka" {
  count       = var.enable_application ? 1 : 0
  name_prefix = "${local.kafka_name}-"
  description = "Kafka: brokers solo desde el backend, administracion por SSM"
  vpc_id      = aws_vpc.main.id

  tags = { Name = local.kafka_name }

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_vpc_security_group_ingress_rule" "kafka" {
  for_each = var.enable_application ? { for port in local.kafka_ports : tostring(port) => port } : {}

  security_group_id            = aws_security_group.kafka[0].id
  referenced_security_group_id = aws_security_group.backend.id
  description                  = "Broker Kafka privado desde backend, puerto ${each.value}"
  ip_protocol                  = "tcp"
  from_port                    = each.value
  to_port                      = each.value
}

resource "aws_vpc_security_group_egress_rule" "kafka_web" {
  for_each = var.enable_application ? toset(["80", "443"]) : toset([])

  security_group_id = aws_security_group.kafka[0].id
  description       = "Paquetes, imagenes Docker y servicios AWS"
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "tcp"
  from_port         = tonumber(each.value)
  to_port           = tonumber(each.value)
}

resource "aws_instance" "kafka" {
  count                       = var.enable_application ? 1 : 0
  ami                         = var.ami_id == null ? nonsensitive(data.aws_ssm_parameter.al2023[0].value) : var.ami_id
  instance_type               = var.kafka_instance_type
  subnet_id                   = aws_subnet.public.id
  associate_public_ip_address = true
  vpc_security_group_ids      = [aws_security_group.kafka[0].id]
  iam_instance_profile        = local.create_iam ? aws_iam_instance_profile.rabbitmq[0].name : var.existing_instance_profile_name
  user_data = templatefile("${path.module}/templates/kafka-cloud-init.sh.tftpl", {
    compose_base64 = base64encode(file("${path.module}/templates/kafka-compose.yml"))
    topics         = join(" ", local.kafka_topics)
    partitions     = 3
    replication    = 3
  })
  user_data_replace_on_change = true

  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "required"
    http_put_response_hop_limit = 1
  }

  root_block_device {
    encrypted   = true
    volume_type = "gp3"
    volume_size = var.kafka_volume_size_gib
    tags        = { Name = "${local.kafka_name}-data" }
  }

  tags = { Name = local.kafka_name }

  lifecycle {
    # Una AMI nueva de Amazon Linux no debe recrear el cluster y perder los topics.
    ignore_changes = [ami]
    precondition {
      condition     = contains(data.aws_ec2_instance_type_offerings.kafka[0].locations, local.selected_availability_zone)
      error_message = "La zona elegida no ofrece kafka_instance_type."
    }
    precondition {
      condition     = length(local.kafka_topics) == 6 && alltrue([for topic in local.kafka_topics : can(regex("^[A-Za-z0-9._-]{1,200}$", topic))])
      error_message = "kafka-defaults.properties debe declarar exactamente seis topics con nombres validos."
    }
  }

  depends_on = [
    aws_route_table_association.public,
    aws_vpc_security_group_egress_rule.kafka_web,
  ]
}

output "kafka_instance_id" {
  description = "ID de la EC2 de Kafka para AWS Systems Manager."
  value       = var.enable_application ? aws_instance.kafka[0].id : null
}

output "kafka_private_ip" {
  description = "IP privada de la EC2 de Kafka."
  value       = var.enable_application ? aws_instance.kafka[0].private_ip : null
}

output "kafka_bootstrap_servers" {
  description = "Brokers que usan el Backend y los servicios de streaming."
  value       = var.enable_application ? local.kafka_bootstrap : null
}

output "kafka_topics" {
  description = "Topics creados al arrancar, leidos de kafka-defaults.properties."
  value       = local.kafka_topics
}

output "kafka_session_command" {
  description = "Terminal en la EC2 de Kafka."
  value       = var.enable_application ? "aws ssm start-session --region ${var.aws_region} --target ${aws_instance.kafka[0].id}" : null
}

output "kafka_ui_tunnel_command" {
  description = "Tunel local a Kafka-UI (http://localhost:8095); requiere AWS CLI v2 y Session Manager Plugin."
  value       = var.enable_application ? "aws ssm start-session --region ${var.aws_region} --target ${aws_instance.kafka[0].id} --document-name AWS-StartPortForwardingSession --parameters '{\"portNumber\":[\"8095\"],\"localPortNumber\":[\"8095\"]}'" : null
}
