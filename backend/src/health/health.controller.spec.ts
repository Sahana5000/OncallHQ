import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  let healthController: HealthController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
    }).compile();

    healthController = app.get<HealthController>(HealthController);
  });

  describe('getHealth', () => {
    it('should return health status ok', () => {
      const result = healthController.getHealth();
      expect(result).toHaveProperty('status', 'ok');
      expect(result).toHaveProperty('service', 'OnCallHQ API Service');
      expect(typeof result.timestamp).toBe('string');
    });
  });
});
