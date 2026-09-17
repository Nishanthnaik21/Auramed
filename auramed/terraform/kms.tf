# ==============================================================================
# AWS KMS Customer-Managed Key (CMEK) for Healthcare Platform Encryption
# ==============================================================================

data "aws_caller_identity" "current" {}

resource "aws_kms_key" "auramed_cmek" {
  description             = "AuraMed Production CMEK for HIPAA Tier-1 Encryption (RDS, MSK, EBS, S3)"
  deletion_window_in_days = 30
  enable_key_rotation     = true

  policy = jsonencode({
    Version = "2012-10-17"
    Id      = "auramed-cmek-policy"
    Statement = [
      {
        Sid    = "EnableRootPermissions"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
        }
        Action   = "kms:*"
        Resource = "*"
      },
      {
        Sid    = "AllowCloudWatchLogs"
        Effect = "Allow"
        Principal = {
          Service = "logs.${var.aws_region}.amazonaws.com"
        }
        Action = [
          "kms:Encrypt*",
          "kms:Decrypt*",
          "kms:ReEncrypt*",
          "kms:GenerateDataKey*",
          "kms:Describe*"
        ]
        Resource = "*"
      },
      {
        Sid    = "AllowAWSServicesAccess"
        Effect = "Allow"
        Principal = {
          Service = [
            "rds.amazonaws.com",
            "kafka.amazonaws.com",
            "elasticache.amazonaws.com",
            "eks.amazonaws.com"
          ]
        }
        Action = [
          "kms:Encrypt*",
          "kms:Decrypt*",
          "kms:ReEncrypt*",
          "kms:GenerateDataKey*",
          "kms:DescribeKey"
        ]
        Resource = "*"
      }
    ]
  })

  tags = {
    Name        = "auramed-cmek-${var.environment}"
    Environment = var.environment
    Compliance  = "HIPAA-HITECH-CMEK"
  }
}

resource "aws_kms_alias" "auramed_cmek_alias" {
  name          = "alias/auramed-${var.environment}-cmek"
  target_key_id = aws_kms_key.auramed_cmek.key_id
}

output "cmek_arn" {
  value       = aws_kms_key.auramed_cmek.arn
  description = "Customer Managed Key ARN for data services"
}
