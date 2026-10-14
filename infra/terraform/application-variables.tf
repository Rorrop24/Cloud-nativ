variable "enable_application" {
  description = "Desplegar React, API Gateway, ALB interno y EC2 Backend/BFF. Usar Deploy-Project.ps1."
  type        = bool
  default     = false
}

variable "enable_cdn" {
  description = "CloudFront/S3 opcionales. False sirve React por HTTPS via API Gateway para Learner Lab."
  type        = bool
  default     = false
}

variable "application_release_bucket_name" {
  description = "Bucket privado existente. Learner Lab lo prepara con Deploy-Project.ps1 sin consultar Object Lock."
  type        = string
  default     = null
  validation {
    condition     = var.application_release_bucket_name == null ? true : can(regex("^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$", var.application_release_bucket_name))
    error_message = "Indica un nombre de bucket S3 valido."
  }
}

variable "application_artifact_path" {
  description = "ZIP generado por Build-Project.ps1, sin wallets ni credenciales."
  type        = string
  default     = null
  validation {
    condition     = !var.enable_application || (var.application_artifact_path == null ? false : fileexists(var.application_artifact_path))
    error_message = "Construye el ZIP de aplicacion con Build-Project.ps1 antes de planificar."
  }
}

variable "frontend_dist_path" {
  description = "Directorio React dist generado para usar API del mismo dominio."
  type        = string
  default     = null
  validation {
    condition     = !var.enable_application || (var.frontend_dist_path == null ? false : fileexists("${var.frontend_dist_path}/index.html"))
    error_message = "Construye el frontend con Build-Project.ps1 antes de planificar."
  }
}

variable "application_instance_type" {
  type    = string
  default = "t3.medium"
  validation {
    condition     = can(regex("^t3a?\\.(medium|large|xlarge|2xlarge)$", var.application_instance_type))
    error_message = "Backend y BFF necesitan una t3/t3a medium o superior."
  }
}

variable "azure_tenant_id" {
  type    = string
  default = "a5af7e18-9965-418a-9b8a-a0dd9bd96c52"
  validation {
    condition     = can(regex("^[0-9a-fA-F]{8}(-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}$", var.azure_tenant_id))
    error_message = "Indica el tenant ID de Azure como UUID."
  }
}

variable "azure_frontend_client_id" {
  type    = string
  default = "9870c4b1-0353-4eb0-8e1d-812cb76676b5"
  validation {
    condition     = can(regex("^[0-9a-fA-F]{8}(-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}$", var.azure_frontend_client_id))
    error_message = "Indica el client ID publico de la SPA como UUID."
  }
}

variable "azure_api_audience" {
  type    = string
  default = "ae706c64-5e56-4573-b311-b2919b52c67a"
  validation {
    condition     = can(regex("^[0-9a-fA-F]{8}(-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}$", var.azure_api_audience))
    error_message = "Indica la audiencia v2 de la API Azure como UUID."
  }
}
