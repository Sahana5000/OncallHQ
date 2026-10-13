# SentinelDesk — Vulnerability Disclosure & Triage Platform

---

## 1. Project Overview

- **Project name:** SentinelDesk
- **Short name:** SentinelDesk
- **Domain:** Application Security / Security Operations
- **One-line description:** A platform where security researchers report vulnerabilities to organizations, and organizations triage, score, fix, and disclose them through a controlled workflow.
- **2–3 line explanation:** Companies that accept vulnerability reports usually manage them through a shared inbox with no tracking. SentinelDesk replaces that with a structured pipeline: researchers submit reports, triage engineers validate and score them, engineers fix them, and the whole process is logged and time-tracked until safe public disclosure.
- **Main purpose:** Teach workflow modelling, access control, and secure system design through a real, defensible domain.
- **Target users:** Independent security researchers, triage engineers, engineering owners, organization admins, platform admins.
- **Difficulty:** 8/10
- **Expected development time:** 10–14 weeks at 5–8 hrs/week for MVP + core stretch features.
- **Current status:** Phase 1 (Requirements Engineering) complete. Phase 2 (System Design) next.

**Explained like you're not technical:** Imagine a company gets an email saying "I found a way to break into your website." Right now most companies handle that badly — the email gets lost, nobody's sure who owns it, and the person who found the bug never hears back. SentinelDesk is a website that gives that whole process structure: a form to report the bug safely, a queue for the security team to review it, a clock that makes sure nobody forgets about it, and a record of everything that happened, so bugs get fixed instead of ignored.

---

## 2. Problem Statement

**Formal:** Organizations that operate a vulnerability disclosure or bug-bounty-style intake process commonly rely on unstructured channels (shared email inboxes, spreadsheets, chat channels) that provide no state tracking, no severity standardization, no service-level guarantees, and no auditable, access-controlled mechanism for handling sensitive proof-of-concept material or coordinating public disclosure.

**Simple version:** Companies that let outsiders report security bugs usually don't have a proper system for it. Reports get lost, nobody agrees on how serious a bug is, there's no deadline pressure to fix things, and there's no safe way to share evidence of the bug without it leaking.

- **Who experiences it:** Security teams at companies of any size that accept external reports; independent researchers submitting them.
- **Why it matters:** Unpatched, unacknowledged vulnerabilities stay exploitable. Frustrated researchers sometimes publish bugs publicly ("full disclosure") before a fix ships, which is worse for everyone.
- **What happens today:** Email, spreadsheets, ad hoc Slack channels, or a paid third-party platform.
- **Why current approaches fall short:** Manual coordination doesn't scale past a handful of reports a month, has no enforced audit trail, and gives researchers no visibility into progress.

---

## 3. Real-World Day-to-Day Problem

- A researcher emails `security@company.com` on a Friday. The inbox isn't checked until Monday. By the time someone replies, the researcher has already lost interest or gone public.
- Two researchers independently report the same bug three days apart. Two different engineers investigate it from scratch, wasting effort, because nobody could search past reports for similarity.
- A critical report sits untouched for three weeks because the one person who reads the security inbox is on leave — there's no ownership, no escalation, no deadline.
- A researcher attaches a working exploit as a plain email attachment. It sits in an inbox forever, readable by anyone with inbox access, with no expiry and no access log.
- Legal wants to know exactly when the company was first told about a bug that was later exploited. Nobody can produce a reliable timestamp or record of who saw it.

Each of these is a **technical** problem, not just a process problem: missing SLA enforcement, no duplicate detection, no ownership/escalation model, no secure file handling, no audit trail.

---

## 4. Current Solutions

