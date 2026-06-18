# 54Bank Infrastructure — Terraform
terraform {
  required_version = ">= 1.5"
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 5.0" }
  }
  backend "s3" {
    bucket = "54bank-terraform-state"
    key    = "infrastructure/terraform.tfstate"
    region = "af-south-1"
    encrypt = true
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

# VPC
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 5.0"
  name    = "54bank-${var.environment}"
  cidr    = var.vpc_cidr
  azs     = var.availability_zones
  private_subnets  = var.private_subnets
  public_subnets   = var.public_subnets
  database_subnets = var.database_subnets
  enable_nat_gateway   = true
  single_nat_gateway   = var.environment != "production"
  enable_dns_hostnames = true
  enable_dns_support   = true
}

# EKS
module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "~> 20.0"
  cluster_name    = "54bank-${var.environment}"
  cluster_version = "1.29"
  vpc_id          = module.vpc.vpc_id
  subnet_ids      = module.vpc.private_subnets
  cluster_endpoint_public_access = var.environment != "production"
  eks_managed_node_groups = {
    general = {
      instance_types = var.node_instance_types
      min_size     = var.min_nodes
      max_size     = var.max_nodes
      desired_size = var.desired_nodes
    }
  }
}

# RDS PostgreSQL
module "rds" {
  source  = "terraform-aws-modules/rds/aws"
  version = "~> 6.0"
  identifier = "54bank-${var.environment}"
  engine     = "postgres"
  engine_version = "15.4"
  instance_class = var.db_instance_class
  allocated_storage     = var.db_storage_gb
  max_allocated_storage = var.db_max_storage_gb
  db_name  = "bank54_db"
  username = "bank54_admin"
  port     = 5432
  multi_az = var.environment == "production"
  vpc_security_group_ids = [module.vpc.default_security_group_id]
  subnet_ids             = module.vpc.database_subnets
  backup_retention_period = var.environment == "production" ? 30 : 7
  deletion_protection     = var.environment == "production"
  performance_insights_enabled = true
  monitoring_interval          = 60
}

# ElastiCache Redis
resource "aws_elasticache_replication_group" "redis" {
  replication_group_id = "54bank-${var.environment}"
  description          = "54Bank Redis cluster"
  node_type            = var.redis_node_type
  num_cache_clusters   = var.environment == "production" ? 3 : 1
  port                 = 6379
  subnet_group_name    = aws_elasticache_subnet_group.redis.name
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  automatic_failover_enabled = var.environment == "production"
}

resource "aws_elasticache_subnet_group" "redis" {
  name       = "54bank-redis-${var.environment}"
  subnet_ids = module.vpc.private_subnets
}

# MSK (Kafka)
resource "aws_msk_cluster" "kafka" {
  cluster_name           = "54bank-${var.environment}"
  kafka_version          = "3.6.0"
  number_of_broker_nodes = var.environment == "production" ? 3 : 1
  broker_node_group_info {
    instance_type   = var.kafka_instance_type
    client_subnets  = module.vpc.private_subnets
    storage_info {
      ebs_storage_info { volume_size = var.kafka_storage_gb }
    }
  }
  encryption_info {
    encryption_in_transit { client_broker = "TLS" }
    encryption_at_rest_kms_key_arn = aws_kms_key.main.arn
  }
}

# KMS Key for encryption at rest
resource "aws_kms_key" "main" {
  description         = "54Bank encryption key"
  enable_key_rotation = true
}

# S3 for data lake
resource "aws_s3_bucket" "data_lake" {
  bucket = "54bank-datalake-${var.environment}"
}

resource "aws_s3_bucket_server_side_encryption_configuration" "data_lake" {
  bucket = aws_s3_bucket.data_lake.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.main.arn
    }
  }
}

output "eks_cluster_endpoint" { value = module.eks.cluster_endpoint }
output "rds_endpoint"         { value = module.rds.db_instance_endpoint }
output "redis_endpoint"       { value = aws_elasticache_replication_group.redis.primary_endpoint_address }
output "kafka_brokers"        { value = aws_msk_cluster.kafka.bootstrap_brokers_tls }
