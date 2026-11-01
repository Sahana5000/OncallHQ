# OnCallHQ — Incident Response & On-Call Platform

[![CI Pipeline](https://github.com/Sahana5000/OncallHQ/actions/workflows/ci.yml/badge.svg)](https://github.com/Sahana5000/OncallHQ/actions)
[![NestJS](https://img.shields.io/badge/backend-NestJS%2010-ea2845.svg)](https://nestjs.com/)
[![Next.js](https://img.shields.io/badge/frontend-Next.js%2014-black.svg)](https://nextjs.org/)
[![PostgreSQL](https://img.shields.io/badge/database-PostgreSQL%2016-336791.svg)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/queue-Redis%207%20%2F%20BullMQ-dc382d.svg)](https://redis.io/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

An asynchronous, event-driven incident alerting, schedule management, and automated escalation platform designed for Site Reliability Engineering (SRE) and DevOps teams.

---

## 1. Overview & Problem Statement

When production services experience downtime at 3 a.m., alerts must reach the designated responder immediately. If that engineer is unavailable or fails to acknowledge, the system must automatically escalate to backup personnel without human intervention.

### Common Industry Failure Modes Addressed
1. **Alert Fatigue & Flapping Checks:** Without deduplication, flapping monitoring checks create dozens of tickets for a single underlying issue.
2. **Missed Escalations:** Engineers miss notifications, and outages run unaddressed due to lack of automated escalation timers.
3. **Overlapping Rotations & Handover Confusion:** Ad-hoc shared spreadsheets or calendars lead to shifts overlapping or going unassigned.
4. **Disorganized Audit Trails:** Postmortems become guesswork when notifications, acks, and resolutions are scattered across chat channels.

**OnCallHQ** resolves this by enforcing database-level schedule exclusion constraints, fingerprint-based alert deduplication, BullMQ delayed job timers for automatic multi-tier escalation, and full audit logging.

---

## 2. System Architecture

```
                    ┌───────────────────────────┐
                    │  External Monitoring      │
                    │  (Datadog, Prometheus)   │
                    └─────────────┬─────────────┘
                                  │ Webhook POST /ingest/:serviceKey
                                  ▼
                    ┌───────────────────────────┐
                    │  Ingestion API Controller │
                    │  (Rate Limited & Throttled)│
                    └─────────────┬─────────────┘
                                  │ SHA-256 Fingerprint Check
                                  ▼
                    ┌───────────────────────────┐        ┌─────────────────────────┐
                    │  Incident Core Service    │◄──────►│  Schedule Engine        │
                    │  (Dedup & State Machine)  │        │  (Range Containment)    │
                    └─────────────┬─────────────┘        └───────────┬─────────────┘
                                  │                                  │
                                  │ Enqueue Delayed Job              │ GiST Overlap Constraints
                                  ▼                                  ▼
┌─────────────────────────┐ ┌───────────────┐          ┌─────────────────────────┐
│  Next.js 14 Dashboard   │ │ BullMQ Queue  │          │  PostgreSQL 16          │
│  (Live WebSocket Feed)  │ │ (Redis 7)     │          │  (tstzrange, GiST)      │
└────────────▲────────────┘ └───────┬───────┘          └─────────────────────────┘
             │                      │ Delayed Execution
             │ Socket.IO            ▼
             └────────────── Escalation Worker ──► Notification Dispatch
                             (Tier N -> Tier N+1)  (Email, Webhook, SMS)
```

---

## 3. Core Features

### 📅 PostgreSQL Temporal Range Scheduling
- Shifts and emergency coverage are modeled using PostgreSQL `tstzrange`.
- Database-level `EXCLUDE USING gist (schedule_id WITH =, time_range WITH &&)` constraints physically reject overlapping shifts within a rotation layer.
- Resolves current responder via priority hierarchy: **User Overrides** &gt; **Rotation Layers (1..N)** &gt; **Service Fallback Owner**.

### ⚡ Alert Deduplication & Fingerprinting
- Ingested alerts compute an immutable fingerprint: `SHA256(serviceId + alertName + targetResource)`.
- If an alert arrives for an open incident, it attaches to the existing ticket and increments `alertCount`, eliminating alert storms.

### ⏱️ Automated Escalation & Delayed Timers
- Powered by Redis and BullMQ delayed jobs (`delay = tier_timeout_minutes * 60 * 1000`).
- If unacknowledged within 15 minutes, automatically escalates from Tier 1 to Tier 2, then Tier 3, and eventually marks `EXHAUSTED`.
- Instant cancellation: delayed timers are cancelled immediately upon responder acknowledgment or resolution.

### 📊 Real-Time Operations Dashboard
- Next.js 14 App Router UI with dynamic status metrics, severity badges, and quick-action Acknowledge/Resolve buttons.
- Live incident updates streamed via Socket.IO WebSockets.
- Interactive on-call calendar with layer visualization and override creation modal.

### 🔐 JWT Authentication & Server-Side RBAC
- Stateless JWT access tokens with bcrypt password hashing (10 salt rounds).
- Strict role-based authorization guards distinguishing `ADMIN`, `LEAD`, and `RESPONDER`.
- Administrative privilege separation for override management, maintenance window scheduling, and user provisioning.

### 🛠️ Maintenance Windows & Noise Suppression
- Scheduled maintenance windows with timezone-aware start and end timestamps.
- Automatically suppresses alerts from paging on-call responders during planned service downtime.
- Retains full audit trail (`ALERT_SUPPRESSED_MAINTENANCE`) for accountability and postmortems.

### 📈 MTTA & MTTR Incident Velocity Analytics
- Accurate mathematical computation of Mean Time to Acknowledge (MTTA) and Mean Time to Resolve (MTTR).
- Date-range filtering (7d, 14d, 30d) and per-service performance breakdown tables.
- Daily incident volume, acknowledgment, and resolution trend visualizations.

---

## 4. Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend** | Next.js 14, React 18, Tailwind CSS, Lucide | Responsive real-time dashboard and schedule UI |
| **Backend** | NestJS 10, TypeScript, Express | Modular REST API and WebSocket gateway |
| **Database** | PostgreSQL 16 (`btree_gist`, `uuid-ossp`) | Temporal range types, GiST exclusion constraints |
| **Queue** | Redis 7, BullMQ | Delayed jobs for reliable escalation timers |
| **Real-time** | Socket.IO | Live bi-directional updates to web clients |
| **Testing** | Jest, Supertest, Fake Timers | Unit, time-advancement, concurrency, and E2E tests |
| **CI/CD** | GitHub Actions, Docker Compose | Automated linting, test suites, and containerization |

---

## 5. Database Schema

The core relational schema is managed in [`database/migrations/001_initial_schema.sql`](database/migrations/001_initial_schema.sql) and [`database/migrations/002_auth_maintenance_schema.sql`](database/migrations/002_auth_maintenance_schema.sql):

- `users`: Responder identity, contact info, hashed password (`password_hash`), and roles (`ADMIN`, `LEAD`, `RESPONDER`).
- `services`: Monitored microservices with secret ingestion API keys and fallback owners.
- `schedules`: Service on-call calendars with timezone definitions.
- `schedule_layers`: Base recurring shifts with `tstzrange` and GiST exclusion constraints.
- `overrides`: Temporary shift overrides superseding base rotations.
- `maintenance_windows`: Scheduled service downtime suppressing alerts from waking responders.
- `incidents`: Incident lifecycle state, fingerprint, severity, alert count, and escalation job IDs.
- `notifications`: Audit log of outbound alert dispatches (email, webhook, SMS mock).
- `audit_log`: Immutable timeline logs of all state transitions, user actions, and alert suppressions.

---

## 6. API Reference

| Method | Endpoint | Description | Auth / Role |
|---|---|---|---|
| `POST` | `/ingest/:serviceKey` | Receive monitoring webhook alert | Service API Key |
| `GET` | `/health` | System health and uptime status | Public |
| `POST` | `/api/v1/auth/register` | Register new user account | Public |
| `POST` | `/api/v1/auth/login` | Authenticate user & issue JWT | Public |
| `GET` | `/api/v1/auth/me` | Fetch active user profile | JWT |
| `GET` | `/api/v1/incidents` | List all open and resolved incidents (filters & pagination) | JWT |
| `GET` | `/api/v1/incidents/:id` | Get incident details and metadata | JWT |
| `POST` | `/api/v1/incidents/:id/acknowledge` | Acknowledge incident & cancel escalation timer | JWT / Responder |
| `POST` | `/api/v1/incidents/:id/ack` | Alias for acknowledging incident | JWT / Responder |
| `POST` | `/api/v1/incidents/:id/resolve` | Resolve incident & finalize timeline | JWT / Responder |
| `GET` | `/api/v1/schedules` | List all team schedules & layers | JWT |
| `GET` | `/api/v1/schedules/:serviceId/on-call` | Resolve active responder for service right now | JWT |
| `POST` | `/api/v1/schedules/:scheduleId/overrides` | Create temporary on-call shift override | Admin / Lead |
| `GET` | `/api/v1/maintenance` | List active, upcoming, and past maintenance windows | JWT |
| `POST` | `/api/v1/maintenance` | Schedule new maintenance window | Admin / Lead |
| `PUT` | `/api/v1/maintenance/:id` | Update maintenance window schedule | Admin / Lead |
| `DELETE` | `/api/v1/maintenance/:id` | Remove maintenance window | Admin / Lead |
| `GET` | `/api/v1/analytics/overview` | Aggregate MTTA, MTTR, and severity breakdown | JWT |
| `GET` | `/api/v1/analytics/services` | Service-by-service MTTA and MTTR performance | JWT |
| `GET` | `/api/v1/analytics/trends` | Daily incident volume and resolution trends | JWT |
| `GET` | `/api/v1/audit/:entityType/:entityId` | Retrieve complete audit trail for an incident | JWT |

---

## 7. Getting Started

### Prerequisites
- Node.js 20+ & npm
- Docker & Docker Compose **or** WSL2 with PostgreSQL 16 & Redis 7

### Option A: Run Full Stack via Docker Compose
```bash
# Clone the repository
git clone https://github.com/Sahana5000/OncallHQ.git
cd OncallHQ

# Spin up all services (PostgreSQL, Redis, NestJS Backend, Next.js Frontend)
docker-compose up --build -d
```
- Frontend available at: `http://localhost:3000`
- Backend API available at: `http://localhost:4000`

### Option B: Local Development Setup
1. **Start PostgreSQL 16 & Redis 7** (locally or via WSL):
   ```bash
   sudo service postgresql start
   sudo service redis-server start
   ```

2. **Configure Environment:**
   ```bash
   cp .env.example .env
   ```

3. **Install & Run Backend:**
   ```bash
   cd backend
   npm install
   npm run start:dev
   ```

4. **Install & Run Frontend:**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

---

## 8. Verification & Testing

The project maintains **94 automated tests** covering unit logic, authentication, RBAC, maintenance suppression, analytics calculations, fake-clock timers, concurrency, and end-to-end integration:

```bash
# 1. Run Backend Unit, Auth, Maintenance & Analytics Tests (73 tests across 14 suites)
cd backend
npm test

# 2. Run Backend End-to-End Integration Suite (against live DB & Redis) (3 tests)
npm run test:e2e

# 3. Run Frontend UI, Page, Maintenance & Analytics Tests (18 tests across 6 suites)
cd ../frontend
npm test

# 4. Run Production Builds
cd ../backend && npm run build
cd ../frontend && npm run build
```

---

## 9. Security & Reliability

- **Ingestion Boundary Security:** Webhook endpoint is authenticated with per-service secret tokens and throttled using `@nestjs/throttler` to prevent DoS alert storms.
- **Payload Validation:** Strict DTO validation with `class-validator` ensures all fields conform to RFC 4122 UUID and enum standards.
- **State Machine Concurrency:** Simultaneous acknowledgements are handled idempotently; duplicate requests return the acknowledged record without duplicate audit entries.
- **Fail-Safe Fallbacks:** If no active responder is assigned in overrides or layers, the system automatically falls back to the registered service owner.

---

## 10. License

This project is licensed under the MIT License.
