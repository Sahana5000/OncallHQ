import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { User, UserRole } from '../../entities/user.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    name: string;
    role: UserRole;
    phoneNumber?: string;
  };
  accessToken: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponse> {
    const normalizedEmail = dto.email.toLowerCase().trim();
    const existing = await this.userRepository.findOne({
      where: { email: normalizedEmail },
    });
    if (existing) {
      throw new ConflictException(
        `User with email '${dto.email}' already exists`,
      );
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(dto.password, salt);

    const user = this.userRepository.create({
      email: normalizedEmail,
      name: dto.name.trim(),
      passwordHash,
      role: dto.role || UserRole.RESPONDER,
      phoneNumber: dto.phoneNumber?.trim() || null,
    });

    const saved = await this.userRepository.save(user);
    this.logger.log(`New user registered: ${saved.email} (${saved.role})`);

    const accessToken = this.generateToken(saved);
    return {
      user: {
        id: saved.id,
        email: saved.email,
        name: saved.name,
        role: saved.role,
        phoneNumber: saved.phoneNumber || undefined,
      },
      accessToken,
    };
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const normalizedEmail = dto.email.toLowerCase().trim();
    const user = await this.userRepository.findOne({
      where: { email: normalizedEmail },
    });
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isMatch = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const accessToken = this.generateToken(user);
    this.logger.log(`User logged in: ${user.email}`);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        phoneNumber: user.phoneNumber || undefined,
      },
      accessToken,
    };
  }

  async getMe(userId: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return user;
  }

  private generateToken(user: User): string {
    const payload = { sub: user.id, email: user.email, role: user.role };
    return this.jwtService.sign(payload);
  }
}
