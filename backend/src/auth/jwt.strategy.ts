import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { StoreService } from '../common/store.service';
import { JWT_SECRET } from '../common/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private store: StoreService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: JWT_SECRET(),
    });
  }

  async validate(payload: { sub: string; email: string; role: string; companyId?: string; ver?: number }) {
    const user = await this.store.findUserById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    if (payload.ver !== user.tokenVersion) {
      throw new UnauthorizedException('Session has been revoked');
    }
    return { id: user.id, email: user.email, name: user.name, role: user.role, companyId: user.companyId, tokenVersion: user.tokenVersion };
  }
}
