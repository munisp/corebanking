# RDS Aurora PostgreSQL Module for 54Bank
variable "identifier" { type = string }
variable "engine" { type = string; default = "aurora-postgresql" }
variable "engine_version" { type = string; default = "15.4" }
variable "instance_class" { type = string }
variable "allocated_storage" { type = number; default = 500 }
variable "max_allocated_storage" { type = number; default = 2000 }
variable "db_name" { type = string }
variable "username" { type = string }
variable "port" { type = number; default = 5432 }
variable "multi_az" { type = bool; default = true }
variable "cluster_size" { type = number; default = 3 }
variable "db_subnet_group_name" { type = string }
variable "vpc_security_group_ids" { type = list(string) }
variable "storage_encrypted" { type = bool; default = true }
variable "kms_key_id" { type = string; default = "" }
variable "backup_retention_period" { type = number; default = 35 }
variable "backup_window" { type = string; default = "02:00-04:00" }
variable "maintenance_window" { type = string; default = "sun:04:00-sun:06:00" }
variable "deletion_protection" { type = bool; default = true }
variable "performance_insights_enabled" { type = bool; default = true }
variable "performance_insights_kms_key_id" { type = string; default = "" }
variable "parameter_group_family" { type = string; default = "aurora-postgresql15" }
variable "parameters" { type = list(map(string)); default = [] }

resource "aws_rds_cluster" "this" {
  cluster_identifier     = var.identifier
  engine                 = var.engine
  engine_version         = var.engine_version
  database_name          = var.db_name
  master_username        = var.username
  manage_master_user_password = true
  port                   = var.port
  db_subnet_group_name   = var.db_subnet_group_name
  vpc_security_group_ids = var.vpc_security_group_ids
  storage_encrypted      = var.storage_encrypted
  kms_key_id             = var.kms_key_id != "" ? var.kms_key_id : null
  backup_retention_period = var.backup_retention_period
  preferred_backup_window = var.backup_window
  preferred_maintenance_window = var.maintenance_window
  deletion_protection    = var.deletion_protection
  skip_final_snapshot    = false
  final_snapshot_identifier = "${var.identifier}-final"
  db_cluster_parameter_group_name = aws_rds_cluster_parameter_group.this.name
  enabled_cloudwatch_logs_exports = ["postgresql"]
}

resource "aws_rds_cluster_instance" "this" {
  count              = var.cluster_size
  identifier         = "${var.identifier}-${count.index}"
  cluster_identifier = aws_rds_cluster.this.id
  instance_class     = var.instance_class
  engine             = var.engine
  engine_version     = var.engine_version

  performance_insights_enabled    = var.performance_insights_enabled
  performance_insights_kms_key_id = var.performance_insights_kms_key_id != "" ? var.performance_insights_kms_key_id : null

  db_parameter_group_name = aws_db_parameter_group.this.name
}

resource "aws_rds_cluster_parameter_group" "this" {
  name   = "${var.identifier}-cluster-params"
  family = var.parameter_group_family

  dynamic "parameter" {
    for_each = var.parameters
    content {
      name  = parameter.value.name
      value = parameter.value.value
    }
  }
}

resource "aws_db_parameter_group" "this" {
  name   = "${var.identifier}-instance-params"
  family = var.parameter_group_family

  parameter {
    name  = "log_statement"
    value = "ddl"
  }
}

output "cluster_endpoint" { value = aws_rds_cluster.this.endpoint }
output "reader_endpoint" { value = aws_rds_cluster.this.reader_endpoint }
output "cluster_identifier" { value = aws_rds_cluster.this.cluster_identifier }
