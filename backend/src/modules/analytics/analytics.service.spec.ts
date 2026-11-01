import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AnalyticsService } from './analytics.service';
import { Incident, IncidentState, IncidentSeverity } from '../../entities/incident.entity';
import { Service } from '../../entities/service.entity';

describe('AnalyticsService Suite', () => {
  let service: AnalyticsService;
  let mockIncidentRepo: any;
  let mockServiceRepo: any;

  const baseDate = new Date('2026-10-01T10:00:00.000Z');

  // Incident 1: Acked in 10 mins (600s), Resolved in 30 mins (1800s)
  const inc1: Incident = {
    id: 'inc-1',
    serviceId: 'srv-1',
    fingerprint: 'fp1',
    title: 'High CPU',
    severity: IncidentSeverity.CRITICAL,
    state: IncidentState.RESOLVED,
    createdAt: baseDate,
    ackedAt: new Date(baseDate.getTime() + 10 * 60 * 1000), // 10 min
    resolvedAt: new Date(baseDate.getTime() + 30 * 60 * 1000), // 30 min
    currentTier: 1,
    alertCount: 1,
    updatedAt: new Date(),
  } as Incident;

  // Incident 2: Acked in 20 mins (1200s), Resolved in 60 mins (3600s)
  const inc2: Incident = {
    id: 'inc-2',
    serviceId: 'srv-1',
    fingerprint: 'fp2',
    title: 'High Memory',
    severity: IncidentSeverity.HIGH,
    state: IncidentState.RESOLVED,
    createdAt: baseDate,
    ackedAt: new Date(baseDate.getTime() + 20 * 60 * 1000), // 20 min
    resolvedAt: new Date(baseDate.getTime() + 60 * 60 * 1000), // 60 min
    currentTier: 2,
    alertCount: 1,
    updatedAt: new Date(),
  } as Incident;

  // Incident 3: Acknowledged in 15 mins (900s), but STILL OPEN / UNRESOLVED
  const inc3: Incident = {
    id: 'inc-3',
    serviceId: 'srv-2',
    fingerprint: 'fp3',
    title: 'Disk Latency',
    severity: IncidentSeverity.MEDIUM,
    state: IncidentState.ACKNOWLEDGED,
    createdAt: baseDate,
    ackedAt: new Date(baseDate.getTime() + 15 * 60 * 1000), // 15 min
    resolvedAt: null,
    currentTier: 1,
    alertCount: 1,
    updatedAt: new Date(),
  } as Incident;

  // Incident 4: TRIGGERED, never acknowledged or resolved
  const inc4: Incident = {
    id: 'inc-4',
    serviceId: 'srv-2',
    fingerprint: 'fp4',
    title: 'Network Packet Loss',
    severity: IncidentSeverity.LOW,
    state: IncidentState.TRIGGERED,
    createdAt: baseDate,
    ackedAt: null,
    resolvedAt: null,
    currentTier: 1,
    alertCount: 1,
    updatedAt: new Date(),
  } as Incident;

  beforeEach(async () => {
    mockIncidentRepo = {
      find: jest.fn(),
    };
    mockServiceRepo = {
      find: jest.fn().mockResolvedValue([
        { id: 'srv-1', name: 'Billing Service' },
        { id: 'srv-2', name: 'Auth Service' },
      ]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        {
          provide: getRepositoryToken(Incident),
          useValue: mockIncidentRepo,
        },
        {
          provide: getRepositoryToken(Service),
          useValue: mockServiceRepo,
        },
      ],
    }).compile();

    service = module.get<AnalyticsService>(AnalyticsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('calculateMetrics', () => {
    it('should calculate accurate MTTA and MTTR with known data and handle open incidents correctly', () => {
      const allIncidents = [inc1, inc2, inc3, inc4];
      const result = service.calculateMetrics(allIncidents);

      expect(result.totalIncidents).toBe(4);
      expect(result.activeIncidents).toBe(2); // inc3 (ACKNOWLEDGED) + inc4 (TRIGGERED)
      expect(result.resolvedCount).toBe(2);

      // MTTA Sample: inc1 (10m), inc2 (20m), inc3 (15m) -> Total = 45m / 3 = 15.0m (900s)
      expect(result.mtta.sampleSize).toBe(3);
      expect(result.mtta.seconds).toBe(900);
      expect(result.mtta.minutes).toBe(15);

      // MTTR Sample: inc1 (30m), inc2 (60m) -> Total = 90m / 2 = 45.0m (2700s)
      expect(result.mttr.sampleSize).toBe(2);
      expect(result.mttr.seconds).toBe(2700);
      expect(result.mttr.minutes).toBe(45);

      // Severity counts
      expect(result.severityBreakdown[IncidentSeverity.CRITICAL]).toBe(1);
      expect(result.severityBreakdown[IncidentSeverity.HIGH]).toBe(1);
      expect(result.severityBreakdown[IncidentSeverity.MEDIUM]).toBe(1);
      expect(result.severityBreakdown[IncidentSeverity.LOW]).toBe(1);
    });

    it('should return 0 for MTTA and MTTR when incident list is empty (no division by zero)', () => {
      const result = service.calculateMetrics([]);

      expect(result.totalIncidents).toBe(0);
      expect(result.mtta.sampleSize).toBe(0);
      expect(result.mtta.minutes).toBe(0);
      expect(result.mttr.sampleSize).toBe(0);
      expect(result.mttr.minutes).toBe(0);
    });
  });

  describe('getOverview', () => {
    it('should query repository and return overview structure', async () => {
      mockIncidentRepo.find.mockResolvedValue([inc1, inc2]);

      const result = await service.getOverview('srv-1');
      expect(mockIncidentRepo.find).toHaveBeenCalled();
      expect(result.totalIncidents).toBe(2);
      expect(result.resolvedCount).toBe(2);
      expect(result.mtta.minutes).toBe(15);
      expect(result.mttr.minutes).toBe(45);
    });
  });
});
