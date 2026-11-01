import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { User, UserRole } from '../../entities/user.entity';

describe('AuthService Suite', () => {
  let service: AuthService;
  let mockUserRepository: any;
  let mockJwtService: any;

  const mockUser: User = {
    id: 'user-uuid-1',
    email: 'responder@oncallhq.com',
    name: 'Responder Jane',
    passwordHash: '$2a$10$hashedPasswordHere1234567890',
    role: UserRole.RESPONDER,
    phoneNumber: '+15551234567',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    mockUserRepository = {
      findOne: jest.fn(),
      create: jest.fn((dto) => ({ ...dto, id: 'new-user-uuid' })),
      save: jest.fn((user) => Promise.resolve({ ...user, id: user.id || 'new-user-uuid' })),
    };

    mockJwtService = {
      sign: jest.fn().mockReturnValue('mock-jwt-token-xyz'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    it('should register a new user, hash password, and return access token', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      const result = await service.register({
        email: 'newuser@oncallhq.com',
        name: 'New User',
        password: 'securePassword123',
        role: UserRole.LEAD,
      });

      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { email: 'newuser@oncallhq.com' },
      });
      expect(mockUserRepository.create).toHaveBeenCalled();
      const createdArgs = mockUserRepository.create.mock.calls[0][0];
      expect(createdArgs.email).toBe('newuser@oncallhq.com');
      expect(createdArgs.passwordHash).toBeDefined();
      expect(createdArgs.passwordHash).not.toBe('securePassword123'); // Verified hashed!
      expect(result.accessToken).toBe('mock-jwt-token-xyz');
      expect(result.user.email).toBe('newuser@oncallhq.com');
      expect((result.user as any).passwordHash).toBeUndefined();
    });

    it('should throw ConflictException if email is already taken', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser);

      await expect(
        service.register({
          email: 'responder@oncallhq.com',
          name: 'Jane Doe',
          password: 'password123',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    it('should successfully log in with correct credentials', async () => {
      const plainPassword = 'correctPassword123';
      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash(plainPassword, salt);
      const userWithRealHash = { ...mockUser, passwordHash: hash };

      mockUserRepository.findOne.mockResolvedValue(userWithRealHash);

      const result = await service.login({
        email: 'responder@oncallhq.com',
        password: plainPassword,
      });

      expect(result.accessToken).toBe('mock-jwt-token-xyz');
      expect(result.user.id).toBe(mockUser.id);
      expect((result.user as any).passwordHash).toBeUndefined();
    });

    it('should throw UnauthorizedException if email does not exist', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(
        service.login({
          email: 'nonexistent@oncallhq.com',
          password: 'anyPassword',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if password is wrong', async () => {
      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash('secretPassword', salt);
      mockUserRepository.findOne.mockResolvedValue({ ...mockUser, passwordHash: hash });

      await expect(
        service.login({
          email: 'responder@oncallhq.com',
          password: 'wrongPassword',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('getMe', () => {
    it('should return user profile without password hash', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.getMe(mockUser.id);
      expect(result.id).toBe(mockUser.id);
      expect(result.email).toBe(mockUser.email);
    });
  });
});
