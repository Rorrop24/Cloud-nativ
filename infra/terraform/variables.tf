variable "aws_account_id" {
  description = "Cuenta AWS donde se creara la infraestructura."
  type        = string

  validation {
    condition     = can(regex("^[0-9]{12}$", var.aws_account_id))
    error_message = "Indica un ID de cuenta AWS de 12 digitos."
  }
}

variable "aws_region" {
  description = "Region del despliegue."
  type        = string
  default     = "us-east-1"

  validation {
    condition     = can(regex("^[a-z]{2}(-[a-z]+)+-[0-9]+$", var.aws_region))
    error_message = "Indica una region AWS, por ejemplo us-east-1."
  }
}

variable "existing_instance_profile_name" {
  description = "Perfil IAM existente y autorizado para EC2. Null crea uno propio; usar LabInstanceProfile en el laboratorio."
  type        = string
  default     = null
  nullable    = true

  validation {
    condition     = var.existing_instance_profile_name == null ? true : can(regex("^[A-Za-z0-9_+=,.@-]{1,128}$", var.existing_instance_profile_name))
    error_message = "Indica el nombre del instance profile, no un ARN ni una ruta, o deja null."
  }
}

variable "availability_zone" {
  description = "Zona habilitada que ofrece instance_type. Null selecciona una compatible; fijar el valor evita cambios futuros de subred."
  type        = string
  default     = null
  nullable    = true

  validation {
    condition     = var.availability_zone == null ? true : can(regex("^${var.aws_region}[a-z]$", var.availability_zone))
    error_message = "Indica una zona estandar de aws_region, por ejemplo us-east-1a, o deja null."
  }
}

variable "project_name" {
  description = "Prefijo de nombres y etiquetas."
  type        = string
  default     = "punto-gamer"

  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{2,19}$", var.project_name))
    error_message = "Usa entre 3 y 20 caracteres: letras minusculas, numeros y guiones."
  }
}

variable "environment" {
  description = "Entorno del proyecto."
  type        = string
  default     = "dev"

  validation {
    condition     = contains(["dev", "test", "prod"], var.environment)
    error_message = "Los entornos validos son dev, test y prod."
  }
}

variable "instance_type" {
  description = "EC2 x86_64 con al menos 4 GiB para los tres contenedores."
  type        = string
  default     = "t3.medium"

  validation {
    condition     = can(regex("^t3a?\\.(medium|large|xlarge|2xlarge)$", var.instance_type))
    error_message = "Usa una instancia t3 o t3a medium o superior, compatible con x86_64."
  }
}

variable "ami_id" {
  description = "AMI Amazon Linux 2023 x86_64. Si se omite, se consulta la AMI oficial en SSM."
  type        = string
  default     = null
  nullable    = true

  validation {
    condition     = var.ami_id == null ? true : can(regex("^ami-([0-9a-f]{8}|[0-9a-f]{17})$", var.ami_id))
    error_message = "Indica un ID de AMI valido o deja null."
  }
}

variable "associate_public_ip_address" {
  description = "IP publica para salida por el IGW. Desactivar requiere agregar NAT/endpoints; no habilita entrada."
  type        = bool
  default     = true
}

variable "volume_size_gib" {
  description = "Disco gp3 cifrado para el sistema y los datos de RabbitMQ."
  type        = number
  default     = 40

  validation {
    condition     = var.volume_size_gib >= 30 && var.volume_size_gib <= 200 && floor(var.volume_size_gib) == var.volume_size_gib
    error_message = "El disco debe ser un entero entre 30 y 200 GiB."
  }
}

variable "rabbitmq_username" {
  description = "Usuario inicial del broker."
  type        = string
  default     = "levelup"

  validation {
    condition     = can(regex("^[a-zA-Z][a-zA-Z0-9_-]{2,31}$", var.rabbitmq_username)) && var.rabbitmq_username != "guest"
    error_message = "Usa un nombre de 3 a 32 caracteres; guest no esta permitido."
  }
}

