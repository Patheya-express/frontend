terraform {
  required_version = ">= 1.7.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Bucket/key deliberately omitted — supplied at `terraform init` time via
  # -backend-config so no state-bucket name is ever committed. See
  # infrastructure/terraform/README.md.
  backend "s3" {
    region  = "us-east-1"
    encrypt = true
  }
}
