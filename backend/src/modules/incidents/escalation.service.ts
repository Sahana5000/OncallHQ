import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

export const INCIDENT_ESCALATION_QUEUE = 'incident-escalation';
export const DEFAULT_TIER_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes default timeout

@Injectable()
export class EscalationService {
  private readonly logger = new Logger(EscalationService.name);

  constructor(
    @InjectQueue(INCIDENT_ESCALATION_QUEUE)
    private readonly escalationQueue: Queue,
  ) {}

  /**
   * Enqueues a delayed job for tier escalation.
   */
  async scheduleEscalation(
    incidentId: string,
    tier: number,
    delayMs: number = DEFAULT_TIER_TIMEOUT_MS,
  ): Promise<string> {
    const jobId = `escalate-${incidentId}-tier-${tier}`;

    try {
      // Remove any existing job with the same ID first to prevent duplicate timers
      const existingJob = await this.escalationQueue.getJob(jobId);
      if (existingJob) {
        await existingJob.remove();
      }

      await this.escalationQueue.add(
        'escalate-incident',
        { incidentId, expectedTier: tier },
        {
          delay: delayMs,
          jobId,
          removeOnComplete: true,
          removeOnFail: false,
        },
      );

      this.logger.log(
        `Scheduled escalation timer for incident ${incidentId} (Tier ${tier}) in ${delayMs / 1000}s [Job: ${jobId}]`,
      );
      return jobId;
    } catch (err) {
      this.logger.error(
        `Failed to schedule escalation job '${jobId}' for incident ${incidentId}: ${err.message}`,
      );
      return jobId;
    }
  }

  /**
   * Cancels a pending delayed escalation job (e.g. when incident is ACKNOWLEDGED or RESOLVED).
   */
  async cancelEscalation(jobId: string | null): Promise<boolean> {
    if (!jobId) return false;

    try {
      const job = await this.escalationQueue.getJob(jobId);
      if (job) {
        await job.remove();
        this.logger.log(`Cancelled delayed escalation job '${jobId}'`);
        return true;
      }
    } catch (err) {
      this.logger.warn(`Could not cancel escalation job '${jobId}': ${err.message}`);
    }
    return false;
  }
}
