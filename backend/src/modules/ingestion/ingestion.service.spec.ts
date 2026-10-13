import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UnauthorizedException } from '@nestjs/common';
import * as crypto from 'crypto';
import { IngestionService } from './ingestion.service';
import { Service } from '../../entities/service.entity';
import { IncidentsService } from '../incidents/incidents.service';
import { ScheduleResolverService } from '../schedules/schedule-resolver.service';
import { AuditService } from '../audit/audit.service';
import { IngestAlertDto } from './dto/ingest-alert.dto';
import { Incident, IncidentState, IncidentSeverity } from '../../entities/incident.entity';
import { User, UserRole } from '../../entities/user.entity';

describe('IngestionService', () => {
  let ingestionService: IngestionService;
  let serviceRepo: Repository<Service>;
  let incidentsService: IncidentsService;
  let scheduleResolverService: ScheduleResolverService;
  let auditService: AuditService;

  const mockService: Service = {
    id: 'service-uuid-100',
    orgId: 'org-uuid-100',
    name: 'Database Cluster',
    description: 'PostgreSQL Primary Cluster',
    ingestionKey: 'key_db_cluster_valid_key',
    fallbackUserId: 'user-uuid-fallback',
    fallbackUser: null as any,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockUser: User = {
    id: 'user-uuid-oncall',
    email: 'oncall@oncallhq.com',
    name: 'On-Call Responder',
    role: UserRole.RESPONDER,
    phoneNumber: '+15551234',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockTriggeredIncident: Incident = {
    id: 'incident-uuid-1',
    serviceId: mockService.id,
    service: mockService,
    fingerprint: 'expected_sha256_hash',
    title: 'High Memory Utilization',
    description: "Alert 'High Memory Utilization' triggered on resource 'db-node-01'",
    severity: IncidentSeverity.CRITICAL,
    state: IncidentState.TRIGGERED,
    assignedUserId: mockUser.id,
    assignedUser: mockUser,
    currentTier: 1,
    alertCount: 1,
    escalationJobId: null,
    ackedAt: null,
    resolvedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IngestionService,
        {
          provide: getRepositoryToken(Service),
          useValue: {
            findOne: jest.fn().mockImplementation(({ where }) => {
              if (where.ingestionKey === mockService.ingestionKey) {
                return Promise.resolve(mockService);
              }
              return Promise.resolve(null);
            }),
          },
        },
        {
          provide: IncidentsService,
          useValue: {
            findOpenIncidentByFingerprint: jest.fn(),
            createIncident: jest.fn().mockResolvedValue(mockTriggeredIncident),
            incrementAlertCount: jest.fn().mockImplementation((incidentId) =>
              Promise.resolve({
                ...mockTriggeredIncident,
                id: incidentId,
                alertCount: mockTriggeredIncident.alertCount + 1,
              }),
            ),
          },
        },
        {
          provide: ScheduleResolverService,
          useValue: {
            resolveOnCallUser: jest.fn().mockResolvedValue({
              serviceId: mockService.id,
              timestamp: new Date(),
              activeUser: mockUser,
              resolvedSource: 'LAYER',
            }),
          },
        },
        {
          provide: AuditService,
          useValue: {
            createLog: jest.fn().mockResolvedValue({ id: 'audit-log-uuid-1' }),
          },
        },
      ],
    }).compile();

    ingestionService = module.get<IngestionService>(IngestionService);
    serviceRepo = module.get<Repository<Service>>(getRepositoryToken(Service));
    incidentsService = module.get<IncidentsService>(IncidentsService);
    scheduleResolverService = module.get<ScheduleResolverService>(ScheduleResolverService);
    auditService = module.get<AuditService>(AuditService);
  });

  describe('generateFingerprint', () => {
    it('should calculate deterministic SHA-256 fingerprint from serviceId + alertName + targetResource', () => {
      const serviceId = 'service-123';
      const alertName = 'HighCPUUsage';
      const targetResource = 'web-server-01';

      const raw = `${serviceId}${alertName}${targetResource}`;
      const expectedHash = crypto.createHash('sha256').update(raw).digest('hex');

      const result = ingestionService.generateFingerprint(
        serviceId,
        alertName,
        targetResource,
      );

      expect(result).toBe(expectedHash);
      expect(result.length).toBe(64); // SHA-256 hex length
    });
  });

  describe('processIngestAlert', () => {
    it('should throw UnauthorizedException for an invalid service key', async () => {
      const dto = new IngestAlertDto();
      dto.title = 'Disk Space Low';

      await expect(
        ingestionService.processIngestAlert('invalid_service_key', dto),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should trigger a NEW incident when no open incident matches the fingerprint', async () => {
      (incidentsService.findOpenIncidentByFingerprint as jest.Mock).mockResolvedValue(
        null,
      );

      const dto = new IngestAlertDto();
      dto.alertName = 'High Memory Utilization';
      dto.targetResource = 'db-node-01';
      dto.title = 'High Memory Utilization';
      dto.severity = IncidentSeverity.CRITICAL;

      const result = await ingestionService.processIngestAlert(
        mockService.ingestionKey,
        dto,
      );

      expect(result.status).toBe('triggered');
      expect(result.action).toBe('INCIDENT_TRIGGERED');
      expect(result.incidentId).toBe(mockTriggeredIncident.id);
      expect(result.alertCount).toBe(1);
      expect(result.assignedUserId).toBe(mockUser.id);
      expect(result.resolvedSource).toBe('LAYER');

      expect(incidentsService.createIncident).toHaveBeenCalled();
      expect(auditService.createLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'INCIDENT_TRIGGERED',
          entityType: 'INCIDENT',
          entityId: mockTriggeredIncident.id,
        }),
      );
    });

    it('should DEDUPLICATE and increment alert_count when an open incident exists for the fingerprint', async () => {
      (incidentsService.findOpenIncidentByFingerprint as jest.Mock).mockResolvedValue(
        mockTriggeredIncident,
      );

      const dto = new IngestAlertDto();
      dto.alertName = 'High Memory Utilization';
      dto.targetResource = 'db-node-01';
      dto.title = 'High Memory Utilization';

      const result = await ingestionService.processIngestAlert(
        mockService.ingestionKey,
        dto,
      );

      expect(result.status).toBe('deduplicated');
      expect(result.action).toBe('ALERT_DEDUPLICATED');
      expect(result.incidentId).toBe(mockTriggeredIncident.id);
      expect(result.alertCount).toBe(2);

      expect(incidentsService.incrementAlertCount).toHaveBeenCalledWith(
        mockTriggeredIncident.id,
      );
      expect(incidentsService.createIncident).not.toHaveBeenCalled();
      expect(auditService.createLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'ALERT_DEDUPLICATED',
          entityType: 'INCIDENT',
          entityId: mockTriggeredIncident.id,
        }),
      );
    });
  });
});
