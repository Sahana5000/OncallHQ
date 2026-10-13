import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Incident } from './incident.entity';
import { User } from './user.entity';

export enum NotificationChannel {
  EMAIL = 'EMAIL',
  WEBHOOK = 'WEBHOOK',
  SMS_MOCK = 'SMS_MOCK',
}

export enum NotificationStatus {
  QUEUED = 'QUEUED',
  SENT = 'SENT',
  FAILED = 'FAILED',
}

@Entity({ name: 'notifications' })
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'incident_id', type: 'uuid' })
  incidentId: string;

  @ManyToOne(() => Incident, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'incident_id' })
  incident: Incident;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'varchar', length: 50 })
  channel: NotificationChannel;

  @Column({
    type: 'varchar',
    length: 50,
    default: NotificationStatus.SENT,
  })
  status: NotificationStatus;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string;

  @CreateDateColumn({ name: 'sent_at', type: 'timestamptz' })
  sentAt: Date;
}
