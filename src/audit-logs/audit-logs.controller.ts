import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { AuditLogsService } from './audit-logs.service';
import { SearchAuditDto } from './dto/search-audit.dto';
import { AuditEntityType } from './enums/audit.enums';

@ApiTags('audit-logs')
@ApiBearerAuth()
@Roles(Role.LIBRARIAN)
@Controller('audit-logs')
export class AuditLogsController {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  @Get()
  @ApiOperation({ summary: 'Search audit records (librarian only)' })
  search(@Query() query: SearchAuditDto) {
    return this.auditLogsService.search({
      ...query,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
    });
  }

  @Get('loan/:id')
  @ApiOperation({ summary: 'Audit trail for a loan (librarian only)' })
  byLoan(@Param('id') id: string) {
    return this.auditLogsService.findByEntity(AuditEntityType.LOAN, id);
  }

  @Get('copy/:id')
  @ApiOperation({ summary: 'Audit trail for a book copy (librarian only)' })
  byCopy(@Param('id') id: string) {
    return this.auditLogsService.findByEntity(AuditEntityType.BOOK_COPY, id);
  }

  @Get('book/:id')
  @ApiOperation({ summary: 'Audit trail for a book (librarian only)' })
  byBook(@Param('id') id: string) {
    return this.auditLogsService.findByEntity(AuditEntityType.BOOK, id);
  }
}
