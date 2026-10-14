locals {
  cdn_enabled    = var.enable_application && var.enable_cdn
  frontend_files = local.cdn_enabled ? fileset(var.frontend_dist_path, "**") : toset([])
  # IDs publicos de politicas AWS; no se enumeran politicas de la cuenta.
  cache_disabled_id    = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad"
  cache_static_id      = "658327ea-f89d-4fab-a63d-7e88639e58f6"
  api_origin_policy_id = "b689b0a8-53d0-40ab-baf2-68738e2966ac"
  mime_types = {
    html = "text/html; charset=utf-8", js = "application/javascript", css = "text/css",
    json = "application/json", svg = "image/svg+xml", png = "image/png", jpg = "image/jpeg",
    jpeg = "image/jpeg", webp = "image/webp", ico = "image/x-icon", woff = "font/woff", woff2 = "font/woff2"
  }
}

resource "aws_s3_bucket" "frontend" {
  count         = local.cdn_enabled ? 1 : 0
  bucket_prefix = "${var.project_name}-${var.environment}-web-"
  force_destroy = false
}

resource "aws_s3_bucket_public_access_block" "frontend" {
  count                   = local.cdn_enabled ? 1 : 0
  bucket                  = aws_s3_bucket.frontend[0].id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "frontend" {
  count  = local.cdn_enabled ? 1 : 0
  bucket = aws_s3_bucket.frontend[0].id
  rule {
    apply_server_side_encryption_by_default { sse_algorithm = "AES256" }
  }
}

resource "aws_s3_object" "frontend" {
  for_each               = local.frontend_files
  bucket                 = aws_s3_bucket.frontend[0].id
  key                    = each.key
  source                 = "${var.frontend_dist_path}/${each.key}"
  source_hash            = filesha256("${var.frontend_dist_path}/${each.key}")
  content_type           = lookup(local.mime_types, lower(element(reverse(split(".", each.key)), 0)), "application/octet-stream")
  cache_control          = startswith(each.key, "assets/") ? "public,max-age=31536000,immutable" : "no-store"
  server_side_encryption = "AES256"
  depends_on             = [aws_s3_bucket_public_access_block.frontend]
}

resource "aws_cloudfront_origin_access_control" "frontend" {
  count                             = local.cdn_enabled ? 1 : 0
  name                              = "${local.application_name}-web"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_function" "spa" {
  count   = local.cdn_enabled ? 1 : 0
  name    = "${local.application_name}-spa"
  runtime = "cloudfront-js-2.0"
  publish = true
  code    = file("${path.module}/templates/spa-router.js")
}

resource "aws_cloudfront_response_headers_policy" "frontend" {
  count = local.cdn_enabled ? 1 : 0
  name  = "${local.application_name}-headers"
  security_headers_config {
    content_type_options { override = true }
    frame_options {
      frame_option = "DENY"
      override     = true
    }
    referrer_policy {
      referrer_policy = "strict-origin-when-cross-origin"
      override        = true
    }
    strict_transport_security {
      access_control_max_age_sec = 31536000
      override                   = true
    }
  }
}

resource "aws_cloudfront_distribution" "frontend" {
  count               = local.cdn_enabled ? 1 : 0
  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"
  price_class         = "PriceClass_100"
  comment             = "Punto Gamer: React y API del mismo dominio HTTPS"

  origin {
    origin_id                = "web"
    domain_name              = aws_s3_bucket.frontend[0].bucket_regional_domain_name
    origin_access_control_id = aws_cloudfront_origin_access_control.frontend[0].id
    s3_origin_config { origin_access_identity = "" }
  }
  origin {
    origin_id   = "api"
    domain_name = trimprefix(aws_apigatewayv2_api.application[0].api_endpoint, "https://")
    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }
  default_cache_behavior {
    target_origin_id           = "web"
    viewer_protocol_policy     = "redirect-to-https"
    allowed_methods            = ["GET", "HEAD", "OPTIONS"]
    cached_methods             = ["GET", "HEAD"]
    cache_policy_id            = local.cache_disabled_id
    response_headers_policy_id = aws_cloudfront_response_headers_policy.frontend[0].id
    compress                   = true
    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.spa[0].arn
    }
  }
  ordered_cache_behavior {
    path_pattern               = "/assets/*"
    target_origin_id           = "web"
    viewer_protocol_policy     = "redirect-to-https"
    allowed_methods            = ["GET", "HEAD", "OPTIONS"]
    cached_methods             = ["GET", "HEAD"]
    cache_policy_id            = local.cache_static_id
    response_headers_policy_id = aws_cloudfront_response_headers_policy.frontend[0].id
    compress                   = true
  }
  dynamic "ordered_cache_behavior" {
    for_each = ["/api/*", "/v2/*", "/bff/*", "/images/*", "/health"]
    content {
      path_pattern               = ordered_cache_behavior.value
      target_origin_id           = "api"
      viewer_protocol_policy     = "https-only"
      allowed_methods            = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
      cached_methods             = ["GET", "HEAD"]
      cache_policy_id            = local.cache_disabled_id
      origin_request_policy_id   = local.api_origin_policy_id
      response_headers_policy_id = aws_cloudfront_response_headers_policy.frontend[0].id
      compress                   = true
    }
  }
  restrictions {
    geo_restriction { restriction_type = "none" }
  }
  viewer_certificate { cloudfront_default_certificate = true }
  # Sin fallback global 401/403: las respuestas de autorizacion de las API se conservan.
  depends_on = [aws_s3_object.frontend, aws_apigatewayv2_stage.application]
}

resource "aws_s3_bucket_policy" "frontend" {
  count  = local.cdn_enabled ? 1 : 0
  bucket = aws_s3_bucket.frontend[0].id
  policy = jsonencode({ Version = "2012-10-17", Statement = [
    { Effect   = "Allow", Principal = { Service = "cloudfront.amazonaws.com" }, Action = "s3:GetObject",
      Resource = "${aws_s3_bucket.frontend[0].arn}/*",
    Condition = { StringEquals = { "AWS:SourceArn" = aws_cloudfront_distribution.frontend[0].arn } } },
    { Effect   = "Deny", Principal = "*", Action = "s3:*",
      Resource = [aws_s3_bucket.frontend[0].arn, "${aws_s3_bucket.frontend[0].arn}/*"],
    Condition = { Bool = { "aws:SecureTransport" = "false" } } }
  ] })
}
