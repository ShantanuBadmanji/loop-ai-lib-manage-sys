import { Body, Controller, Param, Patch, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role, UserStatus } from '../common/enums/role.enum';
import {
  AuthenticatedUser,
  RequestWithUser,
} from '../common/types/authenticated-user';
import { CreateLibrarianDto } from './dto/create-librarian.dto';
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

  @Patch(':id/suspend')
  @ApiOperation({ summary: 'Suspend or reactivate a user (librarian only)' })
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
