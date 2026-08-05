output "release_name" {
  description = "Helm release name"
  value       = helm_release.gantry.name
}

output "namespace" {
  description = "Kubernetes namespace"
  value       = helm_release.gantry.namespace
}

output "api_service" {
  description = "In-cluster API service DNS name"
  value       = "${var.release_name}-gantry-api.${var.namespace}.svc.cluster.local"
}

output "api_port" {
  description = "Gantry API port"
  value       = 8001
}
