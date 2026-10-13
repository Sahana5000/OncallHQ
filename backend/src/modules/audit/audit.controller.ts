import { Controller, Get, Param } from '@nestjs/common';
import { AuditService } from './audit.service';

@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get(':entityType/:entityId')
  async getAuditLogs(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
  ) {
    return this.auditService.getLogsForEntity(entityType, entityId);
  }
}
