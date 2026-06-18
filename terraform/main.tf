# 54Bank Infrastructure as Code
# AWS EKS + RDS + ElastiCache + MSK

terraform {
  required_version = ">= 1.5"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket         = "54bank-terraform-state"
    key            = "infrastructure/terraform.tfstate"
    region         = "eu-west-1"
    encrypt        = true
    dynamodb_table = "54bank-terraform-locks"
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "54Bank"
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  }
}

# ─── Variables ───────────────────────────────────────────
variable "aws_region" {
  default = "eu-west-1"
}

variable "environment" {
  default = "staging"
}

variable "vpc_cidr" {
  default = "10.0.0.0/16"
}

variable "db_instance_class" {
  default = "db.r6g.large"
}

variable "eks_node_instance_type" {
  default = "m6i.xlarge"
}

# ─── VPC ─────────────────────────────────────────────────
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 5.0"

  name = "54bank-${var.environment}"
  cidr = var.vpc_cidr

  azs             = ["${var.aws_region}a", "${var.aws_region}b", "${var.aws_region}c"]
  private_subnets = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
  public_subnets  = ["10.0.101.0/24", "10.0.102.0/24", "10.0.103.0/24"]

  enable_nat_gateway = true
  single_nat_gateway = var.environment != "production"

  tags = { Name = "54bank-vpc-${var.environment}" }
}

# ─── EKS Cluster ─────────────────────────────────────────
module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "~> 20.0"

  cluster_name    = "54bank-${var.environment}"
  cluster_version = "1.29"

  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.private_subnets

  eks_managed_node_groups = {
    core = {
      instance_types = [var.eks_node_instance_type]
      min_size       = 2
      max_size       = 10
      desired_size   = 3
    }
  }

  cluster_endpoint_public_access = var.environment != "production"
}

# ─── RDS PostgreSQL ──────────────────────────────────────
module "rds" {
  source  = "terraform-aws-modules/rds/aws"
  version = "~> 6.0"

  identifier = "54bank-${var.environment}"

  engine               = "postgres"
  engine_version       = "16.2"
  family               = "postgres16"
  major_engine_version = "16"
  instance_class       = var.db_instance_class

  allocated_storage     = 100
  max_allocated_storage = 1000
  storage_encrypted     = true

  db_name  = "bank54_db"
  username = "bank54_admin"
  port     = 5432

  multi_az               = var.environment == "production"
  db_subnet_group_name   = module.vpc.database_subnet_group_name
  vpc_security_group_ids = [aws_security_group.rds.id]

  backup_retention_period = var.environment == "production" ? 35 : 7
  deletion_protection     = var.environment == "production"

  performance_insights_enabled = true
}

# ─── ElastiCache Redis ───────────────────────────────────
resource "aws_elasticache_cluster" "redis" {
  cluster_id           = "54bank-${var.environment}"
  engine               = "redis"
  node_type            = "cache.r6g.large"
  num_cache_nodes      = 1
  parameter_group_name = "default.redis7"
  port                 = 6379
  subnet_group_name    = aws_elasticache_subnet_group.redis.name
  security_group_ids   = [aws_security_group.redis.id]
}

resource "aws_elasticache_subnet_group" "redis" {
  name       = "54bank-redis-${var.environment}"
  subnet_ids = module.vpc.private_subnets
}

# ─── Security Groups ────────────────────────────────────
resource "aws_security_group" "rds" {
  name_prefix = "54bank-rds-"
  vpc_id      = module.vpc.vpc_id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [module.eks.cluster_security_group_id]
  }
}

resource "aws_security_group" "redis" {
  name_prefix = "54bank-redis-"
  vpc_id      = module.vpc.vpc_id

  ingress {
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [module.eks.cluster_security_group_id]
  }
}

# ─── Outputs ─────────────────────────────────────────────
output "eks_cluster_endpoint" {
  value = module.eks.cluster_endpoint
}

output "rds_endpoint" {
  value = module.rds.db_instance_endpoint
}

output "redis_endpoint" {
  value = aws_elasticache_cluster.redis.cache_nodes[0].address
}

output "vpc_id" {
  value = module.vpc.vpc_id
}
