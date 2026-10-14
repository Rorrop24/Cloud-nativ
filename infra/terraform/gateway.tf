locals {
  edge_secondary_zone = try([for zone in local.compatible_availability_zones : zone if zone != local.selected_availability_zone][0], null)
}

resource "aws_subnet" "edge_secondary" {
  count                   = var.enable_application ? 1 : 0
  vpc_id                  = aws_vpc.main.id
  availability_zone       = local.edge_secondary_zone
  cidr_block              = "10.0.2.0/24"
  map_public_ip_on_launch = true
  tags                    = { Name = "${var.project_name}-${var.environment}-edge-secondary" }
  lifecycle {
    precondition {
      condition     = local.edge_secondary_zone != null
      error_message = "El ALB requiere dos zonas habilitadas distintas."
    }
  }
}

resource "aws_route_table_association" "edge_secondary" {
  count          = var.enable_application ? 1 : 0
  subnet_id      = aws_subnet.edge_secondary[0].id
  route_table_id = aws_route_table.public.id
}

resource "aws_security_group" "gateway_link" {
  count       = var.enable_application ? 1 : 0
  name_prefix = "${var.project_name}-${var.environment}-vpc-link-"
  vpc_id      = aws_vpc.main.id
  description = "VPC Link: sin entrada; salida solo hacia ALB"
}

resource "aws_security_group" "application_alb" {
  count       = var.enable_application ? 1 : 0
  name_prefix = "${var.project_name}-${var.environment}-alb-"
  vpc_id      = aws_vpc.main.id
  description = "ALB interno: solo VPC Link"
}

resource "aws_vpc_security_group_ingress_rule" "alb" {
  count                        = var.enable_application ? 1 : 0
  security_group_id            = aws_security_group.application_alb[0].id
  referenced_security_group_id = aws_security_group.gateway_link[0].id
  ip_protocol                  = "tcp"
  from_port                    = 80
  to_port                      = 80
}

resource "aws_vpc_security_group_egress_rule" "gateway_link" {
  count                        = var.enable_application ? 1 : 0
  security_group_id            = aws_security_group.gateway_link[0].id
  referenced_security_group_id = aws_security_group.application_alb[0].id
  ip_protocol                  = "tcp"
  from_port                    = 80
  to_port                      = 80
}

resource "aws_vpc_security_group_egress_rule" "alb" {
  count                        = var.enable_application ? 1 : 0
  security_group_id            = aws_security_group.application_alb[0].id
  referenced_security_group_id = aws_security_group.backend.id
  ip_protocol                  = "tcp"
  from_port                    = 8080
  to_port                      = 8080
}

resource "aws_vpc_security_group_ingress_rule" "application" {
  count                        = var.enable_application ? 1 : 0
  security_group_id            = aws_security_group.backend.id
  referenced_security_group_id = aws_security_group.application_alb[0].id
  ip_protocol                  = "tcp"
  from_port                    = 8080
  to_port                      = 8080
}

resource "aws_lb" "application" {
  count                      = var.enable_application ? 1 : 0
  name                       = "${var.project_name}-${var.environment}-app"
  internal                   = true
  load_balancer_type         = "application"
  security_groups            = [aws_security_group.application_alb[0].id]
  subnets                    = [aws_subnet.public.id, aws_subnet.edge_secondary[0].id]
  drop_invalid_header_fields = true
  depends_on                 = [aws_route_table_association.edge_secondary]
}

resource "aws_lb_target_group" "application" {
  count       = var.enable_application ? 1 : 0
  name_prefix = "pgapp-"
  vpc_id      = aws_vpc.main.id
  port        = 8080
  protocol    = "HTTP"
  target_type = "instance"
  health_check {
    path                = "/health"
    matcher             = "200"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }
}

resource "aws_lb_listener" "application" {
  count             = var.enable_application ? 1 : 0
  load_balancer_arn = aws_lb.application[0].arn
  port              = 80
  protocol          = "HTTP"
  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.application[0].arn
  }
}

resource "aws_lb_target_group_attachment" "application" {
  count            = var.enable_application ? 1 : 0
  target_group_arn = aws_lb_target_group.application[0].arn
  target_id        = aws_instance.application[0].id
  port             = 8080
}

resource "aws_apigatewayv2_vpc_link" "application" {
  count              = var.enable_application ? 1 : 0
  name               = "${local.application_name}-link"
  security_group_ids = [aws_security_group.gateway_link[0].id]
  subnet_ids         = [aws_subnet.public.id, aws_subnet.edge_secondary[0].id]
}

resource "aws_apigatewayv2_api" "application" {
  count         = var.enable_application ? 1 : 0
  name          = local.application_name
  protocol_type = "HTTP"
}

resource "aws_apigatewayv2_integration" "application" {
  count                  = var.enable_application ? 1 : 0
  api_id                 = aws_apigatewayv2_api.application[0].id
  integration_type       = "HTTP_PROXY"
  integration_method     = "ANY"
  integration_uri        = aws_lb_listener.application[0].arn
  connection_type        = "VPC_LINK"
  connection_id          = aws_apigatewayv2_vpc_link.application[0].id
  payload_format_version = "1.0"
  request_parameters     = { "overwrite:path" = "$request.path" }
}

resource "aws_apigatewayv2_route" "application" {
  for_each  = var.enable_application ? toset(["ANY /{proxy+}", "ANY /"]) : toset([])
  api_id    = aws_apigatewayv2_api.application[0].id
  route_key = each.key
  target    = "integrations/${aws_apigatewayv2_integration.application[0].id}"
  # La autorizacion JWT sigue siendo estricta en ambos servicios Spring.
}

resource "aws_apigatewayv2_stage" "application" {
  count       = var.enable_application ? 1 : 0
  api_id      = aws_apigatewayv2_api.application[0].id
  name        = "$default"
  auto_deploy = true
  default_route_settings {
    throttling_burst_limit = 50
    throttling_rate_limit  = 25
  }
}
