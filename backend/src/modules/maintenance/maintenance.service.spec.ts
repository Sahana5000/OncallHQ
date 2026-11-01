import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { MaintenanceService } from './maintenance.service';
import { MaintenanceWindow } from '../../entities/maintenance-window.entity';
import { Service } from '../../entities/service.entity';

describe('MaintenanceService Suite', () => {
  let service: MaintenanceService;
  let mockMaintenanceRepo: any;
  let mockServiceRepo: any;

  const mockService: Service = {
    id: 'srv-1',
    orgId: 'org-1',
    name: 'Auth Service',
    description: 'Auth microservice',
    ingestionKey: 'auth_key',
    fallbackUserId: 'user-1',
    fallbackUser: null as any,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    mockMaintenanceRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn((dto) => ({ ...dto, id: 'window-uuid-1' })),
      save: jest.fn((w) => Promise.resolve({ ...w, id: w.id || 'window-uuid-1' })),
      remove: jest.fn(),
    };

    mockServiceRepo = {
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MaintenanceService,
        {
          provide: getRepositoryToken(MaintenanceWindow),
          useValue: mockMaintenanceRepo,
        },
        {
          provide: getRepositoryToken(Service),
          useValue: mockServiceRepo,
        },
      ],
    }).compile();

    service = module.get<MaintenanceService>(MaintenanceService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createWindow', () => {
    it('should create a maintenance window for an existing service', async () => {
      mockServiceRepo.findOne.mockResolvedValue(mockService);

      const now = new Date();
      const start = new Date(now.getTime() + 60000).toISOString();
      const end = new Date(now.getTime() + 3600000).toISOString();

      const result = await service.createWindow({
        serviceId: 'srv-1',
        name: 'Database Migration',
        description: 'Upgrading PG 16',
        startTime: start,
        endTime: end,
      });

      expect(mockServiceRepo.findOne).toHaveBeenCalledWith({ where: { id: 'srv-1' } });
      expect(mockMaintenanceRepo.create).toHaveBeenCalled();
      expect(result.name).toBe('Database Migration');
    });

    it('should throw NotFoundException if service does not exist', async () => {
      mockServiceRepo.findOne.mockResolvedValue(null);

      await expect(
        service.createWindow({
          serviceId: 'unknown-service',
          name: 'Maintenance',
          startTime: new Date().toISOString(),
          endTime: new Date(Date.now() + 10000).toISOString(),
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if end time is before start time', async () => {
      mockServiceRepo.findOne.mockResolvedValue(mockService);

      const now = Date.now();
      await expect(
        service.createWindow({
          serviceId: 'srv-1',
          name: 'Invalid Window',
          startTime: new Date(now + 10000).toISOString(),
          endTime: new Date(now).toISOString(),
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('isServiceInMaintenance', () => {
    it('should return inMaintenance: true when timestamp falls within active window', async () => {
      const activeWindow = {
        id: 'win-1',
        serviceId: 'srv-1',
        name: 'Scheduled Patching',
        startTime: new Date(Date.now() - 5000),
        endTime: new Date(Date.now() + 50000),
      };
      mockMaintenanceRepo.findOne.mockResolvedValue(activeWindow);

      const check = await service.isServiceInMaintenance('srv-1');
      expect(check.inMaintenance).toBe(true);
      expect(check.activeWindow?.id).toBe('win-1');
    });

    it('should return inMaintenance: false when no active window exists', async () => {
      mockMaintenanceRepo.findOne.mockResolvedValue(null);

      const check = await service.isServiceInMaintenance('srv-1');
      expect(check.inMaintenance).toBe(false);
      expect(check.activeWindow).toBeNull();
    });
  });
});
