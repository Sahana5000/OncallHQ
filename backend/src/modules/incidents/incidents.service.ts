import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Incident, IncidentState } from '../../entities/incident.entity';
import { EscalationService } from './escalation.service';
import { AuditService } from '../audit/audit.service';
import { ScheduleResolverService } from '../schedules/schedule-resolver.service';
import { NotificationsService } from '../notifications/notifications.service';
import { IncidentsGateway } from './incidents.gateway';

export const MAX_ESCALATION_TIERS = 3;

@Injectable()
export class IncidentsService {
  private readonly logger = new Logger(IncidentsService.name);

  constructor(
    @InjectRepository(Incident)
    private readonly incidentRepository: Repository<Incident>,
    private readonly escalationService: EscalationService,
    private readonly auditService: AuditService,
    private readonly scheduleResolverService: ScheduleResolverService,
    private readonly notificationsService: NotificationsService,
    @Optional() private readonly incidentsGateway?: IncidentsGateway,
  ) {}

  /**
   * Finds an existing open incident matching service ID and SHA-256 fingerprint.
   */
  async findOpenIncidentByFingerprint(
    serviceId: string,
    fingerprint: string,
  ): Promise<Incident | null> {
    return this.incidentRepository.findOne({
      where: {
        serviceId,
        fingerprint,
        state: In([
          IncidentState.TRIGGERED,
          IncidentState.ACKNOWLEDGED,
          IncidentState.ESCALATED,
        ]),
      },
      relations: ['assignedUser', 'service'],
    });
  }

  async getIncidentById(id: string): Promise<Incident | null> {
    const incident = await this.incidentRepository.findOne({
      where: { id },
      relations: ['assignedUser', 'service'],
    });

    if (!incident) {
      throw new NotFoundException(`Incident with ID ${id} not found`);
    }
    return incident;
  }

