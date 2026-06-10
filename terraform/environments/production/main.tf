# 54Bank Production Infrastructure — Lagos Region
# Terraform configuration for Nigerian banking platform
# CBN-compliant: data residency in Nigeria (af-south-1 / me-south-1 fallback)

terraform {
  required_version = ">= 1.5"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.25"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.12"
    }
  }

  backend "s3" {
    bucket         = "54bank-terraform-state"
    key            = "production/terraform.tfstate"
    region         = "af-south-1"
    encrypt        = true
    dynamodb_table = "54bank-terraform-locks"
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Environment = "production"
      Project     = "54bank"
      ManagedBy   = "terraform"
      Compliance  = "CBN-IT-Standards"
    }
  }
}

# ── Variables ────────────────────────────────────────────────────────────────

variable "aws_region" {
  description = "AWS region for deployment (must be Africa/Middle East for CBN compliance)"
  type        = string
  default     = "af-south-1" # Cape Town — closest to Nigeria with AWS presence
}

variable "environment" {
  type    = string
  default = "production"
}

variable "vpc_cidr" {
  type    = string
  default = "10.0.0.0/16"
}

variable "cluster_name" {
  type    = string
  default = "54bank-production"
}

variable "db_instance_class" {
  type    = string
  default = "db.r6g.2xlarge"
}

variable "redis_node_type" {
  type    = string
  default = "cache.r6g.xlarge"
}

variable "msk_instance_type" {
  type    = string
  default = "kafka.m5.2xlarge"
}

# ── VPC ──────────────────────────────────────────────────────────────────────

module "vpc" {
  source = "../../modules/vpc"

  name             = "${var.cluster_name}-vpc"
  cidr             = var.vpc_cidr
  azs              = ["${var.aws_region}a", "${var.aws_region}b", "${var.aws_region}c"]
  private_subnets  = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
  public_subnets   = ["10.0.101.0/24", "10.0.102.0/24", "10.0.103.0/24"]
  database_subnets = ["10.0.201.0/24", "10.0.202.0/24", "10.0.203.0/24"]

  enable_nat_gateway   = true
  single_nat_gateway   = false # HA: one NAT per AZ
  enable_dns_hostnames = true
  enable_flow_log      = true

  tags = {
    Environment = var.environment
  }
}

# ── EKS Cluster ──────────────────────────────────────────────────────────────

module "eks" {
  source = "../../modules/eks"

  cluster_name    = var.cluster_name
  cluster_version = "1.29"
  vpc_id          = module.vpc.vpc_id
  subnet_ids      = module.vpc.private_subnet_ids

  # Node groups for different workload classes
  node_groups = {
    core = {
      instance_types = ["m6i.2xlarge"]
      min_size       = 3
      max_size       = 10
      desired_size   = 5
      labels = {
        workload = "core-banking"
      }
    }
    middleware = {
      instance_types = ["c6i.xlarge"]
      min_size       = 2
      max_size       = 8
      desired_size   = 3
      labels = {
        workload = "middleware"
      }
    }
    ml = {
      instance_types = ["g5.xlarge"]
      min_size       = 0
      max_size       = 4
      desired_size   = 1
      labels = {
        workload = "ml-inference"
      }
      taints = [{
        key    = "nvidia.com/gpu"
        value  = "true"
        effect = "NO_SCHEDULE"
      }]
    }
  }

  # Enable encryption at rest for secrets
  cluster_encryption_config = [{
    provider_key_arn = aws_kms_key.eks.arn
    resources        = ["secrets"]
  }]

  # Enable audit logging
  cluster_enabled_log_types = ["api", "audit", "authenticator", "controllerManager", "scheduler"]
}

# ── RDS PostgreSQL (Multi-AZ) ────────────────────────────────────────────────

module "rds" {
  source = "../../modules/rds"

  identifier = "${var.cluster_name}-postgres"
  engine     = "aurora-postgresql"
  engine_version = "15.4"

  instance_class       = var.db_instance_class
  allocated_storage    = 500
  max_allocated_storage = 2000

  db_name  = "corebanking"
  username = "corebanking_admin"
  port     = 5432

  # Multi-AZ for HA
  multi_az = true
  
  # Aurora cluster settings
  cluster_size = 3  # 1 writer + 2 readers

  # Subnet and security
  db_subnet_group_name = module.vpc.database_subnet_group_name
  vpc_security_group_ids = [aws_security_group.rds.id]

  # Encryption
  storage_encrypted = true
  kms_key_id        = aws_kms_key.rds.arn

  # Backup
  backup_retention_period = 35  # 35 days — CBN requires minimum 7 years for transactions
  backup_window           = "02:00-04:00"
  maintenance_window      = "sun:04:00-sun:06:00"
  deletion_protection     = true

  # Performance insights
  performance_insights_enabled = true
  performance_insights_kms_key_id = aws_kms_key.rds.arn

  # Parameter group for Nigerian banking
  parameter_group_family = "aurora-postgresql15"
  parameters = [
    { name = "shared_preload_libraries", value = "pg_stat_statements,pg_audit" },
    { name = "log_statement", value = "ddl" },
    { name = "log_min_duration_statement", value = "1000" },
    { name = "statement_timeout", value = "30000" },
    { name = "idle_in_transaction_session_timeout", value = "60000" },
  ]
}

# ── ElastiCache Redis (Cluster Mode) ────────────────────────────────────────

module "elasticache" {
  source = "../../modules/elasticache"

  cluster_id      = "${var.cluster_name}-redis"
  engine          = "redis"
  engine_version  = "7.0"
  node_type       = var.redis_node_type
  
