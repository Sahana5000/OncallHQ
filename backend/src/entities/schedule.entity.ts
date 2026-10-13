import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { Service } from './service.entity';
import { ScheduleLayer } from './schedule-layer.entity';
import { Override } from './override.entity';

@Entity({ name: 'schedules' })
export class Schedule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'service_id', type: 'uuid' })
  serviceId: string;

  @ManyToOne(() => Service, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'service_id' })
  service: Service;

  @Column({ length: 255 })
  name: string;

  @Column({ length: 100, default: 'UTC' })
  timezone: string;

  @OneToMany(() => ScheduleLayer, (layer) => layer.schedule, { cascade: true })
  layers: ScheduleLayer[];

  @OneToMany(() => Override, (override) => override.schedule, { cascade: true })
  overrides: Override[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
