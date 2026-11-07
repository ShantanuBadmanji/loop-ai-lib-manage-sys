import { Types } from 'mongoose';
import { LoanStatus } from './enums/loan.enums';
import { LoansService } from './loans.service';

describe('LoansService.toView (derived overdue)', () => {
  const service = new LoansService(
    undefined as never,
    undefined as never,
    undefined as never,
    undefined as never,
    undefined as never,
    undefined as never,
    undefined as never,
  );

  const base = {
    _id: new Types.ObjectId(),
    status: LoanStatus.ACTIVE,
  };

  it('flags an active loan past its due date as overdue', () => {
    const view = service.toView({
      ...base,
      dueAt: new Date(Date.now() - 3 * 86_400_000),
    } as never);
    expect(view.isOverdue).toBe(true);
    expect(view.overdueDays).toBe(3);
  });

  it('does not flag an active loan before its due date', () => {
    const view = service.toView({
      ...base,
      dueAt: new Date(Date.now() + 86_400_000),
    } as never);
    expect(view.isOverdue).toBe(false);
    expect(view.overdueDays).toBe(0);
  });

  it('never flags a returned loan as overdue', () => {
    const view = service.toView({
      ...base,
      status: LoanStatus.RETURNED,
      dueAt: new Date(Date.now() - 10 * 86_400_000),
    } as never);
    expect(view.isOverdue).toBe(false);
  });
});
