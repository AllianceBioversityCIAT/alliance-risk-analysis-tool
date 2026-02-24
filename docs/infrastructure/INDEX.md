# Infrastructure Documentation Index

Complete infrastructure documentation for the CGIAR Risk Intelligence Tool.

## 📚 Documentation Structure

```
docs/infrastructure/
├── README.md                    # Complete infrastructure guide (main document)
├── CI-CD.md                     # CI/CD implementation guide
├── QUICK-REFERENCE.md           # Command cheat sheet
├── complete-architecture.png    # Full system architecture diagram
├── deployment-flow.png          # Deployment process diagram
└── data-flow.png               # Risk analysis data flow diagram
```

## 📖 Documents

### [README.md](./README.md) - Main Infrastructure Guide

**Comprehensive reference covering:**
- Architecture overview with diagrams
- All AWS services (Cognito, RDS, Lambda, S3, CloudFront, etc.)
- Environment configurations (dev, staging, production)
- Deployment methods (CDK and CloudFormation)
- Post-deployment setup steps
- Monitoring and operations
- Security and compliance
- Troubleshooting guide
- Disaster recovery procedures
- Maintenance tasks

**Use this for:**
- Understanding the complete system architecture
- Initial infrastructure setup
- Production deployment planning
- Troubleshooting infrastructure issues
- Security and compliance reviews

### [CI-CD.md](./CI-CD.md) - CI/CD Implementation Guide

**Step-by-step guide for:**
- GitHub Actions workflow setup
- AWS IAM configuration for CI/CD
- Automated build and test pipelines
- Infrastructure deployment automation
- Database migration automation
- Frontend deployment to S3/CloudFront
- Environment-specific deployments
- Rollback strategies
- Monitoring and notifications

**Use this for:**
- Setting up automated deployments
- Implementing continuous integration
- Configuring GitHub Actions
- Production deployment automation
- Rollback procedures

### [QUICK-REFERENCE.md](./QUICK-REFERENCE.md) - Command Cheat Sheet

**Quick access to:**
- Common AWS CLI commands
- Stack management commands
- Lambda operations (invoke, logs, update)
- Database operations (connect, migrate, backup)
- S3 operations (upload, sync, delete)
- CloudFront cache invalidation
- Cognito user management
- Monitoring and metrics
- Troubleshooting commands
- Emergency procedures

**Use this for:**
- Daily operations
- Quick command lookup
- Debugging and troubleshooting
- Emergency response
- Copy-paste ready commands

## 🎨 Diagrams

### [complete-architecture.png](./complete-architecture.png)

Shows the complete AWS architecture including:
- Frontend (CloudFront + S3)
- API Layer (API Gateway + Lambda)
- Authentication (Cognito)
- Background Processing (Worker Lambda)
- AI Services (Bedrock + Textract)
- Data Layer (RDS + S3 + Secrets Manager)

### [deployment-flow.png](./deployment-flow.png)

Illustrates the deployment process:
- Developer workstation
- Build process (API + Web)
- Infrastructure deployment (CloudFormation)
- Deployed AWS resources

### [data-flow.png](./data-flow.png)

Details the risk analysis workflow:
- 16-step process from upload to report download
- Data flow between services
- Async job processing
- Status polling mechanism

## 🚀 Quick Start

### First-Time Setup

1. **Read the architecture**: Start with [README.md](./README.md) sections:
   - Overview
   - Architecture
   - AWS Services

2. **Deploy infrastructure**: Follow [README.md](./README.md) → Deployment section:
   ```bash
   cd infra
   pnpm install
   pnpm deploy
   ```

3. **Post-deployment**: Follow [README.md](./README.md) → Post-Deployment Steps:
   - Configure frontend
   - Run database migrations
   - Create admin user
   - Deploy frontend

### Setting Up CI/CD

1. **Read CI/CD guide**: [CI-CD.md](./CI-CD.md)

2. **Configure AWS**: Follow Prerequisites → AWS Setup

3. **Configure GitHub**: Follow Prerequisites → GitHub Setup

4. **Implement workflows**: Copy workflow files from CI-CD.md

5. **Test deployment**: Push to develop branch

### Daily Operations

1. **Use quick reference**: [QUICK-REFERENCE.md](./QUICK-REFERENCE.md)

2. **Common tasks**:
   - View logs: `logs-api` alias
   - Check status: `stack-status` alias
   - Deploy changes: `deploy-infra` alias

## 📋 Checklists

### Pre-Deployment Checklist

- [ ] AWS CLI configured with correct credentials
- [ ] Node.js 20+ and pnpm 9+ installed
- [ ] CDK bootstrapped in target account/region
- [ ] Environment parameters configured in `parameters.json`
- [ ] API code built successfully
- [ ] Web code built successfully
- [ ] All tests passing

### Post-Deployment Checklist

