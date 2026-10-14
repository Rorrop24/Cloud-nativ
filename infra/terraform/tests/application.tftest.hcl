mock_provider "aws" {
  mock_data "aws_availability_zones" {
    defaults = { names = ["us-east-1a", "us-east-1c"] }
  }
  mock_data "aws_ec2_instance_type_offerings" {
    defaults = { locations = ["us-east-1a", "us-east-1c"] }
  }
  mock_data "aws_rds_engine_version" {
    defaults = { version_actual = "8.4.11" }
  }
  mock_data "aws_rds_orderable_db_instance" {
    defaults = { availability_zones = ["us-east-1a", "us-east-1c"], instance_class = "db.t3.micro" }
  }
  mock_data "aws_partition" {
    defaults = { partition = "aws" }
  }
  mock_data "aws_ssm_parameter" {
    defaults = { value = "ami-0123456789abcdef0" }
  }
  mock_resource "aws_cloudfront_distribution" {
    defaults = { domain_name = "punto-gamer.test.cloudfront.net", arn = "arn:aws:cloudfront::123456789012:distribution/TEST" }
  }
  mock_resource "aws_apigatewayv2_api" {
    defaults = { api_endpoint = "https://test.execute-api.us-east-1.amazonaws.com" }
  }
  mock_resource "aws_cloudfront_function" {
    defaults = { arn = "arn:aws:cloudfront::123456789012:function/punto-gamer-test-spa" }
  }
  mock_resource "aws_lb" {
    defaults = { arn = "arn:aws:elasticloadbalancing:us-east-1:123456789012:loadbalancer/app/test/1234567890123456" }
  }
  mock_resource "aws_lb_target_group" {
    defaults = { arn = "arn:aws:elasticloadbalancing:us-east-1:123456789012:targetgroup/test/1234567890123456" }
  }
  mock_resource "aws_lb_listener" {
    defaults = { arn = "arn:aws:elasticloadbalancing:us-east-1:123456789012:listener/app/test/1234567890123456/1234567890123456" }
  }
}

variables {
  aws_account_id                  = "123456789012"
  existing_instance_profile_name  = "LabInstanceProfile"
  enable_application              = true
  enable_cdn                      = true
  enable_database                 = true
  application_release_bucket_name = null
  database_password               = "PasswordForTestsOnly0123456789ABCD"
  availability_zone               = "us-east-1a"
  application_artifact_path       = "./tests/fixtures/application.txt"
  frontend_dist_path              = "./tests/fixtures/frontend"
}

