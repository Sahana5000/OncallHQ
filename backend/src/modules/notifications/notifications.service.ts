import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Notification,
  NotificationChannel,
  NotificationStatus,
} from '../../entities/notification.entity';
import { Incident } from '../../entities/incident.entity';
import { User } from '../../entities/user.entity';
import { EmailChannelProvider, DispatchResult } from './providers/email.provider';
import { SmsMockChannelProvider } from './providers/sms.provider';
import { WebhookChannelProvider } from './providers/webhook.provider';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly emailProvider: EmailChannelProvider,
    private readonly smsProvider: SmsMockChannelProvider,
    private readonly webhookProvider: WebhookChannelProvider,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Dispatches alert notifications to the assigned on-call responder across specified channels.
   */
  async dispatchIncidentNotification(
    incident: Incident,
    channels: NotificationChannel[] = [
      NotificationChannel.EMAIL,
      NotificationChannel.SMS_MOCK,
    ],
    webhookUrl?: string,
  ): Promise<Notification[]> {
    if (!incident) return [];

    let responder: User | null = incident.assignedUser || null;

    if (!responder && incident.assignedUserId) {
      responder = await this.userRepository.findOne({
        where: { id: incident.assignedUserId },
      });
    }

    const dispatchedNotifications: Notification[] = [];

    for (const channel of channels) {
      // 1. Save initial QUEUED notification record
      const notification = this.notificationRepository.create({
        incidentId: incident.id,
        userId: responder ? responder.id : incident.assignedUserId || 'unassigned',
        channel,
        status: NotificationStatus.QUEUED,
        sentAt: new Date(),
      });

      const savedQueued = await this.notificationRepository.save(notification);

      // 2. Dispatch via channel provider
      let result: DispatchResult = {
        success: false,
        errorMessage: 'Unknown channel provider',
      };

      if (channel === NotificationChannel.EMAIL) {
        result = await this.emailProvider.sendEmail(responder, incident);
      } else if (channel === NotificationChannel.SMS_MOCK) {
        result = await this.smsProvider.sendSms(responder, incident);
      } else if (channel === NotificationChannel.WEBHOOK) {
        result = await this.webhookProvider.sendWebhook(
          webhookUrl || 'http://localhost/mock-webhook',
          incident,
        );
      }

      // 3. Update status & persist result
      if (result.success) {
        savedQueued.status = NotificationStatus.SENT;
        savedQueued.errorMessage = null;

        if (incident.service) {
          await this.auditService.createLog({
            orgId: incident.service.orgId,
            actorId: 'NOTIFICATION_ENGINE',
            action: 'NOTIFICATION_SENT',
            entityType: 'NOTIFICATION',
            entityId: savedQueued.id,
            metadata: {
              incidentId: incident.id,
              userId: savedQueued.userId,
              channel,
              status: NotificationStatus.SENT,
            },
          });
        }
      } else {
        savedQueued.status = NotificationStatus.FAILED;
        savedQueued.errorMessage = result.errorMessage || 'Dispatch failed';

        if (incident.service) {
          await this.auditService.createLog({
            orgId: incident.service.orgId,
            actorId: 'NOTIFICATION_ENGINE',
            action: 'NOTIFICATION_FAILED',
            entityType: 'NOTIFICATION',
            entityId: savedQueued.id,
            metadata: {
              incidentId: incident.id,
              userId: savedQueued.userId,
              channel,
              status: NotificationStatus.FAILED,
              errorMessage: savedQueued.errorMessage,
            },
          });
        }
      }

      const updated = await this.notificationRepository.save(savedQueued);
      dispatchedNotifications.push(updated);
    }

    return dispatchedNotifications;
  }

  async getNotificationsForIncident(incidentId: string): Promise<Notification[]> {
    return this.notificationRepository.find({
      where: { incidentId },
      relations: ['user', 'incident'],
      order: { sentAt: 'DESC' },
    });
  }

  async getNotificationsForUser(userId: string): Promise<Notification[]> {
    return this.notificationRepository.find({
      where: { userId },
      relations: ['user', 'incident'],
      order: { sentAt: 'DESC' },
    });
  }
}
