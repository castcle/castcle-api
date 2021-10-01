import { HttpModule } from '@nestjs/axios';
import { Test, TestingModule } from '@nestjs/testing';
import { FacebookClient } from './facebook.client';

describe('FacebookClient', () => {
  let service: FacebookClient;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FacebookClient],
      imports: [HttpModule]
    }).compile();

    service = module.get<FacebookClient>(FacebookClient);
  });

  it('FacebookClient - should be defined', () => {
    expect(service).toBeDefined();
  });
});
