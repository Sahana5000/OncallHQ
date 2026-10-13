import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { IncidentsService } from './incidents.service';
import { AcknowledgeIncidentDto } from './dto/acknowledge-incident.dto';
import { ResolveIncidentDto } from './dto/resolve-incident.dto';
import { IncidentState } from '../../entities/incident.entity';

@Controller('incidents')
export class IncidentsController {
  constructor(private readonly incidentsService: IncidentsService) {}

  @Get()
  async getIncidents(
    @Query('serviceId') serviceId?: string,
    @Query('state') state?: IncidentState,
  ) {
    return this.incidentsService.getIncidents(serviceId, state);
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
  ) {
    return this.incidentsService.acknowledgeIncident(id, dto.userId);
  }

  @Post(':id/resolve')
  @HttpCode(HttpStatus.OK)
  async resolveIncident(
    @Param('id') id: string,
    @Body() dto: ResolveIncidentDto,
  ) {
    return this.incidentsService.resolveIncident(id, dto.userId);
  }
}
