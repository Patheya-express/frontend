module "frontend_hosting" {
  source = "../../modules/frontend-hosting"

  environment      = "production"
  route53_zone_id  = var.route53_zone_id
  domain_name      = var.domain_name
  subdomain_prefix = ""
  ingress_hostname = var.ingress_hostname
}

output "subdomains" {
  value = module.frontend_hosting.subdomains
}

output "certificate_arn" {
  value = module.frontend_hosting.certificate_arn
}
