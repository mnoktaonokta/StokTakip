import { UserRole } from '@prisma/client';
import type { LooseAuthProp } from '@clerk/express';

export interface RequestUser {
  id: string;
  role: UserRole;
  name?: string | null;
  email?: string | null;
  // Yetki bayrakları (Prisma User modelinden gelir)
  canManageStock?: boolean;
  canCreateInvoices?: boolean;
  canManageProducts?: boolean;
}

declare global {
  namespace Express {
    // Merge Clerk's auth prop + our custom user payload
    // eslint-disable-next-line @typescript-eslint/no-empty-interface
    interface Request extends LooseAuthProp {
      currentUser?: RequestUser;
    }
  }
}
