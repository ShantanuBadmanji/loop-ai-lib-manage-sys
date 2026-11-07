import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import {
  AuthenticatedUser,
  RequestWithUser,
} from '../common/types/authenticated-user';
import { BooksService } from './books.service';
import { ArchiveBookDto } from './dto/archive-book.dto';
import { CreateBookDto } from './dto/create-book.dto';
import { QueryBooksDto } from './dto/query-books.dto';
import { UpdateBookDto } from './dto/update-book.dto';

@ApiTags('books')
@ApiBearerAuth()
@Controller('books')
export class BooksController {
  constructor(private readonly booksService: BooksService) {}

  @Get()
  @ApiOperation({ summary: 'List and search books' })
  list(@Query() query: QueryBooksDto) {
    return this.booksService.search(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get book details' })
  get(@Param('id') id: string) {
    return this.booksService.findOne(id);
  }

  @Get(':id/availability')
  @ApiOperation({
    summary: 'Get derived availability (counts + earliest expected return)',
  })
  availability(@Param('id') id: string) {
    return this.booksService.availability(id);
  }

  @Post()
  @Roles(Role.LIBRARIAN)
  @ApiOperation({ summary: 'Create a book (librarian only)' })
  create(
    @Body() dto: CreateBookDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() req: RequestWithUser,
  ) {
    return this.booksService.create(dto, actor, req.correlationId ?? '');
  }

  @Patch(':id')
  @Roles(Role.LIBRARIAN)
  @ApiOperation({ summary: 'Update book metadata (librarian only)' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateBookDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() req: RequestWithUser,
  ) {
    return this.booksService.update(id, dto, actor, req.correlationId ?? '');
  }

  @Post(':id/archive')
  @Roles(Role.LIBRARIAN)
  @ApiOperation({ summary: 'Archive a book (librarian only)' })
  archive(
    @Param('id') id: string,
    @Body() dto: ArchiveBookDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() req: RequestWithUser,
  ) {
    return this.booksService.archive(
      id,
      actor,
      req.correlationId ?? '',
      dto.reason,
    );
  }
}
