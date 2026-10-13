import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification } from '../../entities/notification.entity';
import { User } from '../../entities/user.entity';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { EmailChannelProvider } from './providers/email.provider';
import { SmsMockChannelProvider } from './providers/sms.provider';
import { WebhookChannelProvider } from './providers/webhook.provider';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [TypeOrmModule.forFeature([Notification, User]), AuditModule],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    EmailChannelProvider,
    SmsMockChannelProvider,
    WebhookChannelProvider,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