| Current Solution | How It Works | Advantages | Limitations |
|---|---|---|---|
| Shared email inbox (`security@`) | Reports arrive as emails; a person manually forwards/tracks them | Free, zero setup | No workflow, no SLA, no audit trail, easy to lose reports |
| Spreadsheet tracker | Team manually logs each report as a row | Slightly more structure than email | No access control, no automation, doesn't scale, manual and error-prone |
| HackerOne / Bugcrowd (commercial) | Full managed bug-bounty platforms with triage, payouts, researcher reputation | Mature, handles payments, large researcher community | Expensive, per-seat/program pricing, overkill for a company just wanting structured intake without a public bounty program |
| Self-hosted issue tracker (e.g., a security-labeled Jira/GitLab project) | Reports filed as tickets in an existing tracker | Reuses existing tooling | Not designed for external, untrusted submitters; poor separation between public researcher view and internal notes; no CVSS tooling built in |

---

## 5. Limitations of Current Solutions

| Current Approach | What It Solves | Limitation | Gap Our Project Addresses |
|---|---|---|---|
| Email inbox | Basic intake | No state tracking, no SLA, no dedup | Structured state machine + SLA timers + duplicate detection |
| Spreadsheet | Some visibility | No access control, manual, doesn't scale | Role-based access, automated workflow |
| Commercial platforms | Full workflow + payouts | Cost, complexity, vendor lock-in for a simple internal need | A lean, self-hostable version focused on triage and disclosure, not payments |
| Issue trackers | Reuses existing tools | Not built for untrusted external submitters, no CVSS or disclosure workflow | Purpose-built researcher-facing intake with strict internal/external visibility separation |

---

## 6. What Our Project Solves

**Primary problems:**
- No structured intake or state tracking for vulnerability reports
- No enforced SLA / response-time accountability
- No safe handling of sensitive attachments
- No audit trail of who did what, when

**Secondary problems:**
- Duplicate reports wasting triage effort
- No standardized severity scoring
- No controlled coordinated-disclosure process

**Problems NOT covered (explicitly out of scope):**
- Bug bounty payment processing
- Public researcher leaderboards/reputation systems
- Mobile apps
- SSO/SAML enterprise integration
- Multi-language support

---

## 7. Proposed Solution

**Simple version:** A website with three main areas — one for researchers to submit and track reports, one for the security team to triage and work them, and one for admins to configure programs and see compliance metrics. Behind the scenes, a server enforces strict rules about who can see what and what can happen next to a report.

**Technical flow:**

```
Researcher / Triage Engineer / Admin
              ↓
        Frontend (Next.js)
              ↓
        REST API (NestJS)
              ↓
   Business Logic (state machine, RBAC, CVSS scoring)
              ↓
  Security / Processing Engine (auth guards, tenant isolation,
     validation, audit logging, transactional state transitions)
              ↓
   Database (PostgreSQL) + File Storage (S3/MinIO) + Cache (Redis)
              ↓
     Async Workers (email, SLA checks, duplicate search) + Audit Log
```

---

## 8. Complete System Workflow

1. Researcher submits a report against a program (title, description, affected asset, attachments).
2. API validates the input (schema validation, file type/size checks).
3. Authentication confirms who the user is; authorization confirms they may submit to this program.
4. Report is created in state `NEW`, tenant-scoped to the receiving organization.
5. A background job checks for likely duplicate reports using text similarity.
6. Triage engineer opens the report; the system checks their role and org membership before showing internal data.
7. Triage engineer transitions the report (`NEW → TRIAGING → ACCEPTED`), which is validated against the state machine and their role, inside a single database transaction with the audit-log write.
8. On `ACCEPTED`, an SLA deadline is computed from severity and stored.
9. Engineer is assigned; internal comments are added as work happens.
10. A scheduled worker checks for SLA breaches and sends escalation notifications.
11. Report reaches `RESOLVED`; org admin can trigger coordinated disclosure after an embargo period.
12. Every transition and access-relevant event is written to an immutable audit log.

---

## 9. System Architecture

