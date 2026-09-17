# ==============================================================================
# AuraMed VPC Infrastructure: 3-Tier Network Topology across 3 Availability Zones
# ==============================================================================

terraform {
  required_version = ">= 1.7.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.40"
    }
  }
}

variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "environment" {
  type    = string
  default = "production"
}

variable "vpc_cidr" {
  type    = string
  default = "10.100.0.0/16"
}

variable "availability_zones" {
  type    = list(string)
  default = ["us-east-1a", "us-east-1b", "us-east-1c"]
}

# ------------------------------------------------------------------------------
# VPC & Internet Gateway
# ------------------------------------------------------------------------------

resource "aws_vpc" "auramed_vpc" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name                                        = "auramed-${var.environment}-vpc"
    Environment                                 = var.environment
    "kubernetes.io/cluster/auramed-production" = "shared"
    Compliance                                  = "HIPAA-ZeroTrust"
  }
}

resource "aws_internet_gateway" "igw" {
  vpc_id = aws_vpc.auramed_vpc.id

  tags = {
    Name        = "auramed-${var.environment}-igw"
    Environment = var.environment
  }
}

# ------------------------------------------------------------------------------
# 1. Public Subnets (ALB Ingress & NAT Gateways only)
# ------------------------------------------------------------------------------

resource "aws_subnet" "public" {
  count                   = 3
  vpc_id                  = aws_vpc.auramed_vpc.id
  cidr_block              = cidrsubnet(var.vpc_cidr, 8, count.index) # 10.100.0.0/24, 10.100.1.0/24, 10.100.2.0/24
  availability_zone       = var.availability_zones[count.index]
  map_public_ip_on_launch = false

  tags = {
    Name                                        = "auramed-public-${var.availability_zones[count.index]}"
    "kubernetes.io/role/elb"                    = "1"
    "kubernetes.io/cluster/auramed-production" = "shared"
    Tier                                        = "Public-Ingress"
  }
}

resource "aws_eip" "nat" {
  count  = 3
  domain = "vpc"

  tags = {
    Name = "auramed-nat-eip-${var.availability_zones[count.index]}"
  }
}

resource "aws_nat_gateway" "nat" {
  count         = 3
  allocation_id = aws_eip.nat[count.index].id
  subnet_id     = aws_subnet.public[count.index].id

  tags = {
    Name = "auramed-nat-gw-${var.availability_zones[count.index]}"
  }
  depends_on = [aws_internet_gateway.igw]
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.auramed_vpc.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.igw.id
  }

  tags = {
    Name = "auramed-public-rt"
  }
}

resource "aws_route_table_association" "public" {
  count          = 3
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

# ------------------------------------------------------------------------------
# 2. Private App Subnets (EKS Worker Nodes, Flink, Gateway, Triton)
# ------------------------------------------------------------------------------

resource "aws_subnet" "private_app" {
  count             = 3
  vpc_id            = aws_vpc.auramed_vpc.id
  cidr_block        = cidrsubnet(var.vpc_cidr, 4, count.index + 2) # 10.100.32.0/20, 10.100.48.0/20, 10.100.64.0/20
  availability_zone = var.availability_zones[count.index]

  tags = {
    Name                                        = "auramed-private-app-${var.availability_zones[count.index]}"
    "kubernetes.io/role/internal-elb"           = "1"
    "kubernetes.io/cluster/auramed-production" = "owned"
    "karpenter.sh/discovery"                    = "auramed-production"
    Tier                                        = "Private-Application"
  }
}

resource "aws_route_table" "private_app" {
  count  = 3
  vpc_id = aws_vpc.auramed_vpc.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.nat[count.index].id
  }

  tags = {
    Name = "auramed-private-app-rt-${var.availability_zones[count.index]}"
  }
}

resource "aws_route_table_association" "private_app" {
  count          = 3
  subnet_id      = aws_subnet.private_app[count.index].id
  route_table_id = aws_route_table.private_app[count.index].id
}

# ------------------------------------------------------------------------------
# 3. Air-Gapped Data Subnets (RDS Token Vault, MSK, ElastiCache - ZERO INTERNET)
# ------------------------------------------------------------------------------

resource "aws_subnet" "airgapped_data" {
  count             = 3
  vpc_id            = aws_vpc.auramed_vpc.id
  cidr_block        = cidrsubnet(var.vpc_cidr, 4, count.index + 6) # 10.100.96.0/20, 10.100.112.0/20, 10.100.128.0/20
  availability_zone = var.availability_zones[count.index]

  tags = {
    Name        = "auramed-airgapped-data-${var.availability_zones[count.index]}"
    Tier        = "AirGapped-Data"
    Compliance  = "HIPAA-Isolated-Vault"
  }
}

# Air-Gapped Route Table: ONLY local VPC routing, NO default route to IGW or NAT!
resource "aws_route_table" "airgapped_data" {
  vpc_id = aws_vpc.auramed_vpc.id

  tags = {
    Name        = "auramed-airgapped-data-rt"
    Description = "Strictly isolated internal routing with no egress route"
  }
}

resource "aws_route_table_association" "airgapped_data" {
  count          = 3
  subnet_id      = aws_subnet.airgapped_data[count.index].id
  route_table_id = aws_route_table.airgapped_data.id
}
