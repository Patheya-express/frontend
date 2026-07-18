variable "aws_region" {
  description = "AWS region the Route53 zone and ACM certificate are managed in (ACM certs used by an ALB/nginx-ingress must be in the same region as the load balancer)."
  type        = string
  default     = "us-east-1"
}

variable "route53_zone_id" {
  description = "Hosted zone ID for the root domain, provisioned outside this module."
  type        = string
}

variable "domain_name" {
  description = "Root domain, e.g. patheyaexpress.example."
  type        = string
}

variable "ingress_hostname" {
  description = "Load balancer hostname of the cluster's nginx Ingress controller."
  type        = string
}
