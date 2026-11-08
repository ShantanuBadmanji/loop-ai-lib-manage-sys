import { Body, Controller, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import {
  AuthenticatedUser,
  RequestWithUser,
} from '../common/types/authenticated-user';
import { BookCopiesService } from './book-copies.service';
import { AddCopiesDto } from './dto/add-copies.dto';
import { CopyReasonDto, UpdateCopyDto } from './dto/update-copy.dto';

@ApiTags('book-copies')
@ApiBearerAuth()
@Controller()
export class BookCopiesController {
  constructor(private readonly copiesService: BookCopiesService) {}

  @Get('books/:bookId/copies')
  @ApiOperation({ summary: 'List physical copies of a book' })
  listByBook(@Param('bookId') bookId: string) {
    return this.copiesService.findByBook(bookId);
  }

  @Post('books/:bookId/copies')
  @Roles(Role.LIBRARIAN)
  @ApiOperation({ summary: 'Add one or more physical copies (librarian only)' })
  addCopies(
    @Param('bookId') bookId: string,
    @Body() dto: AddCopiesDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() req: RequestWithUser,
  ) {
    return this.copiesService.addCopies(
      bookId,
      dto,
      actor,
      req.correlationId ?? '',
    );
  }

  @Get('copies/:id')
  @ApiOperation({ summary: 'Get a copy' })
  get(@Param('id') id: string) {
    return this.copiesService.findOne(id);
  }

  @Patch('copies/:id')
  @Roles(Role.LIBRARIAN)
  @ApiOperation({ summary: 'Update copy location/condition (librarian only)' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCopyDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() req: RequestWithUser,
  ) {
    return this.copiesService.update(id, dto, actor, req.correlationId ?? '');
  }

  @Post('copies/:id/repair')
  @Roles(Role.LIBRARIAN)
  @ApiOperation({
    summary: 'Repair a damaged copy: DAMAGED -> AVAILABLE (librarian only)',
  })
  repair(
    @Param('id') id: string,
    @Body() dto: CopyReasonDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() req: RequestWithUser,
  ) {
    return this.copiesService.repair(
      id,
      actor,
      req.correlationId ?? '',
      dto.reason,
    );
  }

  @Post('copies/:id/retire')
  @Roles(Role.LIBRARIAN)
  @ApiOperation({ summary: 'Retire a copy (librarian only)' })
  retire(
    @Param('id') id: string,
    @Body() dto: CopyReasonDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() req: RequestWithUser,
  ) {
    return this.copiesService.retire(
      id,
      actor,
      req.correlationId ?? '',
      dto.reason,
    );
  }
}
