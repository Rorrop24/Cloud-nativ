# AWS simulado; la password de ejemplo es efimera y no es una credencial real.
mock_provider "aws" {
  mock_data "aws_availability_zones" {
    defaults = { names = ["us-east-1a", "us-east-1c"] }
  }
  mock_data "aws_ec2_instance_type_offerings" {
    defaults = { locations = ["us-east-1a", "us-east-1c"] }
  }
  mock_data "aws_rds_engine_version" {
    defaults = { version_actual = "8.4.4" }
  }
  mock_data "aws_rds_orderable_db_instance" {
    defaults = {
      availability_zones = ["us-east-1a", "us-east-1c"]
      instance_class     = "db.t3.micro"
    }
  }
  mock_data "aws_partition" {
    defaults = { partition = "aws" }
  }
  mock_data "aws_ssm_parameter" {
    defaults = { value = "ami-0123456789abcdef0" }
  }
  mock_resource "aws_db_instance" {
    defaults = { address = "punto-gamer.test.rds.amazonaws.com" }
  }
}

variables {
  aws_account_id                 = "123456789012"
  existing_instance_profile_name = "LabInstanceProfile"
  enable_database                = true
  availability_zone              = "us-east-1a"
  database_password              = "PasswordForTestsOnly0123456789ABCD"
}

run "private_mysql_database" {
  command = apply

  assert {
    condition     = !aws_db_instance.mysql[0].publicly_accessible && aws_db_instance.mysql[0].storage_encrypted && aws_db_instance.mysql[0].deletion_protection && !aws_db_instance.mysql[0].skip_final_snapshot && aws_db_instance.mysql[0].backup_retention_period == 7
    error_message = "RDS debe ser privado, cifrado, protegido ante borrado y con backups/snapshot final."
  }
  assert {
    condition     = length(aws_subnet.database) == 2 && length(toset([for subnet in aws_subnet.database : subnet.availability_zone])) == 2 && alltrue([for subnet in aws_subnet.database : !subnet.map_public_ip_on_launch && subnet.vpc_id == aws_vpc.main.id])
    error_message = "La BD necesita dos subredes privadas en zonas diferentes de la VPC."
  }
  assert {
    condition     = length(aws_route_table.database[0].route) == 0 && aws_vpc_security_group_ingress_rule.database[0].referenced_security_group_id == aws_security_group.backend.id && aws_vpc_security_group_ingress_rule.database[0].from_port == 3306 && aws_vpc_security_group_ingress_rule.database[0].to_port == 3306 && aws_vpc_security_group_ingress_rule.database[0].cidr_ipv4 == null
    error_message = "Las subredes DB no deben tener ruta IGW; MySQL solo permite al grupo del backend."
  }
  assert {
    condition     = aws_db_instance.mysql[0].password_wo_version == var.database_password_version && aws_db_instance.mysql[0].password == null && aws_db_instance.mysql[0].password_wo == null
    error_message = "La password debe usar atributos write-only, no almacenarse en el estado."
  }
  assert {
    condition     = output.database_environment.SPRING_PROFILES_ACTIVE == "aws" && strcontains(output.database_environment.DB_URL, "sslMode=VERIFY_IDENTITY") && output.database_environment.DB_PASSWORD_PATH == "/punto-gamer/dev/database/password" && !contains(keys(output.database_environment), "DB_PASSWORD")
    error_message = "Los outputs deben contener TLS y ruta de secreto, nunca el valor de la password."
  }
}

run "database_can_be_disabled" {
  command = plan
  variables { enable_database = false }
  assert {
    condition     = length(aws_db_instance.mysql) == 0 && length(aws_subnet.database) == 0 && output.database_environment == null
    error_message = "Desactivar el modulo no debe mantener recursos RDS en la configuracion."
  }
}

run "reject_single_database_zone" {
  command = plan
  override_data {
    target = data.aws_rds_orderable_db_instance.mysql[0]
    values = {
      availability_zones = ["us-east-1a"]
      instance_class     = "db.t3.micro"
    }
  }
  expect_failures = [aws_db_subnet_group.mysql]
}

run "reject_database_without_ephemeral_password" {
  command = plan
  variables { database_password = null }
  expect_failures = [var.database_password]
}

run "reject_oversized_mysql_password" {
  command = plan
  variables {
    database_password = "0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF"
  }
  expect_failures = [var.database_password]
}
