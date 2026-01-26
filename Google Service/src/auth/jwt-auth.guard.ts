import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    
    // Allow service-to-service calls with X-User-Id header
    const userId = request.headers['x-user-id'];
    if (userId) {
      // Set req.user for downstream handlers
      request.user = { userId, sub: userId, isServiceCall: true };
      return true;
    }
    
    // Otherwise, use JWT authentication
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    if (err || !user) {
      throw err || new UnauthorizedException('Invalid or expired token');
    }
    return user;
  }
}
