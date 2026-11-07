import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PasswordService } from '../common/security/password.service';
import { Role } from '../common/enums/role.enum';
import { RegisterStudentDto } from '../users/dto/register-student.dto';
import { UserProfile, UsersService } from '../users/users.service';

export interface LoginResult {
  accessToken: string;
  user: UserProfile;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly passwordService: PasswordService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterStudentDto): Promise<UserProfile> {
    return this.usersService.registerStudent(dto);
  }

  async login(email: string, password: string): Promise<LoginResult> {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const valid = await this.passwordService.verify(
      user.passwordHash,
      password,
    );
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const accessToken = await this.jwtService.signAsync({
      sub: user._id.toString(),
      role: user.role as Role,
    });
    return { accessToken, user: this.usersService.toProfile(user) };
  }
}