run "complete_deployment_is_private" {
  command = apply
  assert {
    condition = (aws_instance.application[0].vpc_security_group_ids == toset([aws_security_group.backend.id]) &&
      aws_instance.application[0].iam_instance_profile == "LabInstanceProfile" &&
      aws_instance.application[0].metadata_options[0].http_tokens == "required" &&
    aws_instance.application[0].root_block_device[0].encrypted)
    error_message = "La aplicacion debe usar el grupo del backend, el perfil existente, IMDSv2 y disco cifrado."
  }
  assert {
    condition = (aws_lb.application[0].internal &&
      aws_subnet.edge_secondary[0].availability_zone != aws_subnet.public.availability_zone &&
      aws_vpc_security_group_ingress_rule.application[0].referenced_security_group_id == aws_security_group.application_alb[0].id &&
      aws_vpc_security_group_ingress_rule.application[0].from_port == 8080 &&
      aws_vpc_security_group_ingress_rule.application[0].cidr_ipv4 == null &&
    aws_vpc_security_group_ingress_rule.alb[0].referenced_security_group_id == aws_security_group.gateway_link[0].id)
    error_message = "El ALB debe ser interno en dos AZ, y ningun puerto de la aplicacion puede abrirse por CIDR publico."
  }
  assert {
    condition = (aws_apigatewayv2_integration.application[0].connection_type == "VPC_LINK" &&
      aws_apigatewayv2_integration.application[0].request_parameters["overwrite:path"] == "$request.path" &&
    aws_lb_target_group_attachment.application[0].target_id == aws_instance.application[0].id)
    error_message = "Gateway debe llegar a la EC2 por VPC Link/ALB conservando las rutas de Spring."
  }
  assert {
    condition = (aws_s3_bucket_public_access_block.frontend[0].block_public_policy &&
      aws_s3_bucket_public_access_block.application[0].block_public_policy &&
      !aws_s3_bucket.frontend[0].force_destroy && !aws_s3_bucket.application[0].force_destroy &&
      aws_cloudfront_origin_access_control.frontend[0].signing_behavior == "always" &&
    output.website_url == "https://punto-gamer.test.cloudfront.net")
    error_message = "Buckets privados y conservados, OAC firmado y web HTTPS son obligatorios."
  }
  assert {
    condition = (alltrue([for behavior in aws_cloudfront_distribution.frontend[0].ordered_cache_behavior :
      behavior.target_origin_id != "api" || (behavior.cache_policy_id == local.cache_disabled_id &&
      behavior.origin_request_policy_id == local.api_origin_policy_id)]) &&
    length(aws_cloudfront_distribution.frontend[0].custom_error_response) == 0)
    error_message = "Las API no se cachean y sus respuestas 401/403 no se convierten en HTML."
  }
  assert {
    condition = (length(aws_iam_role.application) == 0 &&
      strcontains(aws_instance.application[0].user_data, "dnf install -y docker awscli-2 python3 curl-minimal unzip") &&
      strcontains(aws_instance.application[0].user_data, "sha256sum --check --status") &&
      strcontains(aws_instance.application[0].user_data, "docker buildx version") &&
      strcontains(aws_instance.application[0].user_data, "find Frontend/dist -type f -exec chmod 0644") &&
    !strcontains(aws_instance.application[0].user_data, "PasswordForTestsOnly0123456789ABCD"))
    error_message = "El arranque debe instalar Docker, verificar el ZIP y no crear IAM ni incluir passwords en user_data."
  }
}

run "application_can_be_disabled" {
  command = plan
  variables { enable_application = false }
  assert {
    condition = (length(aws_instance.application) == 0 && length(aws_cloudfront_distribution.frontend) == 0 &&
    length(aws_apigatewayv2_api.application) == 0 && output.website_url == null)
    error_message = "El modulo debe poder mantenerse deshabilitado sin crear la aplicacion."
  }
}

run "learner_lab_without_cloudfront" {
  command = plan
  variables { enable_cdn = false }
  assert {
    condition     = length(aws_cloudfront_distribution.frontend) == 0 && length(aws_s3_bucket.frontend) == 0 && output.website_url == aws_apigatewayv2_api.application[0].api_endpoint
    error_message = "Learner Lab debe publicar el sitio HTTPS por API Gateway sin necesitar CloudFront."
  }
}

run "reject_application_without_database" {
  command = plan
  variables { enable_database = false }
  expect_failures = [aws_instance.application]
}

run "existing_release_bucket_does_not_read_object_lock" {
  command = apply
  variables {
    enable_cdn                      = false
    application_release_bucket_name = "punto-gamer-existing-releases"
  }
  assert {
    condition     = length(aws_s3_bucket.application) == 0 && aws_s3_object.application[0].bucket == "punto-gamer-existing-releases" && aws_s3_bucket_public_access_block.application[0].block_public_policy
    error_message = "El bucket existente no debe leerse como aws_s3_bucket y debe seguir protegido."
  }
}

run "reject_unsupported_application_zone" {
  command = plan
  override_data {
    target = data.aws_ec2_instance_type_offerings.application[0]
    values = { locations = ["us-east-1c"] }
  }
  expect_failures = [aws_instance.application]
}

run "reject_missing_build" {
  command = plan
  variables { application_artifact_path = null }
  expect_failures = [var.application_artifact_path]
}
