variable "release_name" {
  description = "Helm release name for Gantry"
  type        = string
  default     = "gantry"
}

variable "namespace" {
  description = "Kubernetes namespace"
  type        = string
  default     = "gantry"
}

variable "chart_path" {
  description = "Local path to deploy/helm/gantry chart"
  type        = string
  default     = "../../../deploy/helm/gantry"
}

variable "database_url" {
  description = "PostgreSQL connection string for Gantry control plane"
  type        = string
  sensitive   = true
}

variable "agentex_base_url" {
  description = "Agentex API base URL"
  type        = string
}

variable "temporal_address" {
  description = "Temporal frontend address"
  type        = string
  default     = "temporal:7233"
}

variable "api_replicas" {
  type    = number
  default = 1
}

variable "worker_replicas" {
  type    = number
  default = 2
}

variable "ingress_host" {
  description = "Public hostname for the Gantry API"
  type        = string
  default     = ""
}

variable "ingress_enabled" {
  type    = bool
  default = false
}

variable "secrets_key" {
  description = "Fernet key for org secrets encryption"
  type        = string
  sensitive   = true
  default     = ""
}

variable "bootstrap_token" {
  description = "One-time token for initial API key creation"
  type        = string
  sensitive   = true
  default     = ""
}
