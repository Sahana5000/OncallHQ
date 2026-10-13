import {
  Controller,
  Post,
  Param,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { IngestionService, IngestionResponse } from './ingestion.service';
import { IngestAlertDto } from './dto/ingest-alert.dto';

@Controller('ingest')
export class IngestionController {
  constructor(private readonly ingestionService: IngestionService) {}

  @Post(':serviceKey')
  @HttpCode(HttpStatus.OK)
  async ingestAlert(
    @Param('serviceKey') serviceKey: string,
    @Body() dto: IngestAlertDto,
  ): Promise<IngestionResponse> {
    return this.ingestionService.processIngestAlert(serviceKey, dto);
  }
}
