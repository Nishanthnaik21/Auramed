# ==============================================================================
# AWS Managed Data Services: MSK (Kafka), ElastiCache Redis, Air-Gapped RDS
# ==============================================================================

# ------------------------------------------------------------------------------
# Security Groups
# ------------------------------------------------------------------------------

# MSK Kafka Security Group
resource "aws_security_group" "msk_sg" {
  name        = "auramed-${var.environment}-msk-sg"
  description = "Access to MSK brokers from EKS application tier"
  vpc_id      = aws_vpc.auramed_vpc.id

  ingress {
    description = "Kafka TLS mutual broker connectivity"
    from_port   = 9094
    to_port     = 9094
    protocol    = "tcp"
    cidr_blocks = aws_subnet.private_app.*.cidr_block
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "auramed-msk-sg"
  }
}

# ElastiCache Redis Security Group
resource "aws_security_group" "redis_sg" {
  name        = "auramed-${var.environment}-redis-sg"
  description = "Access to Redis Feast online store from EKS"
  vpc_id      = aws_vpc.auramed_vpc.id

  ingress {
    description = "Redis port from private app subnets"
    from_port   = 6379
    to_port     = 6379
    protocol    = "tcp"
    cidr_blocks = aws_subnet.private_app.*.cidr_block
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "auramed-redis-sg"
  }
}

# Air-Gapped RDS Token Identity Vault Security Group (Strict Zero-Trust)
resource "aws_security_group" "rds_vault_sg" {
  name        = "auramed-${var.environment}-rds-vault-sg"
  description = "Air-gapped Token Vault access strictly constrained to Rust Ingestion Gateway"
  vpc_id      = aws_vpc.auramed_vpc.id

  ingress {
    description = "Postgres 5432 strictly from private application subnets"
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = aws_subnet.private_app.*.cidr_block
  }

  # No egress allowed to external internet
  tags = {
    Name       = "auramed-rds-vault-sg"
    Compliance = "AirGapped-IdentityVault"
  }
}

# ------------------------------------------------------------------------------
# 1. AWS Managed Streaming for Apache Kafka (MSK)
# ------------------------------------------------------------------------------

resource "aws_kms_key" "msk_cmek" {
  description = "MSK KMS Key"
}

resource "aws_msk_cluster" "auramed_msk" {
  cluster_name           = "auramed-${var.environment}-msk"
  kafka_version          = "3.5.1"
  number_of_broker_nodes = 3

  broker_node_group_info {
    instance_type   = "kafka.m7g.large"
    client_subnets  = aws_subnet.airgapped_data.*.id
    security_groups = [aws_security_group.msk_sg.id]
    storage_info {
      ebs_storage_info {
        volume_size = 500
      }
    }
  }

  encryption_info {
    encryption_at_rest_kms_key_arn = aws_kms_key.auramed_cmek.arn
    encryption_in_transit {
      client_broker = "TLS"
      in_cluster    = true
    }
  }

  enhanced_monitoring = "PER_TOPIC_PER_BROKER"

  tags = {
    Name        = "auramed-msk-cluster"
    Environment = var.environment
  }
}

# ------------------------------------------------------------------------------
# 2. Amazon ElastiCache Redis (Feast Online Feature Store)
# ------------------------------------------------------------------------------

resource "aws_elasticache_subnet_group" "redis_subnet_group" {
  name       = "auramed-${var.environment}-redis-subnets"
  subnet_ids = aws_subnet.airgapped_data.*.id
}

resource "aws_elasticache_replication_group" "auramed_redis" {
  replication_group_id       = "auramed-${var.environment}-redis"
  description                = "Feast Online Feature Store Multi-AZ Redis Cluster"
  node_type                  = "cache.m6g.large"
  num_cache_clusters         = 3
  port                       = 6379
  parameter_group_name       = "default.redis7"
  subnet_group_name          = aws_elasticache_subnet_group.redis_subnet_group.name
  security_group_ids         = [aws_security_group.redis_sg.id]
  automatic_failover_enabled = true
  multi_az_enabled           = true

  at_rest_encryption_enabled = true
  kms_key_id                 = aws_kms_key.auramed_cmek.arn
  transit_encryption_enabled = true
  auth_token                 = "auramed-redis-secure-auth-token-2026-prod!"

  tags = {
    Name        = "auramed-redis-cluster"
    Environment = var.environment
  }
}

# ------------------------------------------------------------------------------
# 3. Air-Gapped RDS PostgreSQL (Token Identity Vault)
# ------------------------------------------------------------------------------

resource "aws_db_subnet_group" "rds_vault_subnets" {
  name        = "auramed-${var.environment}-vault-subnets"
  subnet_ids  = aws_subnet.airgapped_data.*.id
  description = "Air-gapped database subnet group with zero internet egress"

  tags = {
    Name       = "auramed-vault-subnet-group"
    Compliance = "AirGapped"
  }
}

resource "aws_db_parameter_group" "rds_vault_pg" {
  name   = "auramed-${var.environment}-vault-pg16"
  family = "postgres16"

  # Enforce TLS connections exclusively
  parameter {
    name  = "rds.force_ssl"
    value = "1"
  }

  # Strict password hashing standard
  parameter {
    name  = "password_encryption"
    value = "scram-sha-256"
  }

  # Connection logging for HIPAA audit trail
  parameter {
    name  = "log_connections"
    value = "1"
  }

  parameter {
    name  = "log_disconnections"
    value = "1"
  }
}

resource "aws_db_instance" "auramed_vault" {
  identifier                  = "auramed-${var.environment}-token-vault"
  engine                      = "postgres"
  engine_version              = "16.2"
  instance_class              = "db.m6i.xlarge"
  allocated_storage           = 100
  max_allocated_storage       = 1000
  storage_type                = "gp3"
  db_name                     = "auramed_identity_vault"
  username                    = "auramed_admin"
  manage_master_user_password = true
  master_user_secret_kms_key_id = aws_kms_key.auramed_cmek.arn

  db_subnet_group_name   = aws_db_subnet_group.rds_vault_subnets.name
  vpc_security_group_ids = [aws_security_group.rds_vault_sg.id]
  parameter_group_name   = aws_db_parameter_group.rds_vault_pg.name

  multi_az               = true
  publicly_accessible    = false
  storage_encrypted      = true
  kms_key_id             = aws_kms_key.auramed_cmek.arn
  deletion_protection    = true
  skip_final_snapshot    = false
  final_snapshot_identifier = "auramed-vault-final-snapshot"

  backup_retention_period = 35
  backup_window           = "03:00-04:00"
  maintenance_window      = "Sun:04:30-Sun:05:30"

  enabled_cloudwatch_logs_exports = ["postgresql", "upgrade"]

  tags = {
    Name        = "auramed-token-identity-vault"
    Environment = var.environment
    Compliance  = "HIPAA-AirGapped-Vault"
  }
}
