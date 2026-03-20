# Ndovera Platform Architecture (Blueprint)

This document outlines a production-ready architecture for the Ndovera digital education infrastructure. It is a blueprint for implementation, not a full implementation.

---

## 1. High-Level Architecture

- **Style:** Microservices, API-gateway, zero-trust, event-driven where necessary.
- **Domains:**
  - Public Website (this repo, currently Vite/React; can evolve to Next.js later).
  - Web App / Portals (multi-tenant, role-based: admin, school, teacher, parent, student).
  - Backend microservices (NestJS-based), exposed via REST + GraphQL, with internal gRPC.
  - Data plane (PostgreSQL, MongoDB, Redis, OpenSearch).
  - Observability & security plane (Prometheus, Grafana, OpenTelemetry, SIEM, WAF, IDS).

**Core Services:**

- **API Gateway** (Kong or Traefik)
  - Single public entrypoint for all APIs.
  - TLS termination, rate limiting, IP allow/deny lists, mTLS to internal services.

- **Auth Service** (NestJS)
  - OAuth2 / OIDC provider, JWT + refresh tokens.
  - MFA, device fingerprinting hooks, session management.
  - RBAC/ABAC decision point for downstream services.

- **User Service**
  - Manages user identities, roles, profiles for all actors.
  - Integrates with Auth service and DB row-level security.

- **School Service**
  - Tenancy model for schools (orgs, campuses, sessions, terms).
  - Governance settings, policy configuration, regulatory mappings.

- **Learning Service**
  - Curriculum, classes, subjects, assignments, assessments.
  - Learning objects and content catalogs, links to LMS tooling.

- **Reward Economy Service**
  - Student wallets, reward configurations, earning rules.
  - Ledgers, transactions, withdrawals to approved endpoints.

- **Analytics Service**
  - Aggregations, KPIs, long-term metrics, dashboards.
  - Uses event streams and OLAP-friendly schemas.

- **Notification Service**
  - Email, SMS, push, in-app notifications.
  - Template management and audit logs.

- **Payment / Billing Service**
  - Subscription plans, invoicing, PSP integrations.

- **Storage Service**
  - Object storage abstraction (S3/GCS/Azure Blob).
  - Handles encryption, signed URLs, retention policies.

---

## 2. Data Architecture

### 2.1 Datastores

- **PostgreSQL (clustered)**
  - Primary system-of-record for:
    - Users, schools, roles, policies, academic structures.
    - Financial and reward ledgers (with strong consistency).
    - Compliance-relevant audit logs.

- **MongoDB (replica set)**
  - Flexible documents for:
    - Content, learning materials, UI configurations per tenant.
    - Event payloads where denormalization is helpful.

- **Redis (clustered)**
  - Caching for sessions, tokens, rate limits, configuration.
  - Short-lived views for dashboards and search warm caches.

- **OpenSearch / Elasticsearch**
  - Search indices for students, schools, content, logs.
  - Supports filtered, role-aware search.

### 2.2 Security Controls (Data)

- **Encryption at rest:** AES-256 (cloud-managed KMS).
- **Encryption in transit:** TLS 1.3 for all connections.
- **Row-level security:** PostgreSQL RLS + application-level checks.
- **Column-level encryption & masking:** For PII/child data fields.
- **Tokenization:** Token service for highly sensitive identifiers.
- **Network isolation:**
  - Databases in private subnets only.
  - Bastion host or SSM-based access for DB administration.
- **Audit & IDS:**
  - Database audit logging to a central, immutable log store.
  - Intrusion detection rules on abnormal query patterns.

---

## 3. Security & Zero-Trust Model

### 3.1 Network

- VPC-per-environment (dev/stage/prod), strict security groups.
- Public subnets for load balancers and API gateway only.
- Private subnets for all app and data services.
- WAF in front of load balancers (SQLi/XSS rules, bot control).
- DDoS protection via cloud provider services.

### 3.2 Application

