data "aws_partition" "current" {}

data "aws_ssm_parameter" "al2023" {
  count = var.ami_id == null ? 1 : 0
  name  = "/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64"
}

locals {
  create_iam     = var.existing_instance_profile_name == null
  name           = "${var.project_name}-${var.environment}-rabbitmq"
  password_path  = coalesce(var.password_parameter_name, "/${var.project_name}/${var.environment}/rabbitmq/password")
  cookie_path    = coalesce(var.cookie_parameter_name, "/${var.project_name}/${var.environment}/rabbitmq/erlang-cookie")
  amqp_ports     = [5672, 5673, 5674]
  parameter_arns = [for path in [local.password_path, local.cookie_path] : "arn:${data.aws_partition.current.partition}:ssm:${var.aws_region}:${var.aws_account_id}:parameter${path}"]

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
  vpc_id      = aws_vpc.main.id

  tags = { Name = local.name }

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_security_group" "backend" {
  name_prefix = "${var.project_name}-${var.environment}-backend-"
  description = "Backend en la VPC del proyecto; sin entrada publica"
  vpc_id      = aws_vpc.main.id

  tags = { Name = "${var.project_name}-${var.environment}-backend" }

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_vpc_security_group_egress_rule" "backend" {
  security_group_id = aws_security_group.backend.id
  description       = "Salida para Oracle, Azure, SSM y RabbitMQ"
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "-1"
}

resource "aws_vpc_security_group_ingress_rule" "amqp" {
  for_each = { for port in local.amqp_ports : tostring(port) => port }

  security_group_id            = aws_security_group.rabbitmq.id
  referenced_security_group_id = aws_security_group.backend.id
  description                  = "AMQP privado desde backend, puerto ${each.value}"
  ip_protocol                  = "tcp"
  from_port                    = each.value
  to_port                      = each.value
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
  count = local.create_iam ? 1 : 0

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
  count = local.create_iam ? 1 : 0

  role       = aws_iam_role.rabbitmq[0].name
  policy_arn = "arn:${data.aws_partition.current.partition}:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_role_policy" "secrets" {
  count = local.create_iam ? 1 : 0

  name = "read-rabbitmq-secrets"
  role = aws_iam_role.rabbitmq[0].id
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
  count = local.create_iam ? 1 : 0

  name_prefix = "${local.name}-"
  role        = aws_iam_role.rabbitmq[0].name
}

resource "aws_instance" "rabbitmq" {
  ami                         = var.ami_id == null ? nonsensitive(data.aws_ssm_parameter.al2023[0].value) : var.ami_id
  instance_type               = var.instance_type
  subnet_id                   = aws_subnet.public.id
  associate_public_ip_address = var.associate_public_ip_address
  vpc_security_group_ids      = [aws_security_group.rabbitmq.id]
  iam_instance_profile        = local.create_iam ? aws_iam_instance_profile.rabbitmq[0].name : var.existing_instance_profile_name
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

  # cloud-init necesita la ruta a Internet y las reglas de salida al arrancar.
  depends_on = [
    aws_iam_role_policy_attachment.ssm,
    aws_iam_role_policy.secrets,
    aws_route_table_association.public,
    aws_vpc_security_group_egress_rule.web,
  ]
}
