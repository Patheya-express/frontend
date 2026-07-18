variable "environment" {
  description = "Environment name (development, staging, production) — used for resource tagging only."
  type        = string

  validation {
    condition     = contains(["development", "staging", "production"], var.environment)
    error_message = "environment must be one of: development, staging, production."
  }
}

variable "route53_zone_id" {
  description = "Hosted zone ID for the root domain (e.g. patheyaexpress.example), already provisioned outside this module."
  type        = string
}

variable "domain_name" {
  description = "Root domain the four subdomains are created under, e.g. patheyaexpress.example."
  type        = string
}

variable "subdomain_prefix" {
  description = "Prepended to each app's subdomain, separated by a dot (e.g. \"dev\" -> dev.customer.<domain_name>). Empty string for production's bare subdomains."
  type        = string
  default     = ""
}

variable "ingress_hostname" {
  description = "Hostname of the cluster's Ingress controller load balancer (from `kubectl get svc -n ingress-nginx ingress-nginx-controller`), which every app subdomain CNAMEs to."
  type        = string
}

variable "apps" {
  description = "Frontend apps to create a subdomain + certificate SAN for — must match infrastructure/kubernetes's app names."
  type        = list(string)
  default     = ["customer", "restaurant", "admin", "delivery"]
}
