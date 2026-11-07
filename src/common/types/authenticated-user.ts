import { Role, UserStatus } from '../enums/role.enum';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  status: UserStatus;
}

export interface RequestWithUser {
  user: AuthenticatedUser;
  correlationId?: string;
}
