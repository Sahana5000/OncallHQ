import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  NotFoundException,
  UseGuards,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Schedule } from '../../entities/schedule.entity';
import { Override } from '../../entities/override.entity';
import { User, UserRole } from '../../entities/user.entity';
import { ScheduleResolverService } from './schedule-resolver.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

class CreateOverrideDto {
  userId: string;
  timeRange: string;
  reason?: string;
}

@Controller('schedules')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SchedulesController {
  constructor(
    @InjectRepository(Schedule)
    private readonly scheduleRepository: Repository<Schedule>,
    @InjectRepository(Override)
    private readonly overrideRepository: Repository<Override>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly scheduleResolverService: ScheduleResolverService,
  ) {}

  @Get()
  async getAllSchedules() {
    return this.scheduleRepository.find({
      relations: [
        'service',
        'layers',
        'layers.user',
        'overrides',
        'overrides.user',
      ],
    });
  }

  @Get(':serviceId')
  async getScheduleForService(@Param('serviceId') serviceId: string) {
    const schedule = await this.scheduleRepository.findOne({
      where: { serviceId },
      relations: [
        'service',
        'layers',
        'layers.user',
        'overrides',
        'overrides.user',
      ],
    });
    if (!schedule) {
      throw new NotFoundException(
        `Schedule for service ${serviceId} not found`,
      );
    }
    return schedule;
  }

  @Get(':serviceId/on-call')
  async getOnCallUser(
    @Param('serviceId') serviceId: string,
    @Query('timestamp') timestamp?: string,
  ) {
    return this.scheduleResolverService.resolveOnCallUser(
      serviceId,
      timestamp,
    );
  }

  @Get(':serviceId/current')
  async getCurrentOnCallUser(
    @Param('serviceId') serviceId: string,
    @Query('timestamp') timestamp?: string,
  ) {
    return this.scheduleResolverService.resolveOnCallUser(
      serviceId,
      timestamp,
    );
  }

  @Post(':scheduleId/overrides')
  @Roles(UserRole.ADMIN, UserRole.LEAD)
  async createOverride(
    @Param('scheduleId') scheduleId: string,
    @Body() dto: CreateOverrideDto,
  ) {
    const schedule = await this.scheduleRepository.findOne({
      where: { id: scheduleId },
    });
    if (!schedule) {
      throw new NotFoundException(`Schedule ${scheduleId} not found`);
    }

    const override = this.overrideRepository.create({
      scheduleId,
      userId: dto.userId,
      timeRange: dto.timeRange,
      reason: dto.reason,
    });

    const saved = await this.overrideRepository.save(override);
    return this.overrideRepository.findOne({
      where: { id: saved.id },
      relations: ['user'],
    });
  }
}
