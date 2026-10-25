import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { apiError } from '../common/errors/api-error';
import { IdsService } from '../database/ids.service';
import { WriteService } from '../database/write.service';
import { HouseholdMembersService } from '../household-members/household-members.service';
import { HouseholdRole } from '../household-members/schemas/household-member.schema';
import { UsersService } from '../users/users.service';
import { User } from '../users/schemas/user.schema';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { LoginResponseDto, SafeUserDto } from './dto/auth-response.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  constructor(
    private readonly users: UsersService,
    private readonly members: HouseholdMembersService,
    private readonly ids: IdsService,
    private readonly writes: WriteService,
    private readonly jwt: JwtService,
  ) {}

  private safe(user: User, householdRole: HouseholdRole): SafeUserDto {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: new Date(user.createdAt).toISOString(),
      householdRole,
    };
  }

  async register(dto: RegisterDto): Promise<SafeUserDto> {
    const duplicate = () =>
      apiError(
        409,
        'EMAIL_ALREADY_EXISTS',
        'An account with this email already exists.',
        { email: ['This email is already registered.'] },
      );
    if (await this.users.findByEmail(dto.email)) throw duplicate();
    const passwordHash = await bcrypt.hash(dto.password, 10);
    let created: User;
    try {
      created = await this.writes.run(async (session) => {
        const id = await this.ids.next('users', session);
        const user = await this.users.create(
          {
            id,
            name: dto.name.trim(),
            email: dto.email.trim().toLowerCase(),
            passwordHash,
            createdAt: new Date(),
          },
          session,
        );
        await this.members.createMember(
          await this.ids.next('household_members', session),
          id,
          session,
        );
        return user;
      });
    } catch (error) {
      if (
        error?.code === 11000 &&
        (error.keyPattern?.email || error.keyValue?.email)
      )
        throw duplicate();
      throw error;
    }
    this.logger.log(`Registered user: id=${created.id}`);
    return this.safe(created, 'member');
  }

  async login(dto: LoginDto): Promise<LoginResponseDto> {
    const user = await this.users.findByEmail(dto.email, true);
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      this.logger.warn('Login rejected: invalid credentials');
      throw apiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
    }
    const safeUser = await this.me(user.id);
    const accessToken = await this.jwt.signAsync({
      sub: user.id,
      email: user.email,
    });
    return { accessToken, user: safeUser };
  }

  async me(id: number): Promise<SafeUserDto> {
    const user = await this.users.findById(id);
    if (!user)
      throw apiError(
        401,
        'UNAUTHENTICATED',
        'Invalid or missing authentication token.',
      );
    const membership = await this.members.findByUser(id);
    if (!membership)
      throw apiError(
        403,
        'FORBIDDEN',
        'You are not a member of this household.',
      );
    return this.safe(user, membership.role);
  }
}