variable "rabbitmq_vhost" {
  description = "Virtual host del proyecto; coincide con la configuracion actual del backend."
  type        = string
  default     = "levelup"

  validation {
    condition     = can(regex("^[a-zA-Z0-9_-]{1,64}$", var.rabbitmq_vhost))
    error_message = "Usa un nombre de virtual host de 1 a 64 letras, numeros, guiones o guiones bajos."
  }
}

variable "password_parameter_name" {
  description = "Nombre de un SecureString existente en SSM; nunca el valor de la password."
  type        = string
  default     = null

  validation {
    condition     = var.password_parameter_name == null ? true : can(regex("^/[a-zA-Z0-9_./-]+$", var.password_parameter_name))
    error_message = "Indica una ruta absoluta de Parameter Store, por ejemplo /punto-gamer/dev/rabbitmq/password."
  }
}

variable "cookie_parameter_name" {
  description = "Nombre de un SecureString existente que contiene la cookie Erlang del cluster."
  type        = string
  default     = null

  validation {
    condition     = var.cookie_parameter_name == null ? true : can(regex("^/[a-zA-Z0-9_./-]+$", var.cookie_parameter_name))
    error_message = "Indica una ruta absoluta de Parameter Store."
  }
}

variable "secrets_kms_key_arn" {
  description = "ARN KMS si los parametros usan una clave propia. Null para la clave administrada de SSM."
  type        = string
  default     = null

  validation {
    condition     = var.secrets_kms_key_arn == null ? true : can(regex("^arn:aws[a-z-]*:kms:[a-z0-9-]+:[0-9]{12}:key/[a-zA-Z0-9-]+$", var.secrets_kms_key_arn))
    error_message = "Indica el ARN de una clave KMS o deja null."
  }
}

variable "enable_database" {
  description = "Crear RDS MySQL privado para el backend. Genera costos; no migra datos de Oracle."
  type        = bool
  default     = false
}

variable "database_name" {
  type    = string
  default = "punto_gamer"

  validation {
    condition     = can(regex("^[A-Za-z][A-Za-z0-9_]{0,63}$", var.database_name))
    error_message = "Usa un nombre de base MySQL valido de hasta 64 caracteres."
  }
}

variable "database_username" {
  description = "Usuario inicial para crear el esquema. Separar migraciones y usuario limitado en produccion."
  type        = string
  default     = "punto_gamer"

  validation {
    condition     = can(regex("^[A-Za-z][A-Za-z0-9_]{0,15}$", var.database_username)) && !contains(["root", "admin", "mysql", "rdsadmin"], lower(var.database_username))
    error_message = "Usa un usuario MySQL de hasta 16 caracteres que no este reservado."
  }
}

variable "database_instance_class" {
  type    = string
  default = "db.t3.micro"

  validation {
    condition     = contains(["db.t3.micro", "db.t3.small", "db.t4g.micro", "db.t4g.small"], var.database_instance_class)
    error_message = "Usa una clase micro o small t3/t4g; su disponibilidad se consulta antes de crear RDS."
  }
}

variable "database_password_version" {
  description = "Version write-only de la password. No modificar sin un procedimiento de rotacion RDS/SSM/backend."
  type        = number
  default     = 1

  validation {
    condition     = var.database_password_version >= 1 && floor(var.database_password_version) == var.database_password_version
    error_message = "La version de password debe ser un entero positivo."
  }
}

variable "database_password" {
  description = "Credencial efimera cargada desde SSM por Deploy-Database.ps1; no escribir en tfvars ni mostrar en consola."
  type        = string
  sensitive   = true
  ephemeral   = true
  nullable    = true
  default     = null

  validation {
    condition     = var.enable_database ? (var.database_password == null ? false : can(regex("^[A-Za-z0-9]{32,41}$", var.database_password))) : true
    error_message = "Ejecuta infra/deploy/Deploy-Database.ps1 para cargar la credencial segura de RDS desde SSM."
  }
}

variable "database_deletion_protection" {
  description = "Protege la BD ante destroy; desactivar solo tras respaldar y revisar el plan."
  type        = bool
  default     = true
}
