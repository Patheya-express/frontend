output "subdomains" {
  description = "Map of app name to its fully-qualified subdomain."
  value       = local.subdomains
}

output "certificate_arn" {
  description = "ARN of the validated ACM certificate covering all four subdomains — reference this from the Ingress controller / AWS Load Balancer Controller config if terminating TLS at the LB instead of nginx-ingress + cert-manager."
  value       = aws_acm_certificate_validation.app.certificate_arn
}