```
                     ┌────────────────────┐
                     │      Browser        │
                     │  (Researcher/Triage/ │
                     │   Admin - role UI)   │
                     └──────────┬───────────┘
                                │ HTTPS
                     ┌──────────▼───────────┐
                     │   Next.js Frontend    │
                     └──────────┬───────────┘
                                │ REST + WebSocket
                     ┌──────────▼───────────┐
                     │   NestJS API Layer     │
                     │ (Controllers, Guards,  │
                     │  RBAC, Validation)     │
                     └──────┬───────────┬────┘
                            │           │
                 ┌──────────▼──┐   ┌────▼─────────┐
                 │ Service Layer│   │  Job Queue    │
                 │ (state machine,│  │ (BullMQ/Redis)│
                 │  CVSS, tenant  │  │ SLA checks,   │
                 │  isolation)    │  │ email, dedup  │
                 └──────┬────────┘   └──────┬────────┘
                        │                   │
              ┌─────────▼─────────┐  ┌──────▼──────┐
              │   PostgreSQL       │  │ S3 / MinIO   │
              │ (reports, orgs,    │  │ (attachments,│
              │  audit log, users) │  │ signed URLs) │
              └────────────────────┘  └──────────────┘
```

**Trust boundary:** everything left of the API layer is untrusted input. Everything inside the service layer must re-verify tenant and role on every request — the frontend's UI restrictions are a convenience, never a security control.

---

## 10. Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Frontend | Next.js + TypeScript + Tailwind | Type safety, component reuse, server-side rendering for the public program pages |
| Backend | NestJS | Enforces layered architecture (controllers/services/repositories) and has first-class support for guards (auth), which this project leans on heavily |
| Database | PostgreSQL | Strong relational integrity, full-text search (`tsvector`), trigram similarity (`pg_trgm`) for duplicate detection — all needed features, not decoration |
| Authentication | JWT (access + refresh tokens) | Stateless, works cleanly with a separate frontend/backend, standard for this project size |
| File storage | S3-compatible (MinIO for local dev) | Private-by-default storage with signed URLs; alternative would be storing files on disk, which doesn't scale and is harder to secure |
| Queue | Redis + BullMQ | Needed for SLA timers, email sending, and duplicate-search jobs to run off the request path |
| Infrastructure | Docker Compose | One-command local environment matching production topology |
| Security | bcrypt (password hashing), class-validator (input validation), helmet (HTTP headers) | Baseline secure-by-default practices |
| Testing | Jest (unit/integration), Supertest (API), Playwright (E2E) | Standard, well-documented tooling with strong TypeScript support |
| Monitoring | Structured logging (pino) + basic health endpoint | Sufficient for a portfolio project; a full observability stack (Prometheus/Grafana) is optional stretch, not required |
| Deployment | Single VM or free-tier cloud + Docker Compose | Keeps cost at zero; Kubernetes would be overkill for this project's scale and is explicitly not required |

---

## 11. Core CS Concepts

- **Finite state machines:** the report lifecycle is a formally defined state machine with legal/illegal transitions.
- **Transactions & ACID:** state transitions and audit-log writes must succeed or fail together.
- **Indexing (B-tree, GIN, trigram):** used for fast filtering and duplicate detection.
- **Full-text search:** Postgres `tsvector`/`tsquery` for searching report content.
- **Graph-free but relational modelling:** multi-tenant schema design, foreign keys, constraints.
- **Asynchronous/event-driven processing:** queue-based side effects decoupled from the request path.
- **Caching:** Redis for rate-limit counters and session/token blacklisting.
- **API design:** REST resource modelling, pagination, filtering.

---

## 12. Cybersecurity Concepts

- **Authentication:** JWT-based login, refresh token rotation, password hashing with bcrypt.
- **Authorization / RBAC:** researcher, triage engineer, engineering owner, org admin, platform admin — each with a distinct permission set enforced server-side.
- **Multi-tenant isolation:** no query may cross organization boundaries; covered via repository-level tenant scoping or row-level security.
- **Input validation:** every DTO validated against a schema before touching business logic.
- **SQL injection prevention:** parameterized queries via the ORM; no raw string concatenation.
- **XSS prevention:** Markdown rendering sanitized before display; no raw HTML render of user content.
- **CSRF considerations:** relevant if using cookie-based auth; mitigated via same-site cookies or token-based auth with no cookie reliance.
- **Secure file uploads:** type/size validation, private storage, signed URLs with short expiry, never served from the app's own origin.
- **Rate limiting:** on submission and authentication endpoints to prevent abuse/brute force.
- **Secrets management:** environment variables, never committed, `.env.example` documents required keys without values.
- **Audit logging:** immutable record of every state-changing and access-relevant action.
- **OWASP Top 10:** broken access control, injection, and security misconfiguration are the three most directly exercised by this project.

