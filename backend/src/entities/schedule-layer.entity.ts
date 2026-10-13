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

export enum RotationType {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  CUSTOM = 'CUSTOM',
}

@Entity({ name: 'schedule_layers' })
export class ScheduleLayer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'schedule_id', type: 'uuid' })
  scheduleId: string;

  @ManyToOne(() => Schedule, (schedule) => schedule.layers, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'schedule_id' })
  schedule: Schedule;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'layer_priority', type: 'int', default: 1 })
  layerPriority: number;

  @Column({ name: 'time_range', type: 'tstzrange' })
  timeRange: string;

  @Column({
    name: 'rotation_type',
    type: 'varchar',
    length: 50,
    default: RotationType.WEEKLY,
  })
  rotationType: RotationType;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
