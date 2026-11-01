import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { IncidentsService } from './incidents.service';
import { AcknowledgeIncidentDto } from './dto/acknowledge-incident.dto';
import { ResolveIncidentDto } from './dto/resolve-incident.dto';
import { IncidentState } from '../../entities/incident.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../../entities/user.entity';

@Controller('incidents')
@UseGuards(JwtAuthGuard, RolesGuard)
export class IncidentsController {
  constructor(private readonly incidentsService: IncidentsService) {}

  @Get()
  async getIncidents(
    @Query('serviceId') serviceId?: string,
    @Query('state') state?: IncidentState,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.incidentsService.getIncidents(serviceId, state, limit, offset);
  }

  @Get(':id')
  async getIncidentById(@Param('id') id: string) {
    return this.incidentsService.getIncidentById(id);
  }

  @Post(':id/acknowledge')
  @HttpCode(HttpStatus.OK)
  async acknowledgeIncident(
    @Param('id') id: string,
    @Body() dto: AcknowledgeIncidentDto,
    @CurrentUser() user?: User,
  ) {
    const userId = dto.userId || user?.id;
    return this.incidentsService.acknowledgeIncident(id, userId);
  }

  @Post(':id/ack')
  @HttpCode(HttpStatus.OK)
  async ackIncident(
    @Param('id') id: string,
    @Body() dto: AcknowledgeIncidentDto,
    @CurrentUser() user?: User,
  ) {
    const userId = dto.userId || user?.id;
    return this.incidentsService.acknowledgeIncident(id, userId);
  }

  @Post(':id/resolve')
  @HttpCode(HttpStatus.OK)
  async resolveIncident(
    @Param('id') id: string,
    @Body() dto: ResolveIncidentDto,
    @CurrentUser() user?: User,
  ) {
    const userId = dto.userId || user?.id;
    return this.incidentsService.resolveIncident(id, userId);
  }
}
