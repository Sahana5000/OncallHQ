import { Test, TestingModule } from '@nestjs/testing';
import { IncidentsGateway } from './incidents.gateway';
import { Incident, IncidentState, IncidentSeverity } from '../../entities/incident.entity';

describe('IncidentsGateway (Phase 9 Real-Time WebSocket Feed)', () => {
  let gateway: IncidentsGateway;
  let mockServer: { emit: jest.Mock };

  const mockIncident: Incident = {
    id: 'incident-ws-1',
    serviceId: 'service-ws-1',
    service: null as any,
    fingerprint: 'fp_ws_123',
    title: 'High Latency',
    description: 'P99 spike',
    severity: IncidentSeverity.CRITICAL,
    state: IncidentState.TRIGGERED,
    assignedUserId: 'user-ws-1',
    assignedUser: null as any,
    currentTier: 1,
    alertCount: 1,
    escalationJobId: null,
    ackedAt: null,
    resolvedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [IncidentsGateway],
    }).compile();

    gateway = module.get<IncidentsGateway>(IncidentsGateway);
    mockServer = {
      emit: jest.fn(),
    };
    gateway.server = mockServer as any;
  });

  it('should broadcast incident:created event when new incident is triggered', () => {
    gateway.emitIncidentCreated(mockIncident);

    expect(mockServer.emit).toHaveBeenCalledWith('incident:created', mockIncident);
  });

  it('should broadcast incident:update event when incident state changes (ack/resolve/escalate)', () => {
    const updatedIncident = {
      ...mockIncident,
      state: IncidentState.ACKNOWLEDGED,
      ackedAt: new Date(),
    };

    gateway.emitIncidentUpdated(updatedIncident);

    expect(mockServer.emit).toHaveBeenCalledWith('incident:update', updatedIncident);
  });

  it('should safely handle disconnect and connection events', () => {
    const mockSocket = { id: 'client-socket-1' } as any;

    expect(() => gateway.handleConnection(mockSocket)).not.toThrow();
    expect(() => gateway.handleDisconnect(mockSocket)).not.toThrow();
  });
});
