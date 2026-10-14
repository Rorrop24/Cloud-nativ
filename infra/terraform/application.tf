data "aws_ec2_instance_type_offerings" "application" {
  count         = var.enable_application ? 1 : 0
  location_type = "availability-zone"
  filter {
    name   = "instance-type"
    values = [var.application_instance_type]
  }
}

locals {
  application_name       = "${var.project_name}-${var.environment}-app"
  application_hash       = var.enable_application ? filesha256(var.application_artifact_path) : ""
  application_key        = "releases/${local.application_hash}.zip"
  application_bucket     = var.enable_application ? (var.application_release_bucket_name != null ? var.application_release_bucket_name : aws_s3_bucket.application[0].id) : ""
  application_bucket_arn = "arn:${data.aws_partition.current.partition}:s3:::${local.application_bucket}"
  application_secret_arns = [for path in [local.password_path, local.database_password_path] :
  "arn:${data.aws_partition.current.partition}:ssm:${var.aws_region}:${var.aws_account_id}:parameter${path}"]
  application_config = var.enable_application && var.enable_database ? jsonencode({
    region                 = var.aws_region
    artifact_bucket        = local.application_bucket
    artifact_key           = local.application_key
    artifact_sha256        = local.application_hash
    database_password_path = local.database_password_path
    rabbit_password_path   = local.password_path
    backend = {
      SPRING_PROFILES_ACTIVE = "aws"
      DB_URL                 = "jdbc:mysql://${aws_db_instance.mysql[0].address}:3306/${var.database_name}?sslMode=VERIFY_IDENTITY&serverTimezone=UTC&characterEncoding=UTF-8"
      DB_USERNAME            = var.database_username
      RABBITMQ_ADDRESSES     = join(",", [for port in local.amqp_ports : "${aws_instance.rabbitmq.private_ip}:${port}"])
      RABBITMQ_USERNAME      = var.rabbitmq_username
      RABBITMQ_VHOST         = var.rabbitmq_vhost
      MESSAGING_OUTPUT_DIR   = "/app/data/events"
      AZURE_ISSUER_URI       = "https://login.microsoftonline.com/${var.azure_tenant_id}/v2.0"
      AZURE_JWK_SET_URI      = "https://login.microsoftonline.com/${var.azure_tenant_id}/discovery/v2.0/keys"
      AZURE_API_AUDIENCE     = var.azure_api_audience
      ALLOWED_ORIGINS        = local.cdn_enabled ? "https://${aws_cloudfront_distribution.frontend[0].domain_name}" : aws_apigatewayv2_api.application[0].api_endpoint
    }
    bff = {
      BACKEND_URL        = "http://backend:8082"
      AZURE_ISSUER_URI   = "https://login.microsoftonline.com/${var.azure_tenant_id}/v2.0"
      AZURE_JWK_SET_URI  = "https://login.microsoftonline.com/${var.azure_tenant_id}/discovery/v2.0/keys"
      AZURE_API_AUDIENCE = var.azure_api_audience
      ALLOWED_ORIGINS    = local.cdn_enabled ? "https://${aws_cloudfront_distribution.frontend[0].domain_name}" : aws_apigatewayv2_api.application[0].api_endpoint
    }
  }) : "{}"
}

resource "aws_s3_bucket" "application" {
  count         = var.enable_application && var.application_release_bucket_name == null ? 1 : 0
  bucket_prefix = "${var.project_name}-${var.environment}-releases-"
  force_destroy = false
}