---

## 13. Database Design

**Why PostgreSQL:** relational integrity for a domain with strict relationships (org → program → report → comment), transactional guarantees for state transitions, and built-in full-text/trigram search that removes the need for a separate search engine.

**Core tables (conceptual):**

```
organizations (id, name, created_at)
users (id, org_id, email, password_hash, role, created_at)
programs (id, org_id, name, scope_in, scope_out, rules, created_at)
reports (id, program_id, reporter_id, title, description, state,
         severity, cvss_vector, assigned_to, sla_deadline, created_at)
comments (id, report_id, author_id, body, internal_only, created_at)
attachments (id, report_id, storage_key, filename, mime_type, uploaded_by, created_at)
audit_log (id, org_id, actor_id, action, entity_type, entity_id,
           before_state, after_state, created_at)
```

**Relationships:** one organization has many programs; one program has many reports; one report has many comments and attachments; every state-changing action produces one audit_log row.

**Constraints:** `reports.state` restricted via a check constraint or enum type; `reports.program_id` and all tenant-scoped tables carry `org_id` (directly or via join) to support isolation checks.

**Indexes:** composite index on `(program_id, state, created_at)` for the triage queue; GIN index on a `tsvector` column of title+description for search; trigram index on `title` for duplicate detection.

**Important queries:** "all open reports for triage engineer X, sorted by SLA deadline" and "reports similar to report Y" are the two queries whose performance you should benchmark explicitly.

---

## 14. API Design

| Method | Endpoint | Purpose | Request | Response | Auth |
|---|---|---|---|---|---|
| POST | /auth/login | Authenticate user | email, password | access + refresh token | None |
| POST | /reports | Submit a report | title, description, programId, attachments | report object | Researcher |
| GET | /reports | List reports (role-scoped) | query filters | paginated report list | Any authenticated role |
| GET | /reports/:id | View report detail | — | report + role-scoped comments | Any authenticated role, tenant-checked |
| POST | /reports/:id/transition | Change report state | targetState | updated report | Triage/Owner, state-machine-validated |
| POST | /reports/:id/comments | Add comment | body, internalOnly | comment object | Any role, internalOnly restricted to staff |
| POST | /reports/:id/attachments | Upload attachment | multipart file | signed storage reference | Researcher/Staff |
| GET | /programs | List public programs | — | program list | None (public listing) |
| POST | /programs | Create program | name, scope, rules | program object | Org Admin |

---

## 15. Folder Structure

```
sentineldesk/
├── frontend/
│   ├── app/
│   ├── components/
│   └── lib/
├── backend/
│   ├── src/
│   │   ├── modules/
│   │   │   ├── auth/
│   │   │   ├── reports/
│   │   │   ├── programs/
│   │   │   ├── comments/
│   │   │   └── audit/
│   │   ├── common/ (guards, decorators, filters)
│   │   └── main.ts
├── database/
│   └── migrations/
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── docs/
├── docker/
├── scripts/
├── .env.example
├── README.md
└── docker-compose.yml
```

---

## 16. Security Architecture

- **Trust boundaries:** browser → API is the primary boundary; treat every request as hostile until authenticated and authorized.
- **Attack surface:** public report-submission endpoint (untrusted input + file upload), public program listing (must not leak private programs), triage endpoints (privilege boundary between roles).
- **Authentication:** JWT with short-lived access tokens and rotated refresh tokens.
- **Authorization:** guard-based RBAC checked on every request; tenant ID verified against the resource being accessed, not just the requester's claimed org.
- **Data protection:** attachments private by default, signed URLs expire quickly, passwords hashed with bcrypt.
- **Secrets:** environment-variable based, never logged.
- **Logging:** structured logs exclude secrets and full attachment contents; audit log is append-only.
- **Rate limiting:** applied to auth and submission endpoints.
- **Input validation:** every write endpoint validated with class-validator DTOs.
- **Secure communication:** HTTPS enforced in production; HSTS header set.