  async getIncidents(serviceId?: string, state?: IncidentState): Promise<Incident[]> {
    const where: any = {};
    if (serviceId) where.serviceId = serviceId;
    if (state) where.state = state;

    return this.incidentRepository.find({
      where,
      relations: ['assignedUser', 'service'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Creates a new incident in TRIGGERED state and schedules Tier 1 escalation timer.
   */
  async createIncident(data: Partial<Incident>): Promise<Incident> {
    const incident = this.incidentRepository.create({
      ...data,
      state: data.state || IncidentState.TRIGGERED,
      currentTier: data.currentTier || 1,
      alertCount: 1,
    });

    let saved = await this.incidentRepository.save(incident);

    // Schedule Tier 1 escalation timer
    const jobId = await this.escalationService.scheduleEscalation(
      saved.id,
      saved.currentTier,
    );
    saved.escalationJobId = jobId;
    saved = await this.incidentRepository.save(saved);

    // Trigger Notification Engine (fire-and-forget to prevent blocking pipeline)
    this.notificationsService
      .dispatchIncidentNotification(saved)
      .catch((err) =>
        this.logger.error(
          `Failed to dispatch notification for new incident ${saved.id}: ${err.message}`,
        ),
      );

    // Emit WebSocket Event
    if (this.incidentsGateway) {
      this.incidentsGateway.emitIncidentCreated(saved);
    }

    this.logger.log(
      `Created incident ${saved.id} for service ${saved.serviceId} [Fingerprint: ${saved.fingerprint}, Timer Job: ${jobId}]`,
    );
    return saved;
  }

  /**
   * Increments alert_count for deduplication.
   */
  async incrementAlertCount(incidentId: string): Promise<Incident> {
    const incident = await this.getIncidentById(incidentId);

    incident.alertCount += 1;
    incident.updatedAt = new Date();

    const updated = await this.incidentRepository.save(incident);

    if (this.incidentsGateway) {
      this.incidentsGateway.emitIncidentUpdated(updated);
    }

    this.logger.log(
      `Deduplicated alert for incident ${incidentId}. New alert_count = ${updated.alertCount}`,
    );
    return updated;
  }

  /**
   * Acknowledges an incident and immediately cancels pending escalation timers.
   */
  async acknowledgeIncident(incidentId: string, userId: string): Promise<Incident> {
    const incident = await this.getIncidentById(incidentId);

    if (
      incident.state === IncidentState.RESOLVED ||
      incident.state === IncidentState.EXHAUSTED
    ) {
      throw new BadRequestException(
        `Cannot acknowledge incident in state '${incident.state}'`,
      );
    }

    if (incident.state === IncidentState.ACKNOWLEDGED) {
      return incident;
    }

    // Cancel active escalation timer
    if (incident.escalationJobId) {
      await this.escalationService.cancelEscalation(incident.escalationJobId);
      incident.escalationJobId = null;
    }

    incident.state = IncidentState.ACKNOWLEDGED;
    incident.assignedUserId = userId || incident.assignedUserId;
    incident.ackedAt = new Date();
    incident.updatedAt = new Date();

    const saved = await this.incidentRepository.save(incident);

    // Audit Log
    if (saved.service) {
      await this.auditService.createLog({
        orgId: saved.service.orgId,
        actorId: userId,
        action: 'INCIDENT_ACKNOWLEDGED',
        entityType: 'INCIDENT',
        entityId: saved.id,
        metadata: {
          previousState: incident.state,
          currentTier: saved.currentTier,
          ackedAt: saved.ackedAt,
        },
      });
    }

    if (this.incidentsGateway) {
      this.incidentsGateway.emitIncidentUpdated(saved);
    }

    this.logger.log(`Incident ${saved.id} ACKNOWLEDGED by user ${userId}`);
    return saved;
  }

  /**
   * Resolves an incident and immediately cancels pending escalation timers.
   */
  async resolveIncident(incidentId: string, userId?: string): Promise<Incident> {
    const incident = await this.getIncidentById(incidentId);

    if (incident.state === IncidentState.RESOLVED) {
      return incident;
    }

    // Cancel active escalation timer
    if (incident.escalationJobId) {
      await this.escalationService.cancelEscalation(incident.escalationJobId);
      incident.escalationJobId = null;
    }

    const previousState = incident.state;
    incident.state = IncidentState.RESOLVED;
    if (userId) {
      incident.assignedUserId = userId;
    }
    incident.resolvedAt = new Date();
    incident.updatedAt = new Date();

    const saved = await this.incidentRepository.save(incident);

    // Audit Log
    if (saved.service) {
      await this.auditService.createLog({
        orgId: saved.service.orgId,
        actorId: userId || 'SYSTEM',
        action: 'INCIDENT_RESOLVED',
        entityType: 'INCIDENT',
        entityId: saved.id,
        metadata: {
          previousState,
          resolvedAt: saved.resolvedAt,
        },
      });
    }

    if (this.incidentsGateway) {
      this.incidentsGateway.emitIncidentUpdated(saved);
    }

    this.logger.log(`Incident ${saved.id} RESOLVED by user ${userId || 'SYSTEM'}`);
    return saved;
  }

  /**
   * Processes delayed tier escalation executed by BullMQ worker.
   */
  async handleTierEscalation(
    incidentId: string,
    expectedTier: number,
  ): Promise<Incident> {
    const incident = await this.incidentRepository.findOne({
      where: { id: incidentId },
      relations: ['assignedUser', 'service'],
    });

    if (!incident) {
      this.logger.warn(`Escalation job triggered for non-existent incident ${incidentId}`);
      return null;
    }

    if (
      incident.state === IncidentState.ACKNOWLEDGED ||
      incident.state === IncidentState.RESOLVED ||
      incident.state === IncidentState.EXHAUSTED
    ) {
      this.logger.log(
        `Escalation skipped for incident ${incidentId}: state is already ${incident.state}`,
      );
      return incident;
    }

    if (incident.currentTier !== expectedTier) {
      this.logger.log(
        `Escalation skipped for incident ${incidentId}: expected tier ${expectedTier}, but current tier is ${incident.currentTier}`,
      );
      return incident;
    }

    if (incident.currentTier >= MAX_ESCALATION_TIERS) {
      incident.state = IncidentState.EXHAUSTED;
      incident.escalationJobId = null;
      incident.updatedAt = new Date();

      const saved = await this.incidentRepository.save(incident);

      if (saved.service) {
        await this.auditService.createLog({
          orgId: saved.service.orgId,
          actorId: 'SYSTEM_ESCALATION_WORKER',
          action: 'INCIDENT_EXHAUSTED',
          entityType: 'INCIDENT',
          entityId: saved.id,
          metadata: {
            finalTier: saved.currentTier,
            reason: 'Max escalation tiers reached without responder acknowledgement',
          },
        });
      }

      if (this.incidentsGateway) {
        this.incidentsGateway.emitIncidentUpdated(saved);
      }

      this.logger.warn(
        `Incident ${saved.id} EXHAUSTED: max tier ${MAX_ESCALATION_TIERS} reached without acknowledgement`,
      );
      return saved;
    }

    const nextTier = incident.currentTier + 1;
    incident.state = IncidentState.ESCALATED;
    incident.currentTier = nextTier;

    const resolution = await this.scheduleResolverService.resolveOnCallUser(
      incident.serviceId,
    );
    if (resolution.activeUser) {
      incident.assignedUserId = resolution.activeUser.id;
    }

    const newJobId = await this.escalationService.scheduleEscalation(
      incident.id,
      nextTier,
    );
    incident.escalationJobId = newJobId;
    incident.updatedAt = new Date();

    const saved = await this.incidentRepository.save(incident);

    this.notificationsService
      .dispatchIncidentNotification(saved)
      .catch((err) =>
        this.logger.error(
          `Failed to dispatch escalation notification for incident ${saved.id}: ${err.message}`,
        ),
      );

    if (saved.service) {
      await this.auditService.createLog({
        orgId: saved.service.orgId,
        actorId: 'SYSTEM_ESCALATION_WORKER',
        action: 'INCIDENT_ESCALATED',
        entityType: 'INCIDENT',
        entityId: saved.id,
        metadata: {
          previousTier: expectedTier,
          newTier: nextTier,
          assignedUserId: saved.assignedUserId,
          jobId: newJobId,
        },
      });
    }

    if (this.incidentsGateway) {
      this.incidentsGateway.emitIncidentUpdated(saved);
    }

    this.logger.log(
      `Incident ${saved.id} ESCALATED to Tier ${nextTier} [New Job: ${newJobId}]`,
    );
    return saved;
  }
}
