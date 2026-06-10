# ElastiCache Redis Module for 54Bank
variable "cluster_id" { type = string }
variable "engine" { type = string; default = "redis" }
variable "engine_version" { type = string; default = "7.0" }
variable "node_type" { type = string }
variable "num_node_groups" { type = number; default = 3 }
variable "replicas_per_node_group" { type = number; default = 2 }
variable "subnet_group_name" { type = string }
variable "security_group_ids" { type = list(string) }
variable "at_rest_encryption_enabled" { type = bool; default = true }
variable "transit_encryption_enabled" { type = bool; default = true }
variable "kms_key_id" { type = string; default = "" }
variable "auth_token" { type = string; sensitive = true; default = "" }
variable "maintenance_window" { type = string; default = "sun:06:00-sun:08:00" }
variable "snapshot_retention_limit" { type = number; default = 7 }
variable "automatic_failover_enabled" { type = bool; default = true }
variable "parameter_group_family" { type = string; default = "redis7" }
variable "parameters" { type = list(map(string)); default = [] }

resource "aws_elasticache_replication_group" "this" {
  replication_group_id       = var.cluster_id
  description                = "54Bank Redis cluster"
  engine                     = var.engine
  engine_version             = var.engine_version
  node_type                  = var.node_type
  num_node_groups            = var.num_node_groups
  replicas_per_node_group    = var.replicas_per_node_group
  subnet_group_name          = var.subnet_group_name
  security_group_ids         = var.security_group_ids
  at_rest_encryption_enabled = var.at_rest_encryption_enabled
  transit_encryption_enabled = var.transit_encryption_enabled
  kms_key_id                 = var.kms_key_id != "" ? var.kms_key_id : null
  auth_token                 = var.auth_token != "" ? var.auth_token : null
  maintenance_window         = var.maintenance_window
  snapshot_retention_limit   = var.snapshot_retention_limit
  automatic_failover_enabled = var.automatic_failover_enabled
  parameter_group_name       = aws_elasticache_parameter_group.this.name
  port                       = 6379
}

resource "aws_elasticache_parameter_group" "this" {
  name   = "${var.cluster_id}-params"
  family = var.parameter_group_family

  dynamic "parameter" {
    for_each = var.parameters
    content {
      name  = parameter.value.name
      value = parameter.value.value
    }
  }
}

output "primary_endpoint" { value = aws_elasticache_replication_group.this.primary_endpoint_address }
output "reader_endpoint" { value = aws_elasticache_replication_group.this.reader_endpoint_address }
output "configuration_endpoint" { value = aws_elasticache_replication_group.this.configuration_endpoint_address }
