# MSK (Managed Kafka) Module for 54Bank
variable "cluster_name" { type = string }
variable "kafka_version" { type = string; default = "3.5.1" }
variable "number_of_broker_nodes" { type = number; default = 6 }
variable "broker_instance_type" { type = string }
variable "broker_ebs_volume_size" { type = number; default = 1000 }
variable "subnet_ids" { type = list(string) }
variable "security_group_ids" { type = list(string) }
variable "encryption_in_transit_client_broker" { type = string; default = "TLS" }
variable "encryption_in_transit_in_cluster" { type = bool; default = true }
variable "encryption_at_rest_kms_key_arn" { type = string; default = "" }
variable "enhanced_monitoring" { type = string; default = "PER_TOPIC_PER_BROKER" }
variable "open_monitoring" { type = any; default = {} }
variable "server_properties" { type = map(string); default = {} }

resource "aws_msk_cluster" "this" {
  cluster_name           = var.cluster_name
  kafka_version          = var.kafka_version
  number_of_broker_nodes = var.number_of_broker_nodes

  broker_node_group_info {
    instance_type  = var.broker_instance_type
    client_subnets = var.subnet_ids
    security_groups = var.security_group_ids

    storage_info {
      ebs_storage_info {
        volume_size = var.broker_ebs_volume_size
      }
    }
  }

  encryption_info {
    encryption_in_transit {
      client_broker = var.encryption_in_transit_client_broker
      in_cluster    = var.encryption_in_transit_in_cluster
    }
    encryption_at_rest_kms_key_arn = var.encryption_at_rest_kms_key_arn != "" ? var.encryption_at_rest_kms_key_arn : null
  }

  enhanced_monitoring = var.enhanced_monitoring

  open_monitoring {
    prometheus {
      jmx_exporter {
        enabled_in_broker = true
      }
      node_exporter {
        enabled_in_broker = true
      }
    }
  }

  configuration_info {
    arn      = aws_msk_configuration.this.arn
    revision = aws_msk_configuration.this.latest_revision
  }

  logging_info {
    broker_logs {
      cloudwatch_logs {
        enabled   = true
        log_group = aws_cloudwatch_log_group.msk.name
      }
    }
  }
}

resource "aws_msk_configuration" "this" {
  name              = "${var.cluster_name}-config"
  kafka_versions    = [var.kafka_version]
  server_properties = join("\n", [for k, v in var.server_properties : "${k}=${v}"])
}

resource "aws_cloudwatch_log_group" "msk" {
  name              = "/aws/msk/${var.cluster_name}"
  retention_in_days = 90
}

output "bootstrap_brokers_tls" { value = aws_msk_cluster.this.bootstrap_brokers_tls }
output "zookeeper_connect_string" { value = aws_msk_cluster.this.zookeeper_connect_string }
output "cluster_arn" { value = aws_msk_cluster.this.arn }