resource "aws_s3_bucket_public_access_block" "application" {
  count                   = var.enable_application ? 1 : 0
  bucket                  = local.application_bucket
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "application" {
  count  = var.enable_application ? 1 : 0
  bucket = local.application_bucket
  rule {
    apply_server_side_encryption_by_default { sse_algorithm = "AES256" }
  }
}

resource "aws_s3_bucket_policy" "application" {
  count  = var.enable_application ? 1 : 0
  bucket = local.application_bucket
  policy = jsonencode({ Version = "2012-10-17", Statement = [{
    Sid       = "DenyInsecureTransport", Effect = "Deny", Principal = "*", Action = "s3:*",
    Resource  = [local.application_bucket_arn, "${local.application_bucket_arn}/*"],
    Condition = { Bool = { "aws:SecureTransport" = "false" } }
  }] })
}

resource "aws_s3_object" "application" {
  count                  = var.enable_application ? 1 : 0
  bucket                 = local.application_bucket
  key                    = local.application_key
  source                 = var.application_artifact_path
  source_hash            = local.application_hash
  content_type           = "application/zip"
  server_side_encryption = "AES256"
  depends_on             = [aws_s3_bucket_public_access_block.application, aws_s3_bucket_policy.application]
}

resource "aws_iam_role" "application" {
  count       = var.enable_application && local.create_iam ? 1 : 0
  name_prefix = "${local.application_name}-"
  assume_role_policy = jsonencode({ Version = "2012-10-17", Statement = [{
    Effect = "Allow", Action = "sts:AssumeRole", Principal = { Service = "ec2.amazonaws.com" }
  }] })
}

resource "aws_iam_role_policy_attachment" "application_ssm" {
  count      = var.enable_application && local.create_iam ? 1 : 0
  role       = aws_iam_role.application[0].name
  policy_arn = "arn:${data.aws_partition.current.partition}:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_role_policy" "application" {
  count = var.enable_application && local.create_iam ? 1 : 0
  role  = aws_iam_role.application[0].id
  name  = "application-release-and-secrets"
  policy = jsonencode({ Version = "2012-10-17", Statement = concat([
    { Effect = "Allow", Action = ["s3:GetObject"], Resource = ["${local.application_bucket_arn}/${local.application_key}"] },
    { Effect = "Allow", Action = ["ssm:GetParameters"], Resource = local.application_secret_arns },
    { Effect = "Deny", Action = ["ssm:GetParameter", "ssm:GetParameters", "ssm:GetParametersByPath"], NotResource = local.application_secret_arns }
    ], var.secrets_kms_key_arn == null ? [] : [{
      Effect    = "Allow", Action = ["kms:Decrypt"], Resource = [var.secrets_kms_key_arn],
      Condition = { StringEquals = { "kms:ViaService" = "ssm.${var.aws_region}.amazonaws.com" } }
  }]) })
}

resource "aws_iam_instance_profile" "application" {
  count       = var.enable_application && local.create_iam ? 1 : 0
  name_prefix = "${local.application_name}-"
  role        = aws_iam_role.application[0].name
}

resource "aws_instance" "application" {
  count                       = var.enable_application ? 1 : 0
  ami                         = var.ami_id == null ? nonsensitive(data.aws_ssm_parameter.al2023[0].value) : var.ami_id
  instance_type               = var.application_instance_type
  subnet_id                   = aws_subnet.public.id
  associate_public_ip_address = true
  vpc_security_group_ids      = [aws_security_group.backend.id]
  iam_instance_profile        = local.create_iam ? aws_iam_instance_profile.application[0].name : var.existing_instance_profile_name
  user_data = templatefile("${path.module}/templates/application-cloud-init.sh.tftpl", {
    config_base64 = base64encode(local.application_config)
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
    volume_size = 40
  }
  tags = { Name = local.application_name }
  lifecycle {
    create_before_destroy = true
    precondition {
      condition     = var.enable_database && contains(data.aws_ec2_instance_type_offerings.application[0].locations, local.selected_availability_zone)
      error_message = "La aplicacion necesita RDS habilitado y una AZ que ofrezca application_instance_type."
    }
  }
  depends_on = [aws_s3_object.application, aws_iam_role_policy.application,
    aws_iam_role_policy_attachment.application_ssm, aws_route_table_association.public,
  aws_vpc_security_group_egress_rule.backend, aws_vpc_security_group_ingress_rule.amqp]
}
