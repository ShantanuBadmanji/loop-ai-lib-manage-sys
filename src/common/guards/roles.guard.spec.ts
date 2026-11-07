import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '../enums/role.enum';
import { RolesGuard } from './roles.guard';

function contextFor(user: unknown): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => undefined,
    getClass: () => undefined,
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  it('allows when no roles are required', () => {
    const reflector = { getAllAndOverride: () => undefined } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(contextFor(undefined))).toBe(true);
  });

  it('allows a user whose role matches', () => {
    const reflector = {
      getAllAndOverride: () => [Role.LIBRARIAN],
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(contextFor({ role: Role.LIBRARIAN }))).toBe(true);
  });

  it('forbids a user whose role does not match', () => {
    const reflector = {
      getAllAndOverride: () => [Role.LIBRARIAN],
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(() => guard.canActivate(contextFor({ role: Role.STUDENT }))).toThrow(
      ForbiddenException,
    );
  });
});
