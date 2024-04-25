import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { WcaService } from '../wca/wca.service';
import { AuthModule } from './auth.module';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AuthModule],
      providers: [AuthService, JwtService, WcaService],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('Auth Service should be defined', () => {
    expect(service).toBeDefined();
  });
});
