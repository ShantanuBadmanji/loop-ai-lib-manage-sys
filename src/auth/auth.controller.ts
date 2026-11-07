import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { authThrottle } from '../common/security/throttle.config';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { RegisterStudentDto } from '../users/dto/register-student.dto';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  @Public()
  @Throttle(authThrottle.register)
  @Post('register')
  @ApiOperation({
    summary: 'Register as a student (role is always STUDENT; never client-set)',
  })
  register(@Body() dto: RegisterStudentDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Throttle(authThrottle.login)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Log in and receive a JWT access token' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get the current authenticated user' })
  async me(@CurrentUser() user: AuthenticatedUser) {
    const doc = await this.usersService.findById(user.id);
    if (!doc) {
      throw new NotFoundException('User not found');
    }
    return this.usersService.toProfile(doc);
  }
}
