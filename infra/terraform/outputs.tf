output "instance_id" {
  description = "ID de la EC2 para AWS Systems Manager."
  value       = aws_instance.rabbitmq.id
}

output "private_ip" {
  description = "IP privada del broker en la VPC."
  value       = aws_instance.rabbitmq.private_ip
}

output "rabbitmq_security_group_id" {
  description = "Security group creado para RabbitMQ."
  value       = aws_security_group.rabbitmq.id
}

output "backend_environment" {
  description = "Variables no secretas para conectar Spring Boot por la red privada."
  value = {
    RABBITMQ_ADDRESSES     = join(",", [for port in local.amqp_ports : "${aws_instance.rabbitmq.private_ip}:${port}"])
    RABBITMQ_USERNAME      = var.rabbitmq_username
    RABBITMQ_VHOST         = var.rabbitmq_vhost
    RABBITMQ_PASSWORD_PATH = local.password_path
  }
}

output "required_ssm_parameters" {
  description = "SecureString que deben existir antes del arranque. Sus valores no se leen con Terraform."
  value = {
    password      = local.password_path
    erlang_cookie = local.cookie_path
  }
}

output "management_tunnel_command" {
  description = "Tunel local al dashboard; requiere AWS CLI v2 y Session Manager Plugin."
  value       = "aws ssm start-session --region ${var.aws_region} --target ${aws_instance.rabbitmq.id} --document-name AWS-StartPortForwardingSession --parameters '{\"portNumber\":[\"15672\"],\"localPortNumber\":[\"15672\"]}'"
}
