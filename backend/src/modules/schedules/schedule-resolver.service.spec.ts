import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ScheduleResolverService } from './schedule-resolver.service';
import { Schedule } from '../../entities/schedule.entity';
import { Service } from '../../entities/service.entity';
import { User, UserRole } from '../../entities/user.entity';
import { ScheduleLayer, RotationType } from '../../entities/schedule-layer.entity';
import { Override } from '../../entities/override.entity';

describe('ScheduleResolverService', () => {
  let resolverService: ScheduleResolverService;
  let scheduleRepo: Repository<Schedule>;
  let serviceRepo: Repository<Service>;

  const mockUserA: User = {
    id: 'user-uuid-a',
    email: 'usera@oncallhq.com',
    name: 'User A (Primary Layer 1)',
    role: UserRole.RESPONDER,
    phoneNumber: '+15550001',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockUserB: User = {
    id: 'user-uuid-b',
    email: 'userb@oncallhq.com',
    name: 'User B (Override User)',
    role: UserRole.RESPONDER,
    phoneNumber: '+15550002',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockUserC: User = {
    id: 'user-uuid-c',
    email: 'userc@oncallhq.com',
    name: 'User C (Secondary Layer 2)',
    role: UserRole.RESPONDER,
    phoneNumber: '+15550003',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockFallbackUser: User = {
    id: 'user-uuid-fallback',
    email: 'fallback@oncallhq.com',
    name: 'Service Fallback Owner',
    role: UserRole.LEAD,
    phoneNumber: '+15550009',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockService: Service = {
    id: 'service-uuid-1',
    orgId: 'org-uuid-1',
    name: 'Payments Microservice',
    description: 'Core Payment Gateway',
    ingestionKey: 'key_payments_prod_123',
    fallbackUserId: mockFallbackUser.id,
    fallbackUser: mockFallbackUser,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockSchedule: Schedule = {
    id: 'schedule-uuid-1',
    serviceId: mockService.id,
    service: mockService,
    name: 'Payments On-Call Schedule',
    timezone: 'UTC',
    createdAt: new Date(),
    updatedAt: new Date(),
    layers: [
      {
        id: 'layer-uuid-1',
        scheduleId: 'schedule-uuid-1',
        schedule: null as any,
        userId: mockUserA.id,
        user: mockUserA,
        layerPriority: 1,
        timeRange: '[2026-09-01T00:00:00.000Z,2026-09-08T00:00:00.000Z)',
        rotationType: RotationType.WEEKLY,
        createdAt: new Date(),
      },
      {
        id: 'layer-uuid-2',
        scheduleId: 'schedule-uuid-1',
        schedule: null as any,
        userId: mockUserC.id,
        user: mockUserC,
        layerPriority: 2,
        timeRange: '[2026-09-01T00:00:00.000Z,2026-09-15T00:00:00.000Z)',
        rotationType: RotationType.WEEKLY,
        createdAt: new Date(),
      },
    ],
    overrides: [
      {
        id: 'override-uuid-1',
        scheduleId: 'schedule-uuid-1',
        schedule: null as any,
        userId: mockUserB.id,
        user: mockUserB,
        timeRange: '[2026-09-05T10:00:00.000Z,2026-09-05T18:00:00.000Z)',
        reason: 'User A sick leave coverage',
        createdAt: new Date(),
      },
    ],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScheduleResolverService,
        {
          provide: getRepositoryToken(Schedule),
          useValue: {
            findOne: jest.fn().mockResolvedValue(mockSchedule),
          },
        },
        {
          provide: getRepositoryToken(Service),
          useValue: {
            findOne: jest.fn().mockResolvedValue(mockService),
          },
        },
      ],
    }).compile();

    resolverService = module.get<ScheduleResolverService>(ScheduleResolverService);
    scheduleRepo = module.get<Repository<Schedule>>(getRepositoryToken(Schedule));
    serviceRepo = module.get<Repository<Service>>(getRepositoryToken(Service));
  });

  describe('evaluateResolution (Pure Logic)', () => {
    it('1. Should prioritize User Override over Layer Priority 1 and 2', () => {
      // Sept 5 at 12:00 UTC falls inside Override time range [05T10:00, 05T18:00)
      const targetTime = new Date('2026-09-05T12:00:00.000Z');
      const result = resolverService.evaluateResolution(
        mockService,
        mockSchedule,
        targetTime,
      );

      expect(result.resolvedSource).toBe('OVERRIDE');
      expect(result.activeUser).toEqual(mockUserB);
      expect(result.overrideId).toBe('override-uuid-1');
      expect(result.reason).toBe('User A sick leave coverage');
    });

    it('2. Should resolve Layer Priority 1 when no active override exists', () => {
      // Sept 3 at 12:00 UTC (No override active, both Layer 1 and 2 active)
      const targetTime = new Date('2026-09-03T12:00:00.000Z');
      const result = resolverService.evaluateResolution(
        mockService,
        mockSchedule,
        targetTime,
      );

      expect(result.resolvedSource).toBe('LAYER');
      expect(result.activeUser).toEqual(mockUserA);
      expect(result.layerPriority).toBe(1);
      expect(result.layerId).toBe('layer-uuid-1');
    });

    it('3. Should resolve Layer Priority 2 when Layer 1 is expired but Layer 2 is active', () => {
      // Sept 10 at 12:00 UTC (Layer 1 ended Sept 8, Layer 2 active until Sept 15)
      const targetTime = new Date('2026-09-10T12:00:00.000Z');
      const result = resolverService.evaluateResolution(
        mockService,
        mockSchedule,
        targetTime,
      );

      expect(result.resolvedSource).toBe('LAYER');
      expect(result.activeUser).toEqual(mockUserC);
      expect(result.layerPriority).toBe(2);
      expect(result.layerId).toBe('layer-uuid-2');
    });

    it('4. Should fall back to Service Fallback Owner when no layer/override matches', () => {
      // Sept 20 at 12:00 UTC (All layers ended Sept 15)
      const targetTime = new Date('2026-09-20T12:00:00.000Z');
      const result = resolverService.evaluateResolution(
        mockService,
        mockSchedule,
        targetTime,
      );

      expect(result.resolvedSource).toBe('FALLBACK');
      expect(result.activeUser).toEqual(mockFallbackUser);
    });

    it('5. Should return UNASSIGNED when no layers/overrides match AND service has no fallback user', () => {
      const serviceWithoutFallback: Service = {
        ...mockService,
        fallbackUserId: null,
        fallbackUser: null,
      };

      const targetTime = new Date('2026-09-20T12:00:00.000Z');
      const result = resolverService.evaluateResolution(
        serviceWithoutFallback,
        mockSchedule,
        targetTime,
      );

      expect(result.resolvedSource).toBe('UNASSIGNED');
      expect(result.activeUser).toBeNull();
    });

    it('6. Should fall back to Service Owner if service has no Schedule created', () => {
      const targetTime = new Date('2026-09-03T12:00:00.000Z');
      const result = resolverService.evaluateResolution(
        mockService,
        null,
        targetTime,
      );

      expect(result.resolvedSource).toBe('FALLBACK');
      expect(result.activeUser).toEqual(mockFallbackUser);
    });

    it('7. Should handle schedule with non-UTC timezone correctly', () => {
      const nySchedule: Schedule = {
        ...mockSchedule,
        timezone: 'America/New_York',
      };

      const targetTime = new Date('2026-09-03T12:00:00.000Z');
      const result = resolverService.evaluateResolution(
        mockService,
        nySchedule,
        targetTime,
      );

      expect(result.resolvedSource).toBe('LAYER');
      expect(result.activeUser).toEqual(mockUserA);
    });
  });

  describe('resolveOnCallUser (Repository Integration)', () => {
    it('should query repositories and resolve active user for serviceId', async () => {
      const targetTime = '2026-09-03T12:00:00.000Z';
      const result = await resolverService.resolveOnCallUser(
        mockService.id,
        targetTime,
      );

      expect(serviceRepo.findOne).toHaveBeenCalledWith({
        where: { id: mockService.id },
        relations: ['fallbackUser'],
      });
      expect(scheduleRepo.findOne).toHaveBeenCalledWith({
        where: { serviceId: mockService.id },
        relations: ['layers', 'layers.user', 'overrides', 'overrides.user'],
      });
      expect(result.serviceId).toBe(mockService.id);
      expect(result.activeUser.id).toBe(mockUserA.id);
      expect(result.resolvedSource).toBe('LAYER');
    });
  });
});
