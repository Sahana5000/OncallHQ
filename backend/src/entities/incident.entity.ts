import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Service } from './service.entity';
import { User } from './user.entity';

export enum IncidentSeverity {
  CRITICAL = 'CRITICAL',
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
}

export enum IncidentState {
  TRIGGERED = 'TRIGGERED',
  ACKNOWLEDGED = 'ACKNOWLEDGED',
  ESCALATED = 'ESCALATED',
  RESOLVED = 'RESOLVED',
  EXHAUSTED = 'EXHAUSTED',
}

@Entity({ name: 'incidents' })
export class Incident {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'service_id', type: 'uuid' })
  serviceId: string;

  @ManyToOne(() => Service, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'service_id' })
  service: Service;

  @Column({ length: 255 })
  fingerprint: string;

  @Column({ length: 512 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({
    type: 'varchar',
    length: 50,
    default: IncidentSeverity.HIGH,
  })
  severity: IncidentSeverity;

  @Column({
    type: 'varchar',
    length: 50,
    default: IncidentState.TRIGGERED,
  })
  state: IncidentState;

  @Column({ name: 'assigned_user_id', type: 'uuid', nullable: true })
  assignedUserId: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'assigned_user_id' })
  assignedUser: User;

  @Column({ name: 'current_tier', type: 'int', default: 1 })
  currentTier: number;

  @Column({ name: 'alert_count', type: 'int', default: 1 })
  alertCount: number;

  @Column({ name: 'escalation_job_id', length: 255, nullable: true })
  escalationJobId: string;

  @Column({ name: 'acked_at', type: 'timestamptz', nullable: true })
  ackedAt: Date;

  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true })
  resolvedAt: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
