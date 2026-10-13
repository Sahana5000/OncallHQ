import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { Incident } from '../../entities/incident.entity';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class IncidentsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(IncidentsGateway.name);

  handleConnection(client: Socket) {
    this.logger.log(`Client connected to incidents WS: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected from incidents WS: ${client.id}`);
  }

  emitIncidentCreated(incident: Incident) {
    if (this.server) {
      this.server.emit('incident:created', incident);
      this.logger.log(`[WS] Broadcasted incident:created for ${incident.id}`);
    }
  }

  emitIncidentUpdated(incident: Incident) {
    if (this.server) {
      this.server.emit('incident:update', incident);
      this.logger.log(`[WS] Broadcasted incident:update for ${incident.id}`);
    }
  }
}
