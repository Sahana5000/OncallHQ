import {
  Injectable,
  Logger,
  UnauthorizedException,
  BadRequestException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { Service } from '../../entities/service.entity';
import { IncidentsService } from '../incidents/incidents.service';
import { ScheduleResolverService } from '../schedules/schedule-resolver.service';
import { AuditService } from '../audit/audit.service';
import { MaintenanceService } from '../maintenance/maintenance.service';
import { IngestAlertDto } from './dto/ingest-alert.dto';
import { IncidentSeverity } from '../../entities/incident.entity';

export interface IngestionResponse {
  status: 'triggered' | 'deduplicated' | 'suppressed';
  action: 'INCIDENT_TRIGGERED' | 'ALERT_DEDUPLICATED' | 'ALERT_SUPPRESSED_MAINTENANCE';
  incidentId: string | null;
  fingerprint: string;
  alertCount: number;
  assignedUserId: string | null;
  resolvedSource?: string;
  reason?: string;
}

@Injectable()
export class IngestionService {
  private readonly logger = new Logger(IngestionService.name);

  constructor(
    @InjectRepository(Service)
    private readonly serviceRepository: Repository<Service>,
    private readonly incidentsService: IncidentsService,
    private readonly scheduleResolverService: ScheduleResolverService,
    private readonly auditService: AuditService,
    @Optional()
    private readonly maintenanceService?: MaintenanceService,
  ) {}

  /**
   * Calculates deterministic SHA-256 fingerprint from serviceId, alertName, and targetResource.
   * Specification: SHA256(service_id + alert_name + target_resource)
   */
  generateFingerprint(
    serviceId: string,
    alertName: string,
    targetResource: string,
  ): string {
    const rawInput = `${serviceId}${alertName}${targetResource}`;
    return crypto.createHash('sha256').update(rawInput).digest('hex');
  }

  /**
   * Process incoming alert webhook.
   */
  async processIngestAlert(
    serviceKey: string,
    dto: IngestAlertDto,
  ): Promise<IngestionResponse> {
    if (!serviceKey) {
      throw new BadRequestException('Ingestion service key is required');
    }

    // 1. Authenticate Service Key
    const service = await this.serviceRepository.findOne({
      where: { ingestionKey: serviceKey },
    });

    if (!service) {
      this.logger.warn(`Ingestion attempted with invalid serviceKey: '${serviceKey}'`);
      throw new UnauthorizedException(`Invalid ingestion service key: '${serviceKey}'`);
    }

    const alertName = dto.getResolvedAlertName();
    const targetResource = dto.getResolvedTargetResource();

    // 2. Generate SHA-256 Fingerprint
    const fingerprint = this.generateFingerprint(
      service.id,
      alertName,
      targetResource,
    );

    // 3. Maintenance Window Noise Suppression Check
    if (this.maintenanceService) {
      const maintenanceCheck = await this.maintenanceService.isServiceInMaintenance(
        service.id,
      );
      if (maintenanceCheck.inMaintenance) {
        this.logger.log(
          `Alert '${alertName}' on '${targetResource}' suppressed: service '${service.id}' is under active maintenance window '${maintenanceCheck.activeWindow?.name}'`,
        );

        await this.auditService.createLog({
          orgId: service.orgId,
          actorId: `service_key:${serviceKey}`,
          action: 'ALERT_SUPPRESSED_MAINTENANCE',
          entityType: 'SERVICE',
          entityId: service.id,
          metadata: {
            alertName,
            targetResource,
            severity: dto.severity,
            fingerprint,
            maintenanceWindowId: maintenanceCheck.activeWindow?.id,
            maintenanceWindowName: maintenanceCheck.activeWindow?.name,
          },
        });

        return {
          status: 'suppressed',
          action: 'ALERT_SUPPRESSED_MAINTENANCE',
          incidentId: null,
          fingerprint,
          alertCount: 0,
          assignedUserId: null,
          resolvedSource: 'MAINTENANCE_WINDOW',
          reason: `Service is currently in maintenance window '${maintenanceCheck.activeWindow?.name}'`,
        };
      }
    }

    // 4. Deduplication Check against Open Incidents
    const existingOpenIncident = await this.incidentsService.findOpenIncidentByFingerprint(
      service.id,
      fingerprint,
    );

    if (existingOpenIncident) {
      // Alert Deduplication logic
      const updatedIncident = await this.incidentsService.incrementAlertCount(
        existingOpenIncident.id,
      );

      // Audit Log Entry
      await this.auditService.createLog({
        orgId: service.orgId,
        actorId: `service_key:${serviceKey}`,
        action: 'ALERT_DEDUPLICATED',
        entityType: 'INCIDENT',
        entityId: updatedIncident.id,
        metadata: {
          fingerprint,
          alertName,
          targetResource,
          alertCount: updatedIncident.alertCount,
        },
      });

      return {
        status: 'deduplicated',
        action: 'ALERT_DEDUPLICATED',
        incidentId: updatedIncident.id,
        fingerprint,
        alertCount: updatedIncident.alertCount,
        assignedUserId: updatedIncident.assignedUserId,
      };
    }

    // 4. Resolve On-Call Responder via Schedule Engine
    const resolution = await this.scheduleResolverService.resolveOnCallUser(
      service.id,
    );

    // 5. Create New Incident
    const newIncident = await this.incidentsService.createIncident({
      serviceId: service.id,
      fingerprint,
      title: dto.title || alertName,
      description:
        dto.description || `Alert '${alertName}' triggered on resource '${targetResource}'`,
      severity: dto.severity || IncidentSeverity.HIGH,
      assignedUserId: resolution.activeUser ? resolution.activeUser.id : null,
      currentTier: 1,
    });

    // Audit Log Entry
    await this.auditService.createLog({
      orgId: service.orgId,
      actorId: `service_key:${serviceKey}`,
      action: 'INCIDENT_TRIGGERED',
      entityType: 'INCIDENT',
      entityId: newIncident.id,
      metadata: {
        fingerprint,
        alertName,
        targetResource,
        assignedUserId: newIncident.assignedUserId,
        resolvedSource: resolution.resolvedSource,
      },
    });

    return {
      status: 'triggered',
      action: 'INCIDENT_TRIGGERED',
      incidentId: newIncident.id,
      fingerprint,
      alertCount: 1,
      assignedUserId: newIncident.assignedUserId,
      resolvedSource: resolution.resolvedSource,
    };
  }
}
