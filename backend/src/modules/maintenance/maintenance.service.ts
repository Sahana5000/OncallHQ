import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { MaintenanceWindow } from '../../entities/maintenance-window.entity';
import { Service } from '../../entities/service.entity';
import { CreateMaintenanceWindowDto } from './dto/create-maintenance-window.dto';
import { UpdateMaintenanceWindowDto } from './dto/update-maintenance-window.dto';

export interface MaintenanceCheckResult {
  inMaintenance: boolean;
  activeWindow: MaintenanceWindow | null;
}

@Injectable()
export class MaintenanceService {
  private readonly logger = new Logger(MaintenanceService.name);

  constructor(
    @InjectRepository(MaintenanceWindow)
    private readonly maintenanceRepository: Repository<MaintenanceWindow>,
    @InjectRepository(Service)
    private readonly serviceRepository: Repository<Service>,
  ) {}

  async createWindow(
    dto: CreateMaintenanceWindowDto,
    createdByUserId?: string,
  ): Promise<MaintenanceWindow> {
    const service = await this.serviceRepository.findOne({
      where: { id: dto.serviceId },
    });
    if (!service) {
      throw new NotFoundException(`Service ${dto.serviceId} not found`);
    }

    const start = new Date(dto.startTime);
    const end = new Date(dto.endTime);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new BadRequestException('Invalid start or end time format');
    }

    if (end <= start) {
      throw new BadRequestException('End time must be strictly after start time');
    }

    const window = this.maintenanceRepository.create({
      serviceId: dto.serviceId,
      name: dto.name.trim(),
      description: dto.description?.trim(),
      startTime: start,
      endTime: end,
      createdBy: createdByUserId || null,
    });

    const saved = await this.maintenanceRepository.save(window);
    this.logger.log(
      `Created maintenance window '${saved.name}' for service ${saved.serviceId} [${saved.startTime.toISOString()} - ${saved.endTime.toISOString()}]`,
    );
    return saved;
  }

  async updateWindow(
    id: string,
    dto: UpdateMaintenanceWindowDto,
  ): Promise<MaintenanceWindow> {
    const window = await this.getWindowById(id);

    if (dto.startTime) {
      window.startTime = new Date(dto.startTime);
    }
    if (dto.endTime) {
      window.endTime = new Date(dto.endTime);
    }

    if (window.endTime <= window.startTime) {
      throw new BadRequestException('End time must be strictly after start time');
    }

    if (dto.name !== undefined) {
      window.name = dto.name.trim();
    }
    if (dto.description !== undefined) {
      window.description = dto.description.trim();
    }

    return this.maintenanceRepository.save(window);
  }

  async deleteWindow(id: string): Promise<{ deleted: boolean; id: string }> {
    const window = await this.getWindowById(id);
    await this.maintenanceRepository.remove(window);
    this.logger.log(`Deleted maintenance window ${id}`);
    return { deleted: true, id };
  }

  async getWindows(serviceId?: string): Promise<MaintenanceWindow[]> {
    const where: any = {};
    if (serviceId) {
      where.serviceId = serviceId;
    }
    return this.maintenanceRepository.find({
      where,
      relations: ['service', 'creator'],
      order: { startTime: 'DESC' },
    });
  }

  async getWindowById(id: string): Promise<MaintenanceWindow> {
    const window = await this.maintenanceRepository.findOne({
      where: { id },
      relations: ['service', 'creator'],
    });
    if (!window) {
      throw new NotFoundException(`Maintenance window ${id} not found`);
    }
    return window;
  }

  /**
   * Checks whether a service is currently in an active maintenance window at a given timestamp.
   * Handles single and overlapping maintenance windows.
   */
  async isServiceInMaintenance(
    serviceId: string,
    timestampInput?: Date | string | number,
  ): Promise<MaintenanceCheckResult> {
    const timestamp = timestampInput ? new Date(timestampInput) : new Date();

    const activeWindow = await this.maintenanceRepository.findOne({
      where: {
        serviceId,
        startTime: LessThanOrEqual(timestamp),
        endTime: MoreThanOrEqual(timestamp),
      },
      order: { endTime: 'DESC' },
    });

    return {
      inMaintenance: !!activeWindow,
      activeWindow: activeWindow || null,
    };
  }
}
