import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Service } from '../../entities/service.entity';
import { IngestionService } from './ingestion.service';
import { IngestionController } from './ingestion.controller';
import { IncidentsModule } from '../incidents/incidents.module';
import { SchedulesModule } from '../schedules/schedules.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Service]),
    IncidentsModule,
    SchedulesModule,
    AuditModule,
  ],
  controllers: [IngestionController],
  providers: [IngestionService],
  exports: [IngestionService],
})
export class IngestionModule {}
