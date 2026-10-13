import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { INCIDENT_ESCALATION_QUEUE } from './escalation.service';
import { IncidentsService } from './incidents.service';

export interface EscalationJobData {
  incidentId: string;
  expectedTier: number;
}

@Processor(INCIDENT_ESCALATION_QUEUE)
export class EscalationProcessor extends WorkerHost {
  private readonly logger = new Logger(EscalationProcessor.name);

  constructor(private readonly incidentsService: IncidentsService) {
    super();
  }

  async process(job: Job<EscalationJobData>): Promise<any> {
    const { incidentId, expectedTier } = job.data;
    this.logger.log(
      `Processing escalation job '${job.id}' for incident ${incidentId} (Expected Tier: ${expectedTier})`,
    );

    try {
      const result = await this.incidentsService.handleTierEscalation(
        incidentId,
        expectedTier,
      );
      return {
        success: true,
        incidentId: result.id,
        newState: result.state,
        currentTier: result.currentTier,
      };
    } catch (err) {
      this.logger.error(
        `Error processing escalation job for incident ${incidentId}: ${err.message}`,
        err.stack,
      );
      throw err;
    }
  }
}
