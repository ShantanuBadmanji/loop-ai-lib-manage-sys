import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
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
import { CorrectLoanDto } from './dto/correct-loan.dto';
import { DamageClaimDto } from './dto/damage-claim.dto';
import { IssueLoanDto } from './dto/issue-loan.dto';
import { MarkLostDto } from './dto/mark-lost.dto';
import { QueryLoansDto } from './dto/query-loans.dto';
import { ReturnLoanDto } from './dto/return-loan.dto';
import { VoidLoanDto } from './dto/void-loan.dto';
import { LoansService } from './loans.service';

@ApiTags('loans')
@ApiBearerAuth()
@Controller('loans')
export class LoansController {
  constructor(private readonly loansService: LoansService) {}

  @Post('issue')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      'Issue a copy. Students issue to themselves; librarians issue to any student.',
  })
  issue(
    @Body() dto: IssueLoanDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() req: RequestWithUser,
  ) {
    return this.loansService.issue(dto, actor, req.correlationId ?? '');
  }

  @Get('me')
  @ApiOperation({ summary: 'List my loans (filters: status, overdue)' })
  myLoans(
    @Query() query: QueryLoansDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.loansService.listForBorrower(actor.id, query);
  }

  @Get()
  @Roles(Role.LIBRARIAN)
  @ApiOperation({ summary: 'List all loans (librarian only)' })
  all(@Query() query: QueryLoansDto) {
    return this.loansService.list(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a loan (owner or librarian)' })
  getOne(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.loansService.findOne(id, actor);
  }

  @Post(':id/return')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Return a loan (owner student or librarian)' })
  return(
    @Param('id') id: string,
    @Body() dto: ReturnLoanDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() req: RequestWithUser,
  ) {
    return this.loansService.return(id, dto, actor, req.correlationId ?? '');
  }

  @Post(':id/mark-lost')
  @Roles(Role.LIBRARIAN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark an active loan as lost (librarian only)' })
  markLost(
    @Param('id') id: string,
    @Body() dto: MarkLostDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() req: RequestWithUser,
  ) {
    return this.loansService.markLost(id, dto, actor, req.correlationId ?? '');
  }

  @Post(':id/damage-claim')
  @Roles(Role.LIBRARIAN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'File a damage claim within the post-return window (librarian only)',
  })
  damageClaim(
    @Param('id') id: string,
    @Body() dto: DamageClaimDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() req: RequestWithUser,
  ) {
    return this.loansService.damageClaim(
      id,
      dto,
      actor,
      req.correlationId ?? '',
    );
  }

  @Post(':id/correct')
  @Roles(Role.LIBRARIAN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Correct a loan (librarian only)' })
  correct(
    @Param('id') id: string,
    @Body() dto: CorrectLoanDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() req: RequestWithUser,
  ) {
    return this.loansService.correct(id, dto, actor, req.correlationId ?? '');
  }

  @Post(':id/void')
  @Roles(Role.LIBRARIAN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Void an accidental active loan (librarian only)' })
  voidLoan(
    @Param('id') id: string,
    @Body() dto: VoidLoanDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() req: RequestWithUser,
  ) {
    return this.loansService.voidLoan(id, dto, actor, req.correlationId ?? '');
  }
}
