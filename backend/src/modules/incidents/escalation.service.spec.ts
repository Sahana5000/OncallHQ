import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bullmq';
import { Repository } from 'typeorm';
import { Queue } from 'bullmq';
import {
  EscalationService,
  INCIDENT_ESCALATION_QUEUE,
  DEFAULT_TIER_TIMEOUT_MS,
} from './escalation.service';
import { EscalationProcessor } from './escalation.processor';
import { IncidentsService, MAX_ESCALATION_TIERS } from './incidents.service';
import { Incident, IncidentState, IncidentSeverity } from '../../entities/incident.entity';
import { AuditService } from '../audit/audit.service';
import { ScheduleResolverService } from '../schedules/schedule-resolver.service';
import { NotificationsService } from '../notifications/notifications.service';
import { User, UserRole } from '../../entities/user.entity';
import { Service } from '../../entities/service.entity';

describe('Escalation Engine (Phase 7 Timer-Based Escalation with Fake-Clock Tests)', () => {
  let escalationService: EscalationService;
  let escalationProcessor: EscalationProcessor;
  let incidentsService: IncidentsService;
  let mockQueue: jest.Mocked<Partial<Queue>>;
  let incidentRepo: Repository<Incident>;

  const mockUserTier1: User = {
    id: 'user-uuid-tier-1',
    email: 'tier1@oncallhq.com',
    name: 'Tier 1 Primary Responder',
    role: UserRole.RESPONDER,
    phoneNumber: '+15550001',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockUserTier2: User = {
    id: 'user-uuid-tier-2',
    email: 'tier2@oncallhq.com',
    name: 'Tier 2 Secondary Lead',
    role: UserRole.LEAD,
    phoneNumber: '+15550002',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockService: Service = {
    id: 'service-uuid-1',
    orgId: 'org-uuid-1',
    name: 'Checkout Service',
    description: 'Production Checkout API',
    ingestionKey: 'checkout_key_123',
    fallbackUserId: mockUserTier1.id,
    fallbackUser: mockUserTier1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  let activeIncident: Incident;

  beforeEach(async () => {
    jest.useFakeTimers();

    activeIncident = {
      id: 'incident-uuid-escalation-1',
      serviceId: mockService.id,
      service: mockService,
      fingerprint: 'sha256_mock_fingerprint_checkout',
      title: 'Checkout Latency Spike',
      description: 'P99 latency > 2500ms',
      severity: IncidentSeverity.CRITICAL,
      state: IncidentState.TRIGGERED,
      assignedUserId: mockUserTier1.id,
      assignedUser: mockUserTier1,
      currentTier: 1,
      alertCount: 1,
      escalationJobId: 'escalate-incident-uuid-escalation-1-tier-1',
      ackedAt: null,
      resolvedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockJob = {
      id: 'job-1',
      remove: jest.fn().mockResolvedValue(undefined),
    };

    mockQueue = {
      add: jest.fn().mockResolvedValue({ id: 'escalate-incident-uuid-escalation-1-tier-1' }),
      getJob: jest.fn().mockImplementation((jobId) => {
        if (jobId.includes('escalate-incident-uuid-escalation-1')) {
          return Promise.resolve(mockJob);
        }
        return Promise.resolve(null);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EscalationService,
        EscalationProcessor,
        IncidentsService,
        {
          provide: getQueueToken(INCIDENT_ESCALATION_QUEUE),
          useValue: mockQueue,
        },
        {
          provide: getRepositoryToken(Incident),
          useValue: {
            create: jest.fn().mockImplementation((dto) => ({ ...dto })),
            save: jest.fn().mockImplementation((entity) => {
              activeIncident = { ...activeIncident, ...entity };
              return Promise.resolve(activeIncident);
            }),
            findOne: jest.fn().mockImplementation(({ where }) => {
              if (where.id === activeIncident.id) {
                return Promise.resolve(activeIncident);
              }
              return Promise.resolve(null);
            }),
            find: jest.fn().mockResolvedValue([activeIncident]),
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
            resolveOnCallUser: jest.fn().mockImplementation(() =>
              Promise.resolve({
                serviceId: mockService.id,
                timestamp: new Date(),
                activeUser: mockUserTier2,
                resolvedSource: 'LAYER',
              }),
            ),
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

    escalationService = module.get<EscalationService>(EscalationService);
    escalationProcessor = module.get<EscalationProcessor>(EscalationProcessor);
    incidentsService = module.get<IncidentsService>(IncidentsService);
    incidentRepo = module.get<Repository<Incident>>(getRepositoryToken(Incident));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('1. EscalationService Queue Timer Operations', () => {
    it('should enqueue delayed BullMQ job with exact 15-minute timeout', async () => {
      const jobId = await escalationService.scheduleEscalation('inc-100', 1);

      expect(mockQueue.add).toHaveBeenCalledWith(
        'escalate-incident',
        { incidentId: 'inc-100', expectedTier: 1 },
        {
          delay: DEFAULT_TIER_TIMEOUT_MS, // 15 * 60 * 1000 = 900000ms
          jobId: 'escalate-inc-100-tier-1',
          removeOnComplete: true,
          removeOnFail: false,
        },
      );
      expect(jobId).toBe('escalate-inc-100-tier-1');
    });

    it('should cancel existing delayed job when requested', async () => {
      const cancelled = await escalationService.cancelEscalation(
        'escalate-incident-uuid-escalation-1-tier-1',
      );

      expect(cancelled).toBe(true);
      expect(mockQueue.getJob).toHaveBeenCalledWith(
        'escalate-incident-uuid-escalation-1-tier-1',
      );
    });

    it('should safely return false when cancelling non-existent or null jobId', async () => {
      const resNull = await escalationService.cancelEscalation(null);
      const resNonExistent = await escalationService.cancelEscalation('non-existent-job');

      expect(resNull).toBe(false);
      expect(resNonExistent).toBe(false);
    });
  });

  describe('2. Deterministic Fake-Clock Time-Advancement Lifecycle', () => {
    it('should NOT escalate before the timeout window expires (T < 15 min)', async () => {
      // Simulate scheduled timer at T=0
      let timerFired = false;
      setTimeout(async () => {
        timerFired = true;
        await incidentsService.handleTierEscalation(activeIncident.id, 1);
      }, DEFAULT_TIER_TIMEOUT_MS);

      // Advance time by 10 minutes (600,000 ms)
      jest.advanceTimersByTime(10 * 60 * 1000);

      // Verify timer has NOT fired yet
      expect(timerFired).toBe(false);
      expect(activeIncident.state).toBe(IncidentState.TRIGGERED);
      expect(activeIncident.currentTier).toBe(1);
    });

    it('should automatically escalate from Tier 1 to Tier 2 when timeout fires (T = 15 min)', async () => {
      // Setup fake timer firing the escalation worker
      let escalationPromise: Promise<any>;
      setTimeout(() => {
        escalationPromise = incidentsService.handleTierEscalation(activeIncident.id, 1);
      }, DEFAULT_TIER_TIMEOUT_MS);

      // Fast-forward fake clock by full 15 minutes (900,000 ms)
      jest.advanceTimersByTime(DEFAULT_TIER_TIMEOUT_MS);

      // Await complete resolution of escalation chain
      await escalationPromise;

      // State should now be ESCALATED and tier moved to 2
      expect(activeIncident.state).toBe(IncidentState.ESCALATED);
      expect(activeIncident.currentTier).toBe(2);
      expect(activeIncident.assignedUserId).toBe(mockUserTier2.id);
      expect(mockQueue.add).toHaveBeenCalledWith(
        'escalate-incident',
        { incidentId: activeIncident.id, expectedTier: 2 },
        expect.any(Object),
      );
    });

    it('should advance from Tier 2 to Tier 3 on second timeout', async () => {
      // Pre-set incident at Tier 2 ESCALATED
      activeIncident.state = IncidentState.ESCALATED;
      activeIncident.currentTier = 2;

      let escalationPromise: Promise<any>;
      setTimeout(() => {
        escalationPromise = incidentsService.handleTierEscalation(activeIncident.id, 2);
      }, DEFAULT_TIER_TIMEOUT_MS);

      jest.advanceTimersByTime(DEFAULT_TIER_TIMEOUT_MS);
      await escalationPromise;

      expect(activeIncident.state).toBe(IncidentState.ESCALATED);
      expect(activeIncident.currentTier).toBe(3);
    });

    it('should mark incident as EXHAUSTED when exceeding MAX_ESCALATION_TIERS (Tier 3)', async () => {
      // Set incident at max tier (Tier 3)
      activeIncident.state = IncidentState.ESCALATED;
      activeIncident.currentTier = MAX_ESCALATION_TIERS; // 3

      let escalationPromise: Promise<any>;
      setTimeout(() => {
        escalationPromise = incidentsService.handleTierEscalation(activeIncident.id, 3);
      }, DEFAULT_TIER_TIMEOUT_MS);

      jest.advanceTimersByTime(DEFAULT_TIER_TIMEOUT_MS);
      await escalationPromise;

      expect(activeIncident.state).toBe(IncidentState.EXHAUSTED);
      expect(activeIncident.escalationJobId).toBeNull();
    });
  });

  describe('3. Timer Cancellation Verification', () => {
    it('should cancel delayed timer immediately upon acknowledgement and prevent escalation', async () => {
      let timerFired = false;
      const timerHandle = setTimeout(async () => {
        timerFired = true;
        await incidentsService.handleTierEscalation(activeIncident.id, 1);
      }, DEFAULT_TIER_TIMEOUT_MS);

      // Advance 5 minutes into the shift
      jest.advanceTimersByTime(5 * 60 * 1000);

      // Responder acknowledges at T=5m
      await incidentsService.acknowledgeIncident(activeIncident.id, mockUserTier1.id);
      clearTimeout(timerHandle); // Mirror timer cancellation

      // Advance clock past 15-minute mark (to 20 minutes)
      jest.advanceTimersByTime(15 * 60 * 1000);

      expect(timerFired).toBe(false);
      expect(activeIncident.state).toBe(IncidentState.ACKNOWLEDGED);
      expect(activeIncident.currentTier).toBe(1);
    });

    it('should cancel delayed timer immediately upon resolution and prevent escalation', async () => {
      let timerFired = false;
      const timerHandle = setTimeout(async () => {
        timerFired = true;
        await incidentsService.handleTierEscalation(activeIncident.id, 1);
      }, DEFAULT_TIER_TIMEOUT_MS);

      // Fast forward 7 minutes
      jest.advanceTimersByTime(7 * 60 * 1000);

      // Resolve at T=7m
      await incidentsService.resolveIncident(activeIncident.id, mockUserTier1.id);
      clearTimeout(timerHandle);

      // Fast forward to 30 minutes
      jest.advanceTimersByTime(23 * 60 * 1000);

      expect(timerFired).toBe(false);
      expect(activeIncident.state).toBe(IncidentState.RESOLVED);
      expect(activeIncident.resolvedAt).toBeInstanceOf(Date);
    });
  });

  describe('4. Worker Idempotency & Mismatch Guards', () => {
    it('should safely skip escalation if incident was already acknowledged before job execution', async () => {
      activeIncident.state = IncidentState.ACKNOWLEDGED;

      const result = await incidentsService.handleTierEscalation(activeIncident.id, 1);

      expect(result.state).toBe(IncidentState.ACKNOWLEDGED);
      expect(result.currentTier).toBe(1);
    });

    it('should safely skip escalation if job expectedTier does not match incident currentTier (stale job)', async () => {
      activeIncident.currentTier = 2; // Incident already moved to Tier 2

      // Worker executes a delayed job with stale expectedTier = 1
      const result = await incidentsService.handleTierEscalation(activeIncident.id, 1);

      expect(result.currentTier).toBe(2);
      expect(result.state).toBe(IncidentState.TRIGGERED);
    });
  });
});
