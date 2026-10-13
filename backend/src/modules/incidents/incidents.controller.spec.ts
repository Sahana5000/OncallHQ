import { Test, TestingModule } from '@nestjs/testing';
import { IncidentsController } from './incidents.controller';
import { IncidentsService } from './incidents.service';
import { IncidentState, IncidentSeverity } from '../../entities/incident.entity';

describe('IncidentsController', () => {
  let controller: IncidentsController;
  let service: IncidentsService;

  const mockIncident = {
    id: 'incident-uuid-abc',
    serviceId: 'service-uuid-1',
    fingerprint: 'sha256_mock_hash',
    title: 'High Latency on Payment Gateway',
    severity: IncidentSeverity.CRITICAL,
    state: IncidentState.TRIGGERED,
    assignedUserId: 'user-uuid-1',
    currentTier: 1,
    alertCount: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [IncidentsController],
      providers: [
        {
          provide: IncidentsService,
          useValue: {
            getIncidents: jest.fn().mockResolvedValue([mockIncident]),
            getIncidentById: jest.fn().mockResolvedValue(mockIncident),
            acknowledgeIncident: jest.fn().mockResolvedValue({
              ...mockIncident,
              state: IncidentState.ACKNOWLEDGED,
              ackedAt: new Date(),
            }),
            resolveIncident: jest.fn().mockResolvedValue({
              ...mockIncident,
              state: IncidentState.RESOLVED,
              resolvedAt: new Date(),
            }),
          },
        },
      ],
    }).compile();

    controller = module.get<IncidentsController>(IncidentsController);
    service = module.get<IncidentsService>(IncidentsService);
  });

  describe('GET /incidents', () => {
    it('should return array of incidents', async () => {
      const result = await controller.getIncidents();
      expect(service.getIncidents).toHaveBeenCalled();
      expect(result).toEqual([mockIncident]);
    });
  });

  describe('GET /incidents/:id', () => {
    it('should return incident details by ID', async () => {
      const result = await controller.getIncidentById('incident-uuid-abc');
      expect(service.getIncidentById).toHaveBeenCalledWith('incident-uuid-abc');
      expect(result).toEqual(mockIncident);
    });
  });

  describe('POST /incidents/:id/acknowledge', () => {
    it('should acknowledge incident and return updated state', async () => {
      const result = await controller.acknowledgeIncident('incident-uuid-abc', {
        userId: 'user-uuid-1',
      });

      expect(service.acknowledgeIncident).toHaveBeenCalledWith(
        'incident-uuid-abc',
        'user-uuid-1',
      );
      expect(result.state).toBe(IncidentState.ACKNOWLEDGED);
    });
  });

  describe('POST /incidents/:id/resolve', () => {
    it('should resolve incident and return updated state', async () => {
      const result = await controller.resolveIncident('incident-uuid-abc', {
        userId: 'user-uuid-1',
      });

      expect(service.resolveIncident).toHaveBeenCalledWith(
        'incident-uuid-abc',
        'user-uuid-1',
      );
      expect(result.state).toBe(IncidentState.RESOLVED);
    });
  });
});
