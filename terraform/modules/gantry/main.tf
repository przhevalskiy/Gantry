resource "helm_release" "gantry" {
  name             = var.release_name
  namespace        = var.namespace
  chart            = var.chart_path
  create_namespace = true

  values = [
    yamlencode({
      replicaCount = {
        api    = var.api_replicas
        worker = var.worker_replicas
      }
      database = {
        url = var.database_url
      }
      agentex = {
        baseUrl = var.agentex_base_url
      }
      temporal = {
        address = var.temporal_address
      }
      ingress = {
        enabled = var.ingress_enabled
        host    = var.ingress_host
      }
      env = {
        GANTRY_SECRETS_KEY       = var.secrets_key
        GANTRY_BOOTSTRAP_TOKEN   = var.bootstrap_token
      }
    }),
  ]
}