- Centralized validation and schema enforcement (DTOs, Zod/JOI).
- Strong CSP headers, XSS/CSRF protection.
- Strict-origin-when-cross-origin referrer and HSTS.
- Rate limiting and request signing for sensitive endpoints.
- Replay protection via nonce/timestamp windows.

### 3.3 Identity & Access

- OAuth2/OIDC flows for web, SPA, and mobile.
- JWT with short lifetimes; refresh tokens stored securely.
- MFA (TOTP, SMS/email, and FIDO/WebAuthn ready).
- RBAC (role-based) plus ABAC (attributes: school, region, grade).
- Per-tenant and per-role scoping of all queries and mutations.

---

## 4. Containers & Orchestration

### 4.1 Docker

Expected images (examples):

- `frontend-public` – public website (Next.js or Vite/React).
- `frontend-app` – authenticated app/portal shell.
- `backend-api` – API gateway-facing aggregator/orchestrator.
- `auth-service`, `user-service`, `school-service`, `learning-service`,
  `reward-service`, `analytics-service`, `notification-service`,
  `payment-service`, `storage-service`.
- `postgres`, `mongo`, `redis`, `opensearch` (or managed services in cloud).

### 4.2 Local Development (docker-compose)

- One `docker-compose.yml` that wires all needed services for local testing.
- Separate override files per environment if needed.

### 4.3 Kubernetes (Production)

- One namespace per environment (e.g., `ndovera-prod`).
- Each microservice defined via Deployment + Service.
- IngressController (Nginx/Traefik) or managed ingress (ALB, etc.).
- Horizontal Pod Autoscaler rules per service.
- PodSecurityStandards + NetworkPolicies.

### 4.4 Helm

- Helm charts per component group (frontend, core services, data plane).
- Values files per environment (dev, stage, prod).

---

## 5. Infrastructure as Code

- **Terraform**
  - VPC, subnets, route tables, gateways.
  - Load balancers, security groups, WAF, DNS.
  - Managed database clusters (RDS, Cloud SQL, etc.).
  - Object storage buckets, KMS keys, Secrets Manager.
  - Kubernetes cluster (EKS/GKE/AKS) and node groups.

- **Ansible (optional)**
  - Hardening OS images and base AMIs if not fully managed.

---

## 6. Observability & Compliance

- **Metrics:** Prometheus scraping all services; Grafana dashboards for:
  - Request latency, errors, throughput per service.
  - Resource utilization, scaling events.

- **Tracing:** OpenTelemetry SDKs in all services; traces exported to a collector and backend (Jaeger/Tempo/OTel backend).

- **Logging:**
  - Structured JSON logs from all services.
  - Centralized log store (OpenSearch/Elastic or cloud-native).

- **Security Monitoring:**
  - SIEM integration (e.g., Splunk, Datadog, or cloud-native).
  - Alerts on auth anomalies, rate spikes, and policy violations.

- **Compliance:**
  - Controls aligned with GDPR/child-data regulations.
  - Data residency tags per tenant/school.
  - Full audit trails for access and data changes.

---

## 7. CI/CD Pipeline

- **GitHub Actions / GitLab CI:**
  - Lint, test, type-check steps per service.
  - SAST, DAST, dependency and container scanning.
  - Build and sign Docker images.
  - Push to private container registry.
  - Deploy via Helm to Kubernetes using GitOps or environment promotions.

- **Deployment strategies:**
  - Blue/green or canary for critical services.
  - Feature flags for risky changes.

---

## 8. Frontend Alignment (This Repo)

- Current state: Vite/React SPA for public marketing + basic portal shell.
- Evolution path:
  - Migrate public site to Next.js for SEO and hybrid rendering.
  - Integrate with Auth service (OIDC) for portal login.
  - Use a shared component library (Tailwind + shadcn/ui) across public and app frontends.
  - Implement role-based layout shells for each portal (school, teacher, parent, student, admin).

---

This document is intended as a concise, implementation-ready reference for building the full Ndovera platform around the public website now present in this repository.
