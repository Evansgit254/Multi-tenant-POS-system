export interface UserPayload {
  id: string;
  tenantId: string | null;
  role: string;
  jti?: string;
}

declare global {
  namespace Express {
    interface Request {
      user: UserPayload;
    }
  }
}