---

## 17. Threat Model (STRIDE-based)

| Asset | Threat | Attack Surface | Impact | Mitigation |
|---|---|---|---|---|
| Report data (cross-tenant) | Information disclosure | Any list/detail endpoint | One org sees another's vulnerabilities | Enforce org_id scoping in every query; test with an authorization matrix |
| Internal comments | Information disclosure | Report detail endpoint | Researcher sees internal-only notes | Role-based response shaping, tested explicitly |
| Report state | Tampering | Transition endpoint | Unauthorized state change (e.g. skip triage) | Server-side state machine validation tied to role |
| Attachments | Elevation of privilege / stored attack | Upload endpoint | Malicious file served back as executable content | Private storage, signed URLs, never served from app origin, type/size validation |
| Audit log | Repudiation | Direct DB access (insider threat) | Admin denies making a change | Append-only log; hash-chaining as a stretch goal |
| Auth endpoints | Spoofing / brute force | Login endpoint | Account takeover | Rate limiting, bcrypt, account lockout after repeated failures |
| Public program listing | Information disclosure | Unauthenticated endpoint | Private program details exposed | Explicit visibility flag checked before returning any program |

---

## 18. Testing Strategy

- **Unit testing:** state machine transition logic, CVSS score computation, permission-check functions.
- **Integration testing:** full request → service → database flow for report submission and transitions.
- **API testing:** Supertest suites hitting real endpoints against a test database.
- **Security testing:** the **authorization matrix** — every role × every endpoint × every report state, asserting exactly the expected allow/deny result. This is the single most valuable test suite in the project.
- **Performance testing:** triage queue query under a seeded dataset of several thousand reports.
- **Concurrency testing:** two triage engineers attempting to transition the same report simultaneously — assert only one succeeds and the loser gets a clear conflict error.
- **Failure testing:** database connection drop mid-transaction; ensure no partial state (report updated but audit log missing).
- **Edge cases:** empty report submission, oversized attachment, malformed CVSS vector, report already in a terminal state receiving a new transition request.

---

## 19. Performance

Relevant metrics for this project: API response latency (target sub-200ms for reads on realistic data volume), triage queue query time under load, database index hit rate (verified via `EXPLAIN ANALYZE`), and concurrent-request handling on the submission endpoint. Throughput/requests-per-second benchmarking is a reasonable stretch metric; detection-accuracy-style metrics (F1, false positive rate) don't apply here — this project's performance story is about database query efficiency and correct concurrency handling, not signal detection.

---

## 20. MVP

| Feature | MVP | Advanced |
|---|---|---|
| Auth + RBAC | ✅ | — |
| Report submission + state machine | ✅ | — |
| Role-scoped comments | ✅ | — |
| Basic file upload (private storage) | ✅ | Virus scanning — Advanced |
| CVSS scoring | ✅ (client-computed) | Server-verified scoring — Advanced |
| Triage queue (filter/sort/pagination) | ✅ | — |
| Audit log (plain, immutable) | ✅ | Hash-chained tamper-evidence — Advanced |
| SLA timers + breach escalation | ❌ | ✅ |
| Duplicate detection (full-text + trigram) | ❌ | ✅ |
| Real-time updates (WebSockets) | ❌ | ✅ |
| Coordinated disclosure automation | ❌ | ✅ |

---

## 21. Advanced Features

- **Phase 1 (post-MVP):** SLA timers with scheduled breach escalation; plain audit log upgraded to hash-chained.
- **Phase 2:** Duplicate detection via full-text and trigram search; WebSocket-based real-time triage updates.
- **Phase 3:** Antivirus scanning on upload; automated coordinated-disclosure scheduling; webhook notifications for external integrations.

