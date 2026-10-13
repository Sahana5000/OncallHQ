import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DateTime } from 'luxon';
import { Schedule } from '../../entities/schedule.entity';
import { Service } from '../../entities/service.entity';
import { User } from '../../entities/user.entity';
import { RangeUtils } from '../../common/utils/range.utils';

export type ResolutionSource = 'OVERRIDE' | 'LAYER' | 'FALLBACK' | 'UNASSIGNED';

export interface ResolutionResult {
  serviceId: string;
  timestamp: Date;
  activeUser: User | null;
  resolvedSource: ResolutionSource;
  scheduleId?: string;
  scheduleName?: string;
  overrideId?: string;
  layerId?: string;
  layerPriority?: number;
  reason?: string;
}

@Injectable()
export class ScheduleResolverService {
  private readonly logger = new Logger(ScheduleResolverService.name);

  constructor(
    @InjectRepository(Schedule)
    private readonly scheduleRepository: Repository<Schedule>,
    @InjectRepository(Service)
    private readonly serviceRepository: Repository<Service>,
  ) {}

  /**
   * Resolves the active on-call responder for a given service and timestamp.
   *
   * Resolution Order (per SCHEDULE_SEMANTICS.md):
   * 1. Active User Overrides matching timestamp T.
   * 2. Active Schedule Layers in ascending layer_priority order (1..N).
   * 3. Service Fallback Owner.
   * 4. Unassigned if none found.
   */
  async resolveOnCallUser(
    serviceId: string,
    timestampInput?: Date | string | number,
  ): Promise<ResolutionResult> {
    const timestamp = this.normalizeTimestamp(timestampInput);

    // Load service (with fallback user)
    const service = await this.serviceRepository.findOne({
      where: { id: serviceId },
      relations: ['fallbackUser'],
    });

    if (!service) {
      throw new NotFoundException(`Service with ID ${serviceId} not found`);
    }

    // Load schedule with layers and overrides
    const schedule = await this.scheduleRepository.findOne({
      where: { serviceId },
      relations: ['layers', 'layers.user', 'overrides', 'overrides.user'],
    });

    return this.evaluateResolution(service, schedule, timestamp);
  }

  /**
   * Synchronous / pure evaluation logic (used internally & directly testable).
   */
  evaluateResolution(
    service: Service,
    schedule: Schedule | null,
    timestamp: Date,
  ): ResolutionResult {
    const serviceId = service.id;

    if (!schedule) {
      if (service.fallbackUser) {
        return {
          serviceId,
          timestamp,
          activeUser: service.fallbackUser,
          resolvedSource: 'FALLBACK',
          reason: 'No schedule assigned; fell back to service fallback owner',
        };
      }
      return {
        serviceId,
        timestamp,
        activeUser: null,
        resolvedSource: 'UNASSIGNED',
        reason: 'No schedule found and no service fallback owner defined',
      };
    }

    const scheduleTimezone = schedule.timezone || 'UTC';
    const targetInTz = DateTime.fromJSDate(timestamp).setZone(scheduleTimezone);

    // 1. Evaluate Overrides
    if (schedule.overrides && schedule.overrides.length > 0) {
      for (const override of schedule.overrides) {
        try {
          const range = RangeUtils.parseRange(override.timeRange);
          if (RangeUtils.containsTimestamp(range, timestamp)) {
            return {
              serviceId,
              scheduleId: schedule.id,
              scheduleName: schedule.name,
              timestamp,
              activeUser: override.user,
              resolvedSource: 'OVERRIDE',
              overrideId: override.id,
              reason: override.reason || 'Active schedule override',
            };
          }
        } catch (err) {
          this.logger.warn(
            `Failed to parse override range '${override.timeRange}' for override ${override.id}: ${err.message}`,
          );
        }
      }
    }

    // 2. Evaluate Base Rotation Layers (Priority Order 1..N)
    if (schedule.layers && schedule.layers.length > 0) {
      // Sort ascending by layerPriority (1 is highest priority)
      const sortedLayers = [...schedule.layers].sort(
        (a, b) => a.layerPriority - b.layerPriority,
      );

      for (const layer of sortedLayers) {
        try {
          const range = RangeUtils.parseRange(layer.timeRange);
          if (RangeUtils.containsTimestamp(range, timestamp)) {
            return {
              serviceId,
              scheduleId: schedule.id,
              scheduleName: schedule.name,
              timestamp,
              activeUser: layer.user,
              resolvedSource: 'LAYER',
              layerId: layer.id,
              layerPriority: layer.layerPriority,
              reason: `Matched schedule layer priority ${layer.layerPriority} (${layer.rotationType})`,
            };
          }
        } catch (err) {
          this.logger.warn(
            `Failed to parse layer range '${layer.timeRange}' for layer ${layer.id}: ${err.message}`,
          );
        }
      }
    }

    // 3. Service Fallback Owner
    if (service.fallbackUser) {
      return {
        serviceId,
        scheduleId: schedule.id,
        scheduleName: schedule.name,
        timestamp,
        activeUser: service.fallbackUser,
        resolvedSource: 'FALLBACK',
        reason: 'No active overrides or schedule layers matched; fell back to service owner',
      };
    }

    // 4. Unassigned
    return {
      serviceId,
      scheduleId: schedule.id,
      scheduleName: schedule.name,
      timestamp,
      activeUser: null,
      resolvedSource: 'UNASSIGNED',
      reason: 'No active shift responder or fallback owner found',
    };
  }

  private normalizeTimestamp(input?: Date | string | number): Date {
    if (!input) return new Date();
    if (input instanceof Date) return input;
    if (typeof input === 'number') return new Date(input);
    const parsed = DateTime.fromISO(input, { zone: 'utc' });
    if (parsed.isValid) return parsed.toJSDate();
    return new Date(input);
  }
}
