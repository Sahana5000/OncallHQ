import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Schedule } from './schedule.entity';
import { User } from './user.entity';

@Entity({ name: 'overrides' })
export class Override {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'schedule_id', type: 'uuid' })
  scheduleId: string;

  @ManyToOne(() => Schedule, (schedule) => schedule.overrides, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'schedule_id' })
  schedule: Schedule;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'time_range', type: 'tstzrange' })
  timeRange: string;

  @Column({ type: 'text', nullable: true })
  reason: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
