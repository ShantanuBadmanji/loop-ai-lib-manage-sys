import { Body, Controller, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role, UserStatus } from '../common/enums/role.enum';
import {
  AuthenticatedUser,
  RequestWithUser,
} from '../common/types/authenticated-user';
import { CreateLibrarianDto } from './dto/create-librarian.dto';
import { LookupStudentDto } from './dto/lookup-student.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@Roles(Role.LIBRARIAN)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('librarians')
  @ApiOperation({ summary: 'Create a librarian account (librarian only)' })
  createLibrarian(
    @Body() dto: CreateLibrarianDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() req: RequestWithUser,
  ) {
    return this.usersService.createLibrarian(
      dto,
      actor,
      req.correlationId ?? '',
    );
  }

  @Get('students/lookup')
  @ApiOperation({
    summary: 'Look up a student by email or enrollment number (librarian only)',
    description:
      'Returns the student profile needed to issue a book or action a suspension. ' +
      'Supply at least one of: email or enrollmentNumber (from the student ID card).',
  })
  lookupStudent(@Query() query: LookupStudentDto) {
    return this.usersService.lookupStudent(query.email, query.enrollmentNumber);
  }

  @Patch('students/:id/suspend')
  @ApiOperation({ summary: 'Suspend or reactivate a student (librarian only)' })
  setStatus(
    @Param('id') id: string,
    @Body() dto: UpdateUserStatusDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() req: RequestWithUser,
  ) {
    return this.usersService.setStatus(
      id,
      dto.suspended ? UserStatus.SUSPENDED : UserStatus.ACTIVE,
      actor,
      req.correlationId ?? '',
      dto.reason,
    );
  }
}
