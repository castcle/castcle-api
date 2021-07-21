import { Test, TestingModule } from '@nestjs/testing';
import { HealthyController } from './healthy.controller';

describe('HealthyController', () => {
  let controller: HealthyController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthyController],
    }).compile();

    controller = module.get<HealthyController>(HealthyController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
