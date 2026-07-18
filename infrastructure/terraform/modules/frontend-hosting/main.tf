locals {
  # "" -> customer.patheyaexpress.example ; "dev" -> dev.customer.patheyaexpress.example
  subdomains = {
    for app in var.apps :
    app => var.subdomain_prefix == "" ? "${app}.${var.domain_name}" : "${var.subdomain_prefix}.${app}.${var.domain_name}"
  }
}

resource "aws_route53_record" "app" {
  for_each = local.subdomains

  zone_id = var.route53_zone_id
  name    = each.value
  type    = "CNAME"
  ttl     = 300
  records = [var.ingress_hostname]
}

# One certificate covering all four app subdomains for this environment,
# rather than four separate certs — matches how the nginx Ingress
# controller terminates TLS per-host off a shared cert list.
resource "aws_acm_certificate" "app" {
  domain_name               = local.subdomains[var.apps[0]]
  subject_alternative_names = [for app in slice(var.apps, 1, length(var.apps)) : local.subdomains[app]]
  validation_method         = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = {
    Environment = var.environment
    ManagedBy   = "terraform"
    Project     = "patheya-express-frontend"
  }
}

resource "aws_route53_record" "cert_validation" {
  for_each = {
    for dvo in aws_acm_certificate.app.domain_validation_options :
    dvo.domain_name => {
      name   = dvo.resource_record_name
      type   = dvo.resource_record_type
      record = dvo.resource_record_value
    }
  }

  zone_id = var.route53_zone_id
  name    = each.value.name
  type    = each.value.type
  ttl     = 300
  records = [each.value.record]
}

resource "aws_acm_certificate_validation" "app" {
  certificate_arn         = aws_acm_certificate.app.arn
  validation_record_fqdns = [for r in aws_route53_record.cert_validation : r.fqdn]
}