- [ ] Stack deployed successfully
- [ ] All outputs retrieved
- [ ] Frontend environment variables configured
- [ ] Database migrations run
- [ ] Initial data seeded
- [ ] Admin user created
- [ ] Frontend deployed to S3
- [ ] CloudFront cache invalidated
- [ ] Health check passing
- [ ] Logs accessible in CloudWatch

### Production Readiness Checklist

- [ ] RDS security group restricted to Lambda only
- [ ] Dedicated VPC with private subnets
- [ ] Database credentials rotated
- [ ] CloudWatch alarms configured
- [ ] Cost budgets set
- [ ] Backup strategy implemented
- [ ] Disaster recovery plan documented
- [ ] CI/CD pipeline tested
- [ ] Monitoring and alerting configured
- [ ] Documentation reviewed and updated

## 🔍 Finding Information

### "How do I...?"

| Task | Document | Section |
|------|----------|---------|
| Deploy infrastructure | README.md | Deployment |
| Set up CI/CD | CI-CD.md | GitHub Actions Workflows |
| View Lambda logs | QUICK-REFERENCE.md | Lambda Functions → View Logs |
| Create a user | QUICK-REFERENCE.md | Cognito Operations → User Management |
| Run migrations | QUICK-REFERENCE.md | Database Operations → Run Migrations |
| Invalidate cache | QUICK-REFERENCE.md | CloudFront Operations |
| Troubleshoot errors | README.md | Troubleshooting |
| Rollback deployment | CI-CD.md | Rollback Strategy |
| Monitor costs | README.md | Monitoring & Operations → Cost Monitoring |
| Backup database | QUICK-REFERENCE.md | Database Operations → Backup & Restore |

### "What is...?"

| Component | Document | Section |
|-----------|----------|---------|
| Architecture overview | README.md | Architecture |
| Cognito configuration | README.md | AWS Services → Amazon Cognito |
| RDS setup | README.md | AWS Services → Amazon RDS PostgreSQL |
| Lambda functions | README.md | AWS Services → AWS Lambda Functions |
| API Gateway | README.md | AWS Services → Amazon API Gateway |
| S3 buckets | README.md | AWS Services → Amazon S3 |
| CloudFront | README.md | AWS Services → Amazon CloudFront |
| Bedrock integration | README.md | AWS Services → AWS Bedrock |
| Data flow | README.md | Data Flow |
| Environments | README.md | Environments |

## 🆘 Emergency Contacts

### Critical Issues

1. **Check troubleshooting**: [README.md](./README.md) → Troubleshooting
2. **Use emergency procedures**: [QUICK-REFERENCE.md](./QUICK-REFERENCE.md) → Emergency Procedures
3. **Review logs**: Use commands in QUICK-REFERENCE.md
4. **Rollback if needed**: Follow CI-CD.md → Rollback Strategy

### Common Emergency Scenarios

| Scenario | Action | Reference |
|----------|--------|-----------|
| Deployment failed | Rollback stack | QUICK-REFERENCE.md → Emergency Procedures |
| API not responding | Check Lambda logs | QUICK-REFERENCE.md → Lambda Functions |
| Database connection error | Verify security group | README.md → Troubleshooting |
| Frontend 403 errors | Check CloudFront config | README.md → Troubleshooting |
| High costs | Review cost metrics | QUICK-REFERENCE.md → Cost Management |

## 📝 Maintenance Schedule

### Daily
- Monitor CloudWatch logs for errors
- Check Lambda execution metrics

### Weekly
- Review CloudWatch logs
- Check Lambda metrics
- Monitor RDS performance

### Monthly
- Review AWS costs
- Update dependencies
- Rotate database credentials

### Quarterly
- Review IAM permissions
- Update CDK/AWS SDK
- Performance testing
- Security audit

## 🔗 External References

- [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/)
- [AWS Lambda Best Practices](https://docs.aws.amazon.com/lambda/latest/dg/best-practices.html)
- [Amazon RDS PostgreSQL](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_PostgreSQL.html)
- [Amazon Bedrock](https://docs.aws.amazon.com/bedrock/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Next.js Deployment](https://nextjs.org/docs/deployment)

## 📊 Metrics & KPIs

### Infrastructure Health

- Lambda error rate < 1%
- API Gateway latency < 500ms
- RDS CPU utilization < 80%
- CloudFront cache hit ratio > 80%

### Deployment Success

- Deployment success rate > 95%
- Rollback rate < 5%
- Mean time to deploy < 15 minutes
- Mean time to recovery < 30 minutes

## 🎯 Next Steps

1. **Review main documentation**: Read [README.md](./README.md) completely
2. **Understand architecture**: Study the diagrams
3. **Deploy to development**: Follow deployment guide
4. **Set up CI/CD**: Implement GitHub Actions workflows
5. **Configure monitoring**: Set up CloudWatch alarms
6. **Test thoroughly**: Validate all functionality
7. **Deploy to production**: Follow production checklist
8. **Document customizations**: Update docs with any changes

---

**Last Updated**: 2026-02-24  
**Version**: 1.0  
**Maintained By**: DevOps Team
