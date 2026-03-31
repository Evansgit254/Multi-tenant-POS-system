export interface UserPayload {
  id: string;
  tenantId: string | null;
  role: string;
}

declare global {
  namespace Express {
    interface Request {
      user: UserPayload;
    }
  }
}
