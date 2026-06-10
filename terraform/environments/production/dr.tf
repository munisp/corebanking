# 54Bank Disaster Recovery — Abuja Region
# Active-passive failover from Lagos primary

variable "dr_region" {
  type    = string
  default = "me-south-1" # Bahrain — closest to Nigeria with AWS DR
}

variable "redis_auth_token" {
  type      = string
  sensitive = true
  default   = ""
}

# DR provider
provider "aws" {
  alias  = "dr"
  region = var.dr_region

  default_tags {
    tags = {
      Environment = "dr"
      Project     = "54bank"
      ManagedBy   = "terraform"
      Site        = "abuja"
    }
  }
}

# DR VPC
module "vpc_dr" {
  source = "../../modules/vpc"
  providers = {
    aws = aws.dr
  }

  name             = "${var.cluster_name}-dr-vpc"
  cidr             = "10.1.0.0/16"
  azs              = ["${var.dr_region}a", "${var.dr_region}b", "${var.dr_region}c"]
  private_subnets  = ["10.1.1.0/24", "10.1.2.0/24", "10.1.3.0/24"]
  public_subnets   = ["10.1.101.0/24", "10.1.102.0/24", "10.1.103.0/24"]
  database_subnets = ["10.1.201.0/24", "10.1.202.0/24", "10.1.203.0/24"]

  enable_nat_gateway   = true
  single_nat_gateway   = true # Cost-optimized for DR (activate second NAT during failover)
  enable_dns_hostnames = true
  enable_flow_log      = true
}

# VPC Peering: Lagos ↔ Abuja
resource "aws_vpc_peering_connection" "primary_to_dr" {
  vpc_id      = module.vpc.vpc_id
  peer_vpc_id = module.vpc_dr.vpc_id
  peer_region = var.dr_region
  auto_accept = false

  tags = {
    Name = "54bank-lagos-to-abuja"
    Side = "requester"
  }
}

resource "aws_vpc_peering_connection_accepter" "dr_accept" {
  provider                  = aws.dr
  vpc_peering_connection_id = aws_vpc_peering_connection.primary_to_dr.id
  auto_accept               = true
}

# DR EKS — smaller cluster (scales up during failover)
module "eks_dr" {
  source = "../../modules/eks"
  providers = {
    aws = aws.dr
  }

  cluster_name    = "${var.cluster_name}-dr"
  cluster_version = "1.29"
  vpc_id          = module.vpc_dr.vpc_id
  subnet_ids      = module.vpc_dr.private_subnet_ids

  node_groups = {
    core = {
      instance_types = ["m6i.xlarge"]
      min_size       = 2
      max_size       = 10
      desired_size   = 2
      labels = { workload = "core-banking" }
    }
  }

  cluster_encryption_config = [{
    provider_key_arn = aws_kms_key.eks_dr.arn
    resources        = ["secrets"]
  }]
}

resource "aws_kms_key" "eks_dr" {
  provider                = aws.dr
  description             = "54Bank DR EKS encryption"
  deletion_window_in_days = 30
  enable_key_rotation     = true
}

# DR RDS — Read replica from primary
module "rds_dr" {
  source = "../../modules/rds"
  providers = {
    aws = aws.dr
  }

  identifier     = "${var.cluster_name}-dr-postgres"
  engine         = "aurora-postgresql"
  engine_version = "15.4"
  instance_class = "db.r6g.xlarge"

  db_name  = "corebanking"
  username = "corebanking_admin"
  port     = 5432
  multi_az = false
  cluster_size = 2

  db_subnet_group_name   = module.vpc_dr.database_subnet_group_name
  vpc_security_group_ids = [aws_security_group.rds_dr.id]
  storage_encrypted      = true
  kms_key_id             = aws_kms_key.rds_dr.arn

  backup_retention_period = 7
  deletion_protection     = true
}

resource "aws_kms_key" "rds_dr" {
  provider                = aws.dr
  description             = "54Bank DR RDS encryption"
  deletion_window_in_days = 30
  enable_key_rotation     = true
}

resource "aws_security_group" "rds_dr" {
  provider    = aws.dr
  name_prefix = "54bank-dr-rds-"
  vpc_id      = module.vpc_dr.vpc_id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [module.eks_dr.worker_security_group_id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# DR S3 — Cross-region replication target
resource "aws_s3_bucket" "dr_backups" {
  provider = aws.dr
  bucket   = "54bank-dr-backups"
}

resource "aws_s3_bucket_versioning" "dr_backups" {
  provider = aws.dr
  bucket   = aws_s3_bucket.dr_backups.id
  versioning_configuration {
    status = "Enabled"
  }
}

# Cross-region replication rule
resource "aws_s3_bucket_replication_configuration" "backups_to_dr" {
  bucket = aws_s3_bucket.backups.id
  role   = aws_iam_role.replication.arn

  rule {
    id     = "replicate-to-dr"
    status = "Enabled"

    destination {
      bucket        = aws_s3_bucket.dr_backups.arn
      storage_class = "STANDARD_IA"
    }
  }
}

resource "aws_iam_role" "replication" {
  name = "54bank-s3-replication"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = { Service = "s3.amazonaws.com" }
    }]
  })
}

output "dr_eks_endpoint" { value = module.eks_dr.cluster_endpoint }
output "dr_rds_endpoint" { value = module.rds_dr.cluster_endpoint; sensitive = true }
