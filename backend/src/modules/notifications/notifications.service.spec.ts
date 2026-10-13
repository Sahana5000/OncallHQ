import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationsService } from './notifications.service';
import {
  Notification,
  NotificationChannel,
  NotificationStatus,
} from '../../entities/notification.entity';
import { User, UserRole } from '../../entities/user.entity';
import { Incident, IncidentState, IncidentSeverity } from '../../entities/incident.entity';
import { EmailChannelProvider } from './providers/email.provider';
import { SmsMockChannelProvider } from './providers/sms.provider';
import { WebhookChannelProvider } from './providers/webhook.provider';
import { AuditService } from '../audit/audit.service';
import { Service } from '../../entities/service.entity';

describe('NotificationsService (Phase 5 Notification Engine)', () => {
  let notificationsService: NotificationsService;
  let notificationRepo: Repository<Notification>;
  let userRepo: Repository<User>;
  let auditService: AuditService;

  const mockUser: User = {
    id: 'user-uuid-1',
    email: 'valid.responder@oncallhq.com',
    name: 'Alice Responder',
    role: UserRole.RESPONDER,
    phoneNumber: '+15559999',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockInvalidUser: User = {
    id: 'user-uuid-fail',
    email: 'invalid-fail@oncallhq.com',
    name: 'Broken Responder',
    role: UserRole.RESPONDER,
    phoneNumber: '+15550000',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockOrgService: Service = {
    id: 'service-uuid-1',
    orgId: 'org-uuid-1',
    name: 'Billing Engine',
    description: 'Core Billing',
    ingestionKey: 'billing_key',
    fallbackUserId: mockUser.id,
    fallbackUser: mockUser,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockIncident: Incident = {
    id: 'incident-uuid-10',
    serviceId: mockOrgService.id,
    service: mockOrgService,
    fingerprint: 'sha256_mock_hash',
    title: 'Payment Gateway Connection Timeout',
    description: 'Gateway error code 504',
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
        NotificationsService,
        EmailChannelProvider,
        SmsMockChannelProvider,
        WebhookChannelProvider,
        {
          provide: getRepositoryToken(Notification),
          useValue: {
            create: jest.fn().mockImplementation((dto) => ({ ...dto })),
            save: jest.fn().mockImplementation((entity) =>
              Promise.resolve({
                ...entity,
                id: entity.id || 'notification-uuid-1',
              }),
            ),
            find: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn().mockResolvedValue(mockUser),
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

    notificationsService = module.get<NotificationsService>(NotificationsService);
    notificationRepo = module.get<Repository<Notification>>(
      getRepositoryToken(Notification),
    );
    userRepo = module.get<Repository<User>>(getRepositoryToken(User));
    auditService = module.get<AuditService>(AuditService);
  });

  describe('dispatchIncidentNotification', () => {
    it('1. Should successfully dispatch Email and SMS notifications and set status to SENT', async () => {
      const results = await notificationsService.dispatchIncidentNotification(
        mockIncident,
        [NotificationChannel.EMAIL, NotificationChannel.SMS_MOCK],
      );

      expect(results.length).toBe(2);
      expect(results[0].channel).toBe(NotificationChannel.EMAIL);
      expect(results[0].status).toBe(NotificationStatus.SENT);
      expect(results[0].errorMessage).toBeNull();

      expect(results[1].channel).toBe(NotificationChannel.SMS_MOCK);
      expect(results[1].status).toBe(NotificationStatus.SENT);
      expect(results[1].errorMessage).toBeNull();

      expect(auditService.createLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'NOTIFICATION_SENT',
          entityType: 'NOTIFICATION',
        }),
      );
    });

    it('2. Should handle Email delivery failure gracefully, set status to FAILED, and log NOTIFICATION_FAILED audit event', async () => {
      const incidentWithInvalidUser = {
        ...mockIncident,
        assignedUser: mockInvalidUser,
      };

      const results = await notificationsService.dispatchIncidentNotification(
        incidentWithInvalidUser,
        [NotificationChannel.EMAIL],
      );

      expect(results.length).toBe(1);
      expect(results[0].channel).toBe(NotificationChannel.EMAIL);
      expect(results[0].status).toBe(NotificationStatus.FAILED);
      expect(results[0].errorMessage).toContain('invalid');

      expect(auditService.createLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'NOTIFICATION_FAILED',
          entityType: 'NOTIFICATION',
        }),
      );
    });

    it('3. Should handle Webhook dispatch failure for unreachable endpoint gracefully', async () => {
      const results = await notificationsService.dispatchIncidentNotification(
        mockIncident,
        [NotificationChannel.WEBHOOK],
        'http://mock-fail-unreachable-url/api',
      );

      expect(results.length).toBe(1);
      expect(results[0].channel).toBe(NotificationChannel.WEBHOOK);
      expect(results[0].status).toBe(NotificationStatus.FAILED);
      expect(results[0].errorMessage).toBeDefined();
    });
  });

  describe('getNotificationsForIncident & getNotificationsForUser', () => {
    it('should query notifications repository for incident', async () => {
      await notificationsService.getNotificationsForIncident(mockIncident.id);
      expect(notificationRepo.find).toHaveBeenCalledWith({
        where: { incidentId: mockIncident.id },
        relations: ['user', 'incident'],
        order: { sentAt: 'DESC' },
      });
    });

    it('should query notifications repository for user', async () => {
      await notificationsService.getNotificationsForUser(mockUser.id);
      expect(notificationRepo.find).toHaveBeenCalledWith({
        where: { userId: mockUser.id },
        relations: ['user', 'incident'],
        order: { sentAt: 'DESC' },
      });
    });
  });
});
