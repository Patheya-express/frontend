provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Environment = "staging"
      ManagedBy   = "terraform"
      Project     = "patheya-express-frontend"
    }
  }
}