None of these are required to demo the core value proposition — they extend it.

---

## 22. Development Roadmap

| Phase | Task | Expected Result |
|---|---|---|
| 1 | Requirements engineering | Documented requirements, user stories, MVP scope (done) |
| 2 | System design | Architecture diagrams, data flow, component boundaries |
| 3 | Project setup + Git | Repo, branching strategy, initial CI skeleton |
| 4 | Database design | Schema, migrations, seed data |
| 5 | Backend core | Auth, RBAC guards, report CRUD, state machine |
| 6 | API completion | Full endpoint set, validation, error handling |
| 7 | Frontend | Researcher, triage, and admin views |
| 8 | Integration | Frontend/backend wired end-to-end |
| 9 | Security hardening | Rate limiting, input validation audit, secure upload flow |
| 10 | Testing | Full test suite including authorization matrix |
| 11 | Dockerization + CI/CD | Compose stack, GitHub Actions pipeline |
| 12 | Deployment | Live deployed instance |
| 13 | Advanced features | SLA timers, duplicate detection, real-time updates |
| 14 | Documentation + demo prep | README, viva/interview prep, resume text |

---

## 23. Demo Plan (3–5 minutes)

1. **Show:** the public program page listing scope and rules.
2. **Do:** submit a report as a researcher, with an attachment.
3. **Internally:** report created in `NEW` state, tenant-scoped, attachment stored privately.
4. **Show:** switch to triage view, open the report, note the internal-only comment field is separate from the researcher-visible thread.
5. **Do:** transition the report `NEW → TRIAGING → ACCEPTED`, assign it, add a CVSS score.
6. **Explain:** the state machine enforcement — attempt an illegal transition live and show it's rejected, then show the resulting audit log entry.
7. **Close:** show the authorization-matrix test suite passing in CI as proof of the access-control claims.

---

## 24. Viva Questions (with short answers)

**Basic**
1. *What problem does SentinelDesk solve?* — Structures and secures the vulnerability-report intake and triage process.
2. *Who are the users?* — Researchers, triage engineers, engineering owners, org admins, platform admins.
3. *Why not just use email?* — No state tracking, no access control, no audit trail, no SLA enforcement.

**Architecture**
4. *Why NestJS over plain Express?* — Built-in module/guard system that maps directly onto the RBAC and layered-architecture requirements.
5. *Why is the queue separate from the API?* — Side effects like email and search shouldn't block the request that triggered them.
6. *What's the trust boundary in this system?* — Everything past the API layer; the frontend is never trusted for authorization decisions.

**Database**
7. *Why PostgreSQL over MongoDB?* — The data is inherently relational (org→program→report→comment) with strict constraints and needs transactional guarantees for state changes; the project also needs full-text/trigram search, which Postgres provides natively.
8. *How do you prevent cross-tenant data leaks?* — Every tenant-scoped query includes org_id, and this is verified by an automated authorization-matrix test suite, not just manual review.

**Security**
9. *How does RBAC work here?* — Guards check the requester's role and organization against the resource before the controller logic runs.
10. *How are attachments kept safe?* — Stored privately, served only via short-lived signed URLs, never on the app's own origin.
11. *What OWASP risks does this project address?* — Broken access control, injection, security misconfiguration.

**Backend**
12. *How is a state transition made safe?* — Validated against role and current state, executed inside a database transaction alongside the audit-log write.
13. *What happens if two people transition a report at once?* — One succeeds; the other gets a conflict response, tested explicitly.

**Advanced**
14. *How does duplicate detection work?* — Full-text search combined with trigram similarity on title and affected asset, surfaced to the triager at submission time.
15. *How would you scale this to a larger org?* — Add read replicas for the triage queue, move heavier search work to a dedicated search index if volume grows, and horizontally scale the API behind a load balancer.

---

## 25. Interview Questions

