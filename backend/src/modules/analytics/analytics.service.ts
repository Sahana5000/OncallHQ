import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { Incident, IncidentState, IncidentSeverity } from '../../entities/incident.entity';
import { Service } from '../../entities/service.entity';

export interface DurationMetric {
  seconds: number;
  minutes: number;
  hours: number;
  sampleSize: number;
}

export interface AnalyticsOverview {
  totalIncidents: number;
  activeIncidents: number;
  acknowledgedCount: number;
  resolvedCount: number;
  exhaustedCount: number;
  mtta: DurationMetric;
  mttr: DurationMetric;
  severityBreakdown: Record<IncidentSeverity, number>;
  stateBreakdown: Record<IncidentState, number>;
}

export interface ServiceMetric {
  serviceId: string;
  serviceName: string;
  totalIncidents: number;
  activeIncidents: number;
  resolvedIncidents: number;
  mtta: DurationMetric;
  mttr: DurationMetric;
}

export interface DailyTrendPoint {
  date: string;
  triggeredCount: number;
  acknowledgedCount: number;
  resolvedCount: number;
  avgMttaMinutes: number;
  avgMttrMinutes: number;
}

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    @InjectRepository(Incident)
    private readonly incidentRepository: Repository<Incident>,
    @InjectRepository(Service)
    private readonly serviceRepository: Repository<Service>,
  ) {}

  /**
   * Generates comprehensive MTTA, MTTR, and incident state analytics.
   */
  async getOverview(
    serviceId?: string,
    startDateInput?: string,
    endDateInput?: string,
  ): Promise<AnalyticsOverview> {
    const where: any = {};
    if (serviceId) {
      where.serviceId = serviceId;
    }

    if (startDateInput && endDateInput) {
      where.createdAt = Between(new Date(startDateInput), new Date(endDateInput));
    } else if (startDateInput) {
      where.createdAt = MoreThanOrEqual(new Date(startDateInput));
    } else if (endDateInput) {
      where.createdAt = LessThanOrEqual(new Date(endDateInput));
    }

    const incidents = await this.incidentRepository.find({
      where,
      order: { createdAt: 'DESC' },
    });

    return this.calculateMetrics(incidents);
  }

  /**
   * Generates service-by-service MTTA and MTTR performance comparison.
   */
  async getServiceMetrics(
    startDateInput?: string,
    endDateInput?: string,
  ): Promise<ServiceMetric[]> {
    const services = await this.serviceRepository.find();
    const metrics: ServiceMetric[] = [];

    for (const service of services) {
      const overview = await this.getOverview(service.id, startDateInput, endDateInput);
      metrics.push({
        serviceId: service.id,
        serviceName: service.name,
        totalIncidents: overview.totalIncidents,
        activeIncidents: overview.activeIncidents,
        resolvedIncidents: overview.resolvedCount,
        mtta: overview.mtta,
        mttr: overview.mttr,
      });
    }

    return metrics;
  }

  /**
   * Generates daily time-series incident trends for charts.
   */
  async getTrends(serviceId?: string, days: number = 7): Promise<DailyTrendPoint[]> {
    const boundedDays = Math.max(1, Math.min(days || 7, 90));
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - boundedDays);

    const where: any = {
      createdAt: MoreThanOrEqual(sinceDate),
    };
    if (serviceId) {
      where.serviceId = serviceId;
    }

    const incidents = await this.incidentRepository.find({
      where,
      order: { createdAt: 'ASC' },
    });

    // Bucket by YYYY-MM-DD
    const buckets = new Map<string, Incident[]>();
    for (let i = boundedDays - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      buckets.set(key, []);
    }

    for (const incident of incidents) {
      const key = incident.createdAt.toISOString().split('T')[0];
      if (buckets.has(key)) {
        buckets.get(key)!.push(incident);
      }
    }

    const points: DailyTrendPoint[] = [];
    buckets.forEach((dayIncidents, dateStr) => {
      const metrics = this.calculateMetrics(dayIncidents);
      points.push({
        date: dateStr,
        triggeredCount: dayIncidents.length,
        acknowledgedCount: metrics.acknowledgedCount,
        resolvedCount: metrics.resolvedCount,
        avgMttaMinutes: metrics.mtta.minutes,
        avgMttrMinutes: metrics.mttr.minutes,
      });
    });

    return points;
  }

  /**
   * Pure calculation helper for MTTA, MTTR, and breakdowns.
   */
  calculateMetrics(incidents: Incident[]): AnalyticsOverview {
    const severityBreakdown: Record<IncidentSeverity, number> = {
      [IncidentSeverity.CRITICAL]: 0,
      [IncidentSeverity.HIGH]: 0,
      [IncidentSeverity.MEDIUM]: 0,
      [IncidentSeverity.LOW]: 0,
    };

    const stateBreakdown: Record<IncidentState, number> = {
      [IncidentState.TRIGGERED]: 0,
      [IncidentState.ACKNOWLEDGED]: 0,
      [IncidentState.ESCALATED]: 0,
      [IncidentState.RESOLVED]: 0,
      [IncidentState.EXHAUSTED]: 0,
    };

    let totalAckDurationSec = 0;
    let ackSampleCount = 0;

    let totalResolveDurationSec = 0;
    let resolveSampleCount = 0;

    for (const inc of incidents) {
      // Tally severity
      if (inc.severity && severityBreakdown[inc.severity] !== undefined) {
        severityBreakdown[inc.severity]++;
      }

      // Tally state
      if (inc.state && stateBreakdown[inc.state] !== undefined) {
        stateBreakdown[inc.state]++;
      }

      // Calculate MTTA: Time between creation and first acknowledgement
      if (inc.ackedAt && inc.createdAt) {
        const diffMs = new Date(inc.ackedAt).getTime() - new Date(inc.createdAt).getTime();
        if (diffMs >= 0) {
          totalAckDurationSec += diffMs / 1000;
          ackSampleCount++;
        }
      }

      // Calculate MTTR: Time between creation and resolution
      if (inc.resolvedAt && inc.createdAt && inc.state === IncidentState.RESOLVED) {
        const diffMs = new Date(inc.resolvedAt).getTime() - new Date(inc.createdAt).getTime();
        if (diffMs >= 0) {
          totalResolveDurationSec += diffMs / 1000;
          resolveSampleCount++;
        }
      }
    }

    const avgMttaSec = ackSampleCount > 0 ? totalAckDurationSec / ackSampleCount : 0;
    const avgMttrSec = resolveSampleCount > 0 ? totalResolveDurationSec / resolveSampleCount : 0;

    const activeIncidents =
      stateBreakdown[IncidentState.TRIGGERED] +
      stateBreakdown[IncidentState.ACKNOWLEDGED] +
      stateBreakdown[IncidentState.ESCALATED];

    return {
      totalIncidents: incidents.length,
      activeIncidents,
      acknowledgedCount: ackSampleCount,
      resolvedCount: resolveSampleCount,
      exhaustedCount: stateBreakdown[IncidentState.EXHAUSTED],
      mtta: {
        seconds: Math.round(avgMttaSec),
        minutes: Math.round((avgMttaSec / 60) * 10) / 10,
        hours: Math.round((avgMttaSec / 3600) * 100) / 100,
        sampleSize: ackSampleCount,
      },
      mttr: {
        seconds: Math.round(avgMttrSec),
        minutes: Math.round((avgMttrSec / 60) * 10) / 10,
        hours: Math.round((avgMttrSec / 3600) * 100) / 100,
        sampleSize: resolveSampleCount,
      },
      severityBreakdown,
      stateBreakdown,
    };
  }
}
