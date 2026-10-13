import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../../entities/audit-log.entity';

export interface CreateAuditLogDto {
  orgId: string;
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditLog)
    private readonly auditRepository: Repository<AuditLog>,
  ) {}

  async createLog(dto: CreateAuditLogDto): Promise<AuditLog> {
    const log = this.auditRepository.create({
      orgId: dto.orgId,
      actorId: dto.actorId,
      action: dto.action,
      entityType: dto.entityType,
      entityId: dto.entityId,
      metadata: dto.metadata || {},
    });

    const saved = await this.auditRepository.save(log);
    this.logger.log(
      `[AuditLog] ${dto.action} on ${dto.entityType}:${dto.entityId} by ${dto.actorId}`,
    );
    return saved;
  }

  async getLogsForEntity(entityType: string, entityId: string): Promise<AuditLog[]> {
    return this.auditRepository.find({
      where: { entityType, entityId },
      order: { createdAt: 'DESC' },
    });
  }
}
