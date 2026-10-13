import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { INCIDENT_ESCALATION_QUEUE } from '../src/modules/incidents/escalation.service';

describe('OnCallHQ System E2E Integration Suite', () => {
  let app: INestApplication;

  const mockQueue = {
    add: jest.fn().mockResolvedValue({ id: 'mock-job-id' }),
    getJob: jest.fn().mockResolvedValue(null),
    remove: jest.fn().mockResolvedValue(true),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(getQueueToken(INCIDENT_ESCALATION_QUEUE))
      .useValue(mockQueue)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1', {
      exclude: ['ingest/(.*)', 'ingest', 'health'],
    });
    app.enableCors();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());

    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('GET /health - System Health Check', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect((res) => {
        expect(res.body.status).toBe('ok');
        expect(res.body.service).toBe('OnCallHQ API Service');
      });
  });

  it('POST /ingest/invalid_key - Unauthorized Response for Invalid Key', () => {
    return request(app.getHttpServer())
      .post('/ingest/invalid_key')
      .send({
        alertName: 'Test Alert',
        targetResource: 'res-1',
        title: 'Test Alert Title',
        severity: 'HIGH',
      })
      .expect(401)
      .expect((res) => {
        expect(res.body.statusCode).toBe(401);
        expect(res.body.message).toContain('Invalid ingestion service key');
      });
  });

  it('Full Incident Lifecycle E2E Flow (Ingest -> Dedup -> Ack -> Resolve -> Audit)', async () => {
    const serviceKey = 'test_service_key_123';
    const targetResource = `e2e-node-${Date.now()}`;
    const userId = '11111111-1111-1111-1111-111111111111';

    // 1. Ingest Alert & Trigger Incident
    const ingestRes = await request(app.getHttpServer())
      .post(`/ingest/${serviceKey}`)
      .send({
        alertName: 'High CPU Load',
        targetResource: targetResource,
        severity: 'CRITICAL',
        title: `E2E High CPU on ${targetResource}`,
        description: 'CPU threshold exceeded 95%',
      })
      .expect(200);

    expect(ingestRes.body.status).toBe('triggered');
    expect(ingestRes.body.action).toBe('INCIDENT_TRIGGERED');
    const incidentId = ingestRes.body.incidentId;
    expect(incidentId).toBeDefined();

    // 2. Fetch Incident Details
    const detailRes = await request(app.getHttpServer())
      .get(`/api/v1/incidents/${incidentId}`)
      .expect(200);

    expect(detailRes.body.id).toBe(incidentId);
    expect(detailRes.body.state).toBe('TRIGGERED');

    // 3. Deduplication Alert Ingestion
    const dedupRes = await request(app.getHttpServer())
      .post(`/ingest/${serviceKey}`)
      .send({
        alertName: 'High CPU Load',
        targetResource: targetResource,
        severity: 'CRITICAL',
        title: `E2E High CPU on ${targetResource}`,
      })
      .expect(200);

    expect(dedupRes.body.status).toBe('deduplicated');
    expect(dedupRes.body.alertCount).toBe(2);

    // 4. Acknowledge Incident
    const ackRes = await request(app.getHttpServer())
      .post(`/api/v1/incidents/${incidentId}/acknowledge`)
      .send({ userId })
      .expect(200);

    expect(ackRes.body.state).toBe('ACKNOWLEDGED');
    expect(ackRes.body.ackedAt).toBeDefined();

    // 5. Resolve Incident
    const resolveRes = await request(app.getHttpServer())
      .post(`/api/v1/incidents/${incidentId}/resolve`)
      .send({ userId })
      .expect(200);

    expect(resolveRes.body.state).toBe('RESOLVED');
    expect(resolveRes.body.resolvedAt).toBeDefined();

    // 6. Audit Trail Verification
    const auditRes = await request(app.getHttpServer())
      .get(`/api/v1/audit/INCIDENT/${incidentId}`)
      .expect(200);

    const actions = auditRes.body.map((l: any) => l.action);
    expect(actions).toContain('INCIDENT_TRIGGERED');
    expect(actions).toContain('ALERT_DEDUPLICATED');
    expect(actions).toContain('INCIDENT_ACKNOWLEDGED');
    expect(actions).toContain('INCIDENT_RESOLVED');
  });
});
