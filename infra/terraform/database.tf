data "aws_rds_engine_version" "mysql" {
  count                  = var.enable_database ? 1 : 0
  engine                 = "mysql"
  parameter_group_family = "mysql8.4"
  latest                 = true
}

data "aws_rds_orderable_db_instance" "mysql" {
  count                       = var.enable_database ? 1 : 0
  engine                      = "mysql"
  engine_version              = data.aws_rds_engine_version.mysql[0].version_actual
  preferred_instance_classes  = [var.database_instance_class]
  storage_type                = "gp3"
  supports_storage_encryption = true
  vpc                         = true
}

locals {
  database_availability_zones = var.enable_database ? sort(tolist(setintersection(
    toset(data.aws_availability_zones.available.names),
    toset(data.aws_rds_orderable_db_instance.mysql[0].availability_zones),
  ))) : []
  database_password_path = "/${var.project_name}/${var.environment}/database/password"
}

resource "aws_subnet" "database" {
  for_each = var.enable_database ? { primary = 0, secondary = 1 } : {}

  vpc_id                  = aws_vpc.main.id
  availability_zone       = try(local.database_availability_zones[each.value], local.selected_availability_zone)
  cidr_block              = cidrsubnet(aws_vpc.main.cidr_block, 8, 10 + each.value)
  map_public_ip_on_launch = false
  tags                    = { Name = "${var.project_name}-${var.environment}-database-${each.key}" }
}

resource "aws_route_table" "database" {
  count  = var.enable_database ? 1 : 0
  vpc_id = aws_vpc.main.id
  tags   = { Name = "${var.project_name}-${var.environment}-database" }
}

resource "aws_route_table_association" "database" {
  for_each = aws_subnet.database

  subnet_id      = each.value.id
  route_table_id = aws_route_table.database[0].id
}

resource "aws_db_subnet_group" "mysql" {
  count      = var.enable_database ? 1 : 0
  name       = "${var.project_name}-${var.environment}-mysql"
  subnet_ids = [for subnet in aws_subnet.database : subnet.id]

  lifecycle {
    precondition {
      condition     = length(local.database_availability_zones) >= 2 && data.aws_rds_orderable_db_instance.mysql[0].instance_class == var.database_instance_class
      error_message = "RDS necesita dos zonas habilitadas y la clase MySQL indicada debe estar disponible; no se elige una clase mas costosa automaticamente."
    }
  }
}

resource "aws_security_group" "database" {
  count       = var.enable_database ? 1 : 0
  name_prefix = "${var.project_name}-${var.environment}-mysql-"
  description = "RDS MySQL privado; entrada solo desde el backend"
  vpc_id      = aws_vpc.main.id
  tags        = { Name = "${var.project_name}-${var.environment}-mysql" }
}

resource "aws_vpc_security_group_ingress_rule" "database" {
  count                        = var.enable_database ? 1 : 0
  security_group_id            = aws_security_group.database[0].id
  referenced_security_group_id = aws_security_group.backend.id
  ip_protocol                  = "tcp"
  from_port                    = 3306
  to_port                      = 3306
  description                  = "MySQL desde la EC2 de aplicacion"
}

resource "aws_db_parameter_group" "mysql" {
  count       = var.enable_database ? 1 : 0
  name_prefix = "${var.project_name}-${var.environment}-mysql-"
  family      = "mysql8.4"

  parameter {
    name  = "require_secure_transport"
    value = "1"
  }

  lifecycle {
    create_before_destroy = true
  }
}

# Deploy-Database.ps1 reutiliza el SecureString y pasa una variable efimera.
resource "random_id" "database_snapshot" {
  count       = var.enable_database ? 1 : 0
  byte_length = 4
}

resource "aws_db_instance" "mysql" {
  count                        = var.enable_database ? 1 : 0
  identifier                   = "${var.project_name}-${var.environment}-mysql"
  engine                       = "mysql"
  engine_version               = data.aws_rds_engine_version.mysql[0].version_actual
  instance_class               = var.database_instance_class
  db_name                      = var.database_name
  username                     = var.database_username
  password_wo                  = var.database_password
  password_wo_version          = var.database_password_version
  port                         = 3306
  allocated_storage            = 20
  max_allocated_storage        = 50
  storage_type                 = "gp3"
  storage_encrypted            = true
  publicly_accessible          = false
  multi_az                     = false
  db_subnet_group_name         = aws_db_subnet_group.mysql[0].name
  vpc_security_group_ids       = [aws_security_group.database[0].id]
  parameter_group_name         = aws_db_parameter_group.mysql[0].name
  backup_retention_period      = 7
  auto_minor_version_upgrade   = true
  allow_major_version_upgrade  = false
  apply_immediately            = false
  deletion_protection          = var.database_deletion_protection
  skip_final_snapshot          = false
  final_snapshot_identifier    = "${var.project_name}-${var.environment}-mysql-final-${random_id.database_snapshot[0].hex}"
  copy_tags_to_snapshot        = true
  monitoring_interval          = 0
  performance_insights_enabled = false
  tags                         = { Name = "${var.project_name}-${var.environment}-mysql" }

  depends_on = [aws_route_table_association.database, aws_vpc_security_group_ingress_rule.database]
}
