import { Test, TestingModule } from '@nestjs/testing';
import { IngestionController } from './ingestion.controller';
import { IngestionService } from './ingestion.service';
import { IngestAlertDto } from './dto/ingest-alert.dto';
import { IncidentSeverity } from '../../entities/incident.entity';

describe('IngestionController', () => {
  let controller: IngestionController;
  let service: IngestionService;

  const mockResponse = {
    status: 'triggered' as const,
    action: 'INCIDENT_TRIGGERED' as const,
    incidentId: 'incident-uuid-abc',
    fingerprint: 'mock_fingerprint_hash',
    alertCount: 1,
    assignedUserId: 'user-uuid-123',
    resolvedSource: 'LAYER',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [IngestionController],
      providers: [
        {
          provide: IngestionService,
          useValue: {
            processIngestAlert: jest.fn().mockResolvedValue(mockResponse),
          },
        },
      ],
    }).compile();

    controller = module.get<IngestionController>(IngestionController);
    service = module.get<IngestionService>(IngestionService);
  });

  describe('POST /ingest/:serviceKey', () => {
    it('should delegate alert ingestion to IngestionService and return response', async () => {
      const dto = new IngestAlertDto();
      dto.alertName = 'Database Connection Timeout';
      dto.targetResource = 'rds-primary';
      dto.title = 'Database Connection Timeout';
      dto.severity = IncidentSeverity.HIGH;

      const result = await controller.ingestAlert('valid_key_123', dto);

      expect(service.processIngestAlert).toHaveBeenCalledWith('valid_key_123', dto);
      expect(result).toEqual(mockResponse);
    });
  });
});
