import { RequestUser } from '../../auth/request-user.interface';

declare global {
  namespace Express {
    interface Request {
      user?: RequestUser;
    }
  }
}
