import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { Incident } from '../../entities/incident.entity';
import { IncidentsService } from './incidents.service';
import { IncidentsController } from './incidents.controller';
import { IncidentsGateway } from './incidents.gateway';
import { EscalationService, INCIDENT_ESCALATION_QUEUE } from './escalation.service';
import { EscalationProcessor } from './escalation.processor';
import { AuditModule } from '../audit/audit.module';
import { SchedulesModule } from '../schedules/schedules.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Incident]),
    BullModule.registerQueue({
      name: INCIDENT_ESCALATION_QUEUE,
    }),
    AuditModule,
    SchedulesModule,
    NotificationsModule,
  ],
  controllers: [IncidentsController],
  providers: [IncidentsService, EscalationService, EscalationProcessor, IncidentsGateway],
  exports: [IncidentsService, EscalationService, IncidentsGateway],
})
export class IncidentsModule {}
