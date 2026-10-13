import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { IncidentsService, MAX_ESCALATION_TIERS } from './incidents.service';
import { Incident, IncidentState, IncidentSeverity } from '../../entities/incident.entity';
import { EscalationService } from './escalation.service';
import { AuditService } from '../audit/audit.service';
import { ScheduleResolverService } from '../schedules/schedule-resolver.service';
import { NotificationsService } from '../notifications/notifications.service';
import { User, UserRole } from '../../entities/user.entity';
import { Service } from '../../entities/service.entity';

describe('IncidentsService (Phase 4 Escalation Engine & Phase 5 Integration)', () => {
  let incidentsService: IncidentsService;
  let incidentRepo: Repository<Incident>;
  let escalationService: EscalationService;
  let auditService: AuditService;
  let scheduleResolverService: ScheduleResolverService;
  let notificationsService: NotificationsService;

  const mockUser: User = {
    id: 'user-uuid-1',
    email: 'responder@oncallhq.com',
    name: 'Primary Responder',
    role: UserRole.RESPONDER,
    phoneNumber: '+15551111',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockService: Service = {
    id: 'service-uuid-1',
    orgId: 'org-uuid-1',
    name: 'Auth Service',
    description: 'Authentication Microservice',
    ingestionKey: 'auth_key_123',
    fallbackUserId: mockUser.id,
    fallbackUser: mockUser,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockIncident: Incident = {
    id: 'incident-uuid-1',
    serviceId: mockService.id,
    service: mockService,
    fingerprint: 'sha256_mock_fingerprint',
    title: 'High CPU Load',
    description: 'CPU usage exceeds 95%',
    severity: IncidentSeverity.HIGH,
    state: IncidentState.TRIGGERED,
    assignedUserId: mockUser.id,
    assignedUser: mockUser,
    currentTier: 1,
    alertCount: 1,
    escalationJobId: 'escalate-incident-uuid-1-tier-1',
    ackedAt: null,
    resolvedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IncidentsService,
        {
          provide: getRepositoryToken(Incident),
          useValue: {
            create: jest.fn().mockImplementation((dto) => ({ ...dto })),
            save: jest.fn().mockImplementation((entity) =>
              Promise.resolve({
                ...entity,
                id: entity.id || 'incident-uuid-1',
              }),
            ),
            findOne: jest.fn().mockImplementation(({ where }) => {
              if (where.id === mockIncident.id || where.id === 'incident-uuid-1') {
                return Promise.resolve({ ...mockIncident });
              }
              return Promise.resolve(null);
            }),
            find: jest.fn().mockResolvedValue([mockIncident]),
          },
        },
        {
          provide: EscalationService,
          useValue: {
            scheduleEscalation: jest
              .fn()
              .mockResolvedValue('escalate-incident-uuid-1-tier-2'),
            cancelEscalation: jest.fn().mockResolvedValue(true),
          },
        },
        {
          provide: AuditService,
          useValue: {
            createLog: jest.fn().mockResolvedValue({ id: 'audit-log-uuid-1' }),
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
          provide: NotificationsService,
          useValue: {
            dispatchIncidentNotification: jest.fn().mockResolvedValue([]),
          },
        },
      ],
    }).compile();

    incidentsService = module.get<IncidentsService>(IncidentsService);
    incidentRepo = module.get<Repository<Incident>>(getRepositoryToken(Incident));
    escalationService = module.get<EscalationService>(EscalationService);
    auditService = module.get<AuditService>(AuditService);
    scheduleResolverService = module.get<ScheduleResolverService>(ScheduleResolverService);
    notificationsService = module.get<NotificationsService>(NotificationsService);
  });

  describe('createIncident', () => {
    it('should create an incident in TRIGGERED state, schedule Tier 1 timer, and trigger notifications', async () => {
      const result = await incidentsService.createIncident({
        serviceId: mockService.id,
        fingerprint: 'sha256_mock_fingerprint',
        title: 'High CPU Load',
      });

      expect(result.state).toBe(IncidentState.TRIGGERED);
      expect(result.currentTier).toBe(1);
      expect(escalationService.scheduleEscalation).toHaveBeenCalledWith(
        'incident-uuid-1',
        1,
      );
      expect(notificationsService.dispatchIncidentNotification).toHaveBeenCalled();
    });
  });

  describe('acknowledgeIncident', () => {
    it('should acknowledge TRIGGERED incident, cancel timer, and set ackedAt timestamp', async () => {
      const result = await incidentsService.acknowledgeIncident(
        mockIncident.id,
        mockUser.id,
      );

      expect(result.state).toBe(IncidentState.ACKNOWLEDGED);
      expect(result.assignedUserId).toBe(mockUser.id);
      expect(result.ackedAt).toBeInstanceOf(Date);
      expect(result.escalationJobId).toBeNull();

      expect(escalationService.cancelEscalation).toHaveBeenCalledWith(
        'escalate-incident-uuid-1-tier-1',
      );
    });
  });

  describe('handleTierEscalation', () => {
    it('should escalate Tier 1 to Tier 2 and dispatch notification', async () => {
      const result = await incidentsService.handleTierEscalation(
        mockIncident.id,
        1,
      );

      expect(result.state).toBe(IncidentState.ESCALATED);
      expect(result.currentTier).toBe(2);
      expect(notificationsService.dispatchIncidentNotification).toHaveBeenCalled();
    });
  });
});
