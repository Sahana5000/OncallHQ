import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Schedule } from '../../entities/schedule.entity';
import { ScheduleLayer } from '../../entities/schedule-layer.entity';
import { Override } from '../../entities/override.entity';
import { Service } from '../../entities/service.entity';
import { User } from '../../entities/user.entity';
import { ScheduleResolverService } from './schedule-resolver.service';
import { SchedulesController } from './schedules.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Schedule,
      ScheduleLayer,
      Override,
      Service,
      User,
    ]),
  ],
  controllers: [SchedulesController],
  providers: [ScheduleResolverService],
  exports: [ScheduleResolverService],
})
export class SchedulesModule {}