- *Why PostgreSQL instead of MongoDB?* — Because relationships and constraints matter more than schema flexibility here, and transactional integrity is required for correctness, not just convenience.
- *How do you prevent race conditions on state transitions?* — Transition logic runs inside a transaction with the audit write, and a unique constraint or optimistic-locking version check prevents two concurrent transitions from both succeeding.
- *How does authentication work?* — JWT access + refresh tokens, passwords hashed with bcrypt, tokens verified on every request via a guard.
- *How would this scale to a much larger user base?* — Horizontal API scaling, read replicas for hot queries, moving search to a dedicated engine, caching hot program/report metadata in Redis.
- *What happens if the database goes down?* — API returns a controlled 503 rather than a partial write; queued side effects retry once the database is back; no silent data loss because writes are transactional.
- *How would an attacker abuse this system?* — Attempting cross-tenant data access via a manipulated ID, uploading a malicious file, or attempting a privilege-escalation via a crafted request to the transition endpoint — all of which are covered by the threat model above.
- *What would you change for production?* — Add antivirus scanning on uploads, hash-chain the audit log, add proper observability (structured metrics/tracing), and run a real penetration test before go-live.

---

## 26. Resume Description

**One-line:** Built SentinelDesk, a multi-tenant vulnerability disclosure and triage platform with role-based access control, a server-enforced report state machine, and an immutable audit trail.

**Two-bullet:**
- Designed and built a multi-tenant vulnerability-triage platform (Next.js, NestJS, PostgreSQL) with a server-enforced report state machine and role-scoped API responses.
- Implemented an authorization-matrix test suite covering every role × endpoint × state combination, catching access-control regressions in CI.

**Three-bullet:**
- Designed and built a multi-tenant vulnerability-triage platform (Next.js, NestJS, PostgreSQL, Redis) with a server-enforced report state machine, RBAC, and an immutable audit log.
- Implemented secure file handling for sensitive proof-of-concept attachments using private object storage and short-lived signed URLs.
- Built an authorization-matrix test suite (Jest/Supertest) covering every role, endpoint, and report state, integrated into a GitHub Actions CI pipeline.

**Technology keywords:** TypeScript, Next.js, NestJS, PostgreSQL, Redis, BullMQ, Docker, GitHub Actions, JWT, RBAC, REST API, Jest, Playwright.

---

## 27. GitHub README Structure

```
# SentinelDesk

## Overview
## Problem
## Solution
## Architecture (with diagram)
## Features
## Tech Stack
## Installation
## Configuration (.env variables)
## Usage
## Testing
## Security (threat model summary, responsible disclosure note for the tool itself)
## Screenshots
## Demo (link or GIF)
## Future Scope
```

---

## 28. Future Scope

- **Server-verified CVSS scoring:** move the CVSS calculation from client-side to a server-validated computation to prevent tampering.
- **Hash-chained audit log:** cryptographically link each audit entry to its predecessor for tamper-evidence.
- **Webhook integrations:** let organizations connect Slack/Jira for real-time notifications.
- **Antivirus scanning:** integrate ClamAV on the upload path before a file becomes downloadable.

---

## 29. Why This Project Is Valuable

SentinelDesk demonstrates domain modelling under real constraints (a strict state machine, not a free-form CRUD form), server-enforced access control across multiple roles and tenants, secure handling of genuinely hostile input (uploaded proof-of-concept files), and transactional correctness under concurrent access. It is the one project in the portfolio where the security specialization and the software-engineering skill set reinforce each other directly, rather than sitting side by side.

---

## 30. Company Role Relevance

- **Software Engineer / Backend Engineer:** demonstrates layered architecture, transactional correctness, API design.
- **Full Stack Developer:** demonstrates a complete role-aware frontend wired to a secured backend.
- **Security Engineer / Application Security Engineer:** demonstrates RBAC design, threat modelling, secure file handling, and an authorization-testing discipline.
- **DevSecOps Engineer:** demonstrates security considerations built into CI (the authorization-matrix suite) rather than bolted on afterward.

---

*This document will be extended with the remaining six SentinelDesk-specific items — the detailed Phase 1 → Phase 2 → production roadmap, CVSS methodology, and notification design — in Phase 2 of the build itself.*