  # Cluster mode with 3 shards, 2 replicas each
  num_node_groups         = 3
  replicas_per_node_group = 2

  subnet_group_name  = module.vpc.elasticache_subnet_group_name
  security_group_ids = [aws_security_group.redis.id]

  # Encryption
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  kms_key_id                 = aws_kms_key.redis.arn

  # Auth
  auth_token = var.redis_auth_token

  # Maintenance
  maintenance_window    = "sun:06:00-sun:08:00"
  snapshot_retention_limit = 7
  automatic_failover_enabled = true

  parameter_group_family = "redis7"
  parameters = [
    { name = "maxmemory-policy", value = "allkeys-lru" },
    { name = "notify-keyspace-events", value = "Ex" },
  ]
}

# ── MSK (Managed Kafka) ─────────────────────────────────────────────────────

module "msk" {
  source = "../../modules/msk"

  cluster_name  = "${var.cluster_name}-kafka"
  kafka_version = "3.5.1"
  
  number_of_broker_nodes = 6  # 2 per AZ
  broker_instance_type   = var.msk_instance_type
  broker_ebs_volume_size = 1000  # 1TB per broker

  subnet_ids         = module.vpc.private_subnet_ids
  security_group_ids = [aws_security_group.kafka.id]

  # Encryption
  encryption_in_transit_client_broker = "TLS"
  encryption_in_transit_in_cluster    = true
  encryption_at_rest_kms_key_arn      = aws_kms_key.kafka.arn

  # Monitoring
  enhanced_monitoring = "PER_TOPIC_PER_BROKER"
  
  # Open monitoring with Prometheus
  open_monitoring = {
    prometheus = {
      jmx_exporter = {
        enabled_in_broker = true
      }
      node_exporter = {
        enabled_in_broker = true
      }
    }
  }

  # Configuration
  server_properties = {
    "auto.create.topics.enable"  = "false"
    "delete.topic.enable"        = "true"
    "default.replication.factor" = "3"
    "min.insync.replicas"        = "2"
    "num.partitions"             = "12"
    "log.retention.hours"        = "168"  # 7 days
    "log.retention.bytes"        = "-1"
    "message.max.bytes"          = "1048576"
  }
}

# ── KMS Keys ─────────────────────────────────────────────────────────────────

resource "aws_kms_key" "eks" {
  description             = "54Bank EKS secrets encryption key"
  deletion_window_in_days = 30
  enable_key_rotation     = true
}

resource "aws_kms_key" "rds" {
  description             = "54Bank RDS encryption key"
  deletion_window_in_days = 30
  enable_key_rotation     = true
}

resource "aws_kms_key" "redis" {
  description             = "54Bank ElastiCache encryption key"
  deletion_window_in_days = 30
  enable_key_rotation     = true
}

resource "aws_kms_key" "kafka" {
  description             = "54Bank MSK encryption key"
  deletion_window_in_days = 30
  enable_key_rotation     = true
}

resource "aws_kms_key" "s3" {
  description             = "54Bank S3 bucket encryption key"
  deletion_window_in_days = 30
  enable_key_rotation     = true
}

# ── Security Groups ──────────────────────────────────────────────────────────

resource "aws_security_group" "rds" {
  name_prefix = "54bank-rds-"
  vpc_id      = module.vpc.vpc_id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [module.eks.worker_security_group_id]
    description     = "PostgreSQL from EKS workers only"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group" "redis" {
  name_prefix = "54bank-redis-"
  vpc_id      = module.vpc.vpc_id

  ingress {
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [module.eks.worker_security_group_id]
    description     = "Redis from EKS workers only"
  }
}

resource "aws_security_group" "kafka" {
  name_prefix = "54bank-kafka-"
  vpc_id      = module.vpc.vpc_id

  ingress {
    from_port       = 9092
    to_port         = 9098
    protocol        = "tcp"
    security_groups = [module.eks.worker_security_group_id]
    description     = "Kafka from EKS workers only"
  }
}

# ── S3 Buckets ───────────────────────────────────────────────────────────────

resource "aws_s3_bucket" "documents" {
  bucket = "54bank-${var.environment}-documents"

  tags = {
    Name        = "Customer Documents"
    Compliance  = "NDPR"
    DataClass   = "PII"
  }
}

resource "aws_s3_bucket_versioning" "documents" {
  bucket = aws_s3_bucket.documents.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "documents" {
  bucket = aws_s3_bucket.documents.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.s3.arn
    }
  }
}

resource "aws_s3_bucket_public_access_block" "documents" {
  bucket = aws_s3_bucket.documents.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket" "backups" {
  bucket = "54bank-${var.environment}-backups"
}

resource "aws_s3_bucket_lifecycle_configuration" "backups" {
  bucket = aws_s3_bucket.backups.id

  rule {
    id     = "transition-to-glacier"
    status = "Enabled"

    transition {
      days          = 90
      storage_class = "GLACIER"
    }

    # CBN requires 7 years retention for financial records
    expiration {
      days = 2555 # ~7 years
    }
  }
}

# ── Outputs ──────────────────────────────────────────────────────────────────

output "eks_cluster_endpoint" {
  value = module.eks.cluster_endpoint
}

output "rds_cluster_endpoint" {
  value     = module.rds.cluster_endpoint
  sensitive = true
}

output "redis_endpoint" {
  value     = module.elasticache.primary_endpoint
  sensitive = true
}

output "kafka_bootstrap_brokers" {
  value     = module.msk.bootstrap_brokers_tls
  sensitive = true
}

output "vpc_id" {
  value = module.vpc.vpc_id
}
