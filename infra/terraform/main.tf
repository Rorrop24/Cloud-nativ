data "aws_subnet" "selected" {
  id = var.subnet_id
}

data "aws_partition" "current" {}

data "aws_ssm_parameter" "al2023" {
  count = var.ami_id == null ? 1 : 0
  name  = "/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64"
}

locals {
  name           = "${var.project_name}-${var.environment}-rabbitmq"
  password_path  = coalesce(var.password_parameter_name, "/${var.project_name}/${var.environment}/rabbitmq/password")
  cookie_path    = coalesce(var.cookie_parameter_name, "/${var.project_name}/${var.environment}/rabbitmq/erlang-cookie")
  amqp_ports     = [5672, 5673, 5674]
  parameter_arns = [for path in [local.password_path, local.cookie_path] : "arn:${data.aws_partition.current.partition}:ssm:${var.aws_region}:${var.aws_account_id}:parameter${path}"]

  amqp_rules = {
    for item in flatten([
      for group in var.backend_security_group_ids : [
        for port in local.amqp_ports : { group = group, port = port }
      ]
    ]) : "${item.group}-${item.port}" => item
  }

  # Las mismas plantillas se validan localmente y se entregan a EC2 mediante cloud-init.
  compose_yaml = templatefile("${path.module}/templates/docker-compose.yml.tftpl", {
    username = var.rabbitmq_username
    vhost    = var.rabbitmq_vhost
  })
  rabbitmq_conf = file("${path.module}/templates/rabbitmq.conf")
  bootstrap = templatefile("${path.module}/templates/cloud-init.sh.tftpl", {
    region         = var.aws_region
    password_path  = local.password_path
    cookie_path    = local.cookie_path
    compose_base64 = base64encode(local.compose_yaml)
    config_base64  = base64encode(local.rabbitmq_conf)
  })
}

resource "aws_security_group" "rabbitmq" {
  name_prefix = "${local.name}-"
  description = "RabbitMQ: AMQP desde el backend, administracion por SSM"
  vpc_id      = data.aws_subnet.selected.vpc_id

  tags = { Name = local.name }

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_vpc_security_group_ingress_rule" "amqp" {
  for_each = local.amqp_rules

  security_group_id            = aws_security_group.rabbitmq.id
  referenced_security_group_id = each.value.group
  description                  = "AMQP privado desde backend, puerto ${each.value.port}"
  ip_protocol                  = "tcp"
  from_port                    = each.value.port
  to_port                      = each.value.port
}

resource "aws_vpc_security_group_egress_rule" "web" {
  for_each = toset(["80", "443"])

  security_group_id = aws_security_group.rabbitmq.id
  description       = "Paquetes, imagenes Docker y servicios AWS"
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "tcp"
  from_port         = tonumber(each.value)
  to_port           = tonumber(each.value)
}

resource "aws_iam_role" "rabbitmq" {
  name_prefix = "${local.name}-"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Action    = "sts:AssumeRole"
      Principal = { Service = "ec2.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ssm" {
  role       = aws_iam_role.rabbitmq.name
  policy_arn = "arn:${data.aws_partition.current.partition}:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_role_policy" "secrets" {
  name = "read-rabbitmq-secrets"
  role = aws_iam_role.rabbitmq.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = concat([
      {
        Effect   = "Allow"
        Action   = ["ssm:GetParameters"]
        Resource = local.parameter_arns
      },
      {
        Effect      = "Deny"
        Action      = ["ssm:GetParameter", "ssm:GetParameters", "ssm:GetParametersByPath"]
        NotResource = local.parameter_arns
      }
      ], var.secrets_kms_key_arn == null ? [] : [
      {
        Effect   = "Allow"
        Action   = ["kms:Decrypt"]
        Resource = [var.secrets_kms_key_arn]
        Condition = {
          StringEquals = { "kms:ViaService" = "ssm.${var.aws_region}.amazonaws.com" }
        }
      }
    ])
  })
}

resource "aws_iam_instance_profile" "rabbitmq" {
  name_prefix = "${local.name}-"
  role        = aws_iam_role.rabbitmq.name
}

resource "aws_instance" "rabbitmq" {
  ami                         = var.ami_id == null ? nonsensitive(data.aws_ssm_parameter.al2023[0].value) : var.ami_id
  instance_type               = var.instance_type
  subnet_id                   = var.subnet_id
  associate_public_ip_address = var.associate_public_ip_address
  vpc_security_group_ids      = [aws_security_group.rabbitmq.id]
  iam_instance_profile        = aws_iam_instance_profile.rabbitmq.name
  user_data                   = local.bootstrap
  user_data_replace_on_change = true

  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "required"
    http_put_response_hop_limit = 1
  }

  root_block_device {
    encrypted   = true
    volume_type = "gp3"
    volume_size = var.volume_size_gib
    tags        = { Name = "${local.name}-data" }
  }

  tags = { Name = local.name }

  depends_on = [aws_iam_role_policy_attachment.ssm, aws_iam_role_policy.secrets]
}
