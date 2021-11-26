terraform {
  backend "remote" {
    hostname = "app.terraform.io"
    organization = "VargasArts"
    workspaces {
      prefix = "roamjs-developer"
    }
  }
  required_providers {
    github = {
      source = "integrations/github"
      version = "4.2.0"
    }
  }
}

variable "aws_access_token" {
  type = string
}

variable "aws_secret_token" {
  type = string
}

variable "developer_token" {
  type = string
}

variable "github_token" {
  type = string
}

variable "stripe_secret" {
    type = string
}

variable "encryption_secret" {
  type = string
}

provider "aws" {
  region = "us-east-1"
  access_key = var.aws_access_token
  secret_key = var.aws_secret_token
}

provider "github" {
    owner = "dvargas92495"
    token = var.github_token
}

module "roamjs_lambda" {
  source = "dvargas92495/lambda/roamjs"
  providers = {
    aws = aws
    github = github
  }

  name = "developer"
  lambdas = [
    { 
      path = "developer-path", 
      method = "get"
    },
    { 
      path = "developer-path", 
      method = "post"
    },
    { 
      path = "developer-path", 
      method = "put"
    },
    { 
      path = "developer-path", 
      method = "delete"
    },
    { 
      path = "developer-token", 
      method = "put"
    },
  ]
  aws_access_token = var.aws_access_token
  aws_secret_token = var.aws_secret_token
  github_token     = var.github_token
  developer_token  = var.developer_token
}

resource "github_actions_secret" "stripe_secret" {
  repository       = "roamjs-developer"
  secret_name      = "STRIPE_SECRET_KEY"
  plaintext_value  = var.stripe_secret
}

resource "github_actions_secret" "encryption_secret" {
  repository       = "roam-js-extensions"
  secret_name      = "ENCRYPTION_SECRET"
  plaintext_value  = var.encryption_secret
}
