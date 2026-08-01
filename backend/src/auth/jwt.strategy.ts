import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { StoreService } from '../common/store.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private store: StoreService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: process.env.JWT_SECRET || 'super-secret-key-change-in-production',
    });
  }

  async validate(payload: { sub: string; email: string; role: string; companyId?: string }) {
    const user = await this.store.findUserById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return { id: user.id, email: user.email, name: user.name, role: user.role, companyId: user.companyId };
  }
}
