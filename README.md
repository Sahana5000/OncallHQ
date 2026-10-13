# OnCallHQ — Incident Response & On-Call Platform

OnCallHQ is an asynchronous, event-driven incident alerting, schedule management, and automated escalation platform.

## System Architecture Overview

```
Monitoring Tool ──(webhook)──► Ingestion API ──► Deduplication & Incident Creation
                                                         │
                                                         ▼
                                                  Schedule Engine
                                                         │
                                                         ▼
                                                BullMQ Queue (Redis)
                                                         │
                                                         ▼
                                             Escalation Worker / Timers
                                                         │
                                                         ▼
                                                PostgreSQL + WebSockets
                                                         │
                                                         ▼
                                                Next.js Dashboard
```

## Project Structure

- `backend/`: NestJS API application (Ingestion, Incidents, Schedules, Notifications, Audit modules)
- `frontend/`: Next.js 14 Web UI Dashboard & Schedule Calendar
- `database/migrations/`: PostgreSQL DDL migrations (ranges, exclusion constraints, indexing)
- `docs/`: Schedule & escalation semantics specification

## Getting Started

### Prerequisites
- Node.js 18+ & npm
- Docker & Docker Compose (optional for local DB/Redis containerization)

### Setup & Run
1. Start infrastructure services:
   ```bash
   docker-compose up -d
   ```
2. Start NestJS Backend:
   ```bash
   cd backend
   npm install
   npm run start:dev
   ```
3. Start Next.js Frontend:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
