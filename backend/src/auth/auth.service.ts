import { Injectable, UnauthorizedException, ConflictException, BadRequestException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { StoreService } from '../common/store.service';
import { MailService } from '../common/mail.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JWT_REFRESH_SECRET } from '../common/config';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private store: StoreService,
    private jwtService: JwtService,
    private mailService: MailService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.store.findUserByEmail(dto.email);
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const baseSlug = dto.companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'company';
    let slug = baseSlug;
    let suffix = 2;
    while (await this.store.findCompanyBySlug(slug)) {
      slug = `${baseSlug}-${suffix++}`;
    }

    const company = await this.store.createCompany({
      id: crypto.randomUUID(),
      name: dto.companyName,
      slug,
      plan: 'free',
      settings: {},
    });

    const defaults = [
      { name: 'Sales', description: 'Pricing, quotes and purchasing', keywords: ['price', 'pricing', 'buy', 'purchase', 'quote', 'cost', 'order', 'sales'] },
      { name: 'Support', description: 'Help with product issues', keywords: ['help', 'issue', 'problem', 'error', 'broken', 'not working', 'fix', 'support'] },
      { name: 'Billing', description: 'Invoices, payments and refunds', keywords: ['bill', 'invoice', 'payment', 'refund', 'charge', 'card', 'receipt', 'billing'] },
    ];
    for (const d of defaults) {
      await this.store.createDepartment({
        companyId: company.id,
        name: d.name,
        description: d.description,
        keywords: d.keywords,
        email: null,
      });
    }

    const user = await this.store.createUser({
      id: crypto.randomUUID(),
      email: dto.email,
      password: hashedPassword,
      name: dto.name,
      role: 'COMPANY_ADMIN',
      companyId: company.id,
    });

    const tokens = this.generateTokens(user);

    return {
      user: { id: user.id, email: user.email, name: user.name, role: user.role, companyId: user.companyId },
      company: { id: company.id, name: company.name, slug: company.slug },
      ...tokens,
    };
  }

  async login(dto: LoginDto) {
    const user = await this.store.findUserByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = this.generateTokens(user);

    return {
      user: { id: user.id, email: user.email, name: user.name, role: user.role, companyId: user.companyId },
      ...tokens,
    };
  }

  async refreshToken(token: string) {
    try {
      const payload = this.jwtService.verify(token, {
        secret: JWT_REFRESH_SECRET(),
      });

      const user = await this.store.findUserById(payload.sub);
      if (!user) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      // Reject tokens issued before the latest token_version bump (logout / password change).
      if (payload.ver !== user.tokenVersion) {
        throw new UnauthorizedException('Refresh token has been revoked');
      }

      return this.generateTokens(user);
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  generateTokens(user: { id: string; email: string; role: string; companyId?: string | null; tokenVersion?: number }) {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
      ver: user.tokenVersion ?? 0,
    };

    const accessToken = this.jwtService.sign(payload, { expiresIn: '15m' });
    const refreshToken = this.jwtService.sign(payload, {
      secret: JWT_REFRESH_SECRET(),
      expiresIn: '7d',
    });

    return { token: accessToken, accessToken, refreshToken };
  }

  // Revoke all of a user's refresh tokens (used on explicit logout / password change).
  async logout(userId: string) {
    await this.store.revokeUserTokens(userId);
    return { success: true };
  }

  async forgotPassword(email: string) {
    const user = await this.store.findUserByEmail(email);
    // Always return success to avoid leaking which emails are registered.
    if (!user) {
      return { success: true };
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = this.hashResetToken(rawToken);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await this.store.createPasswordReset(user.id, tokenHash, expiresAt);

    const appUrl = process.env.APP_URL || '';
    const frontendUrl = process.env.FRONTEND_URL || 'https://chat.djaouad.tech';
    const resetUrl = `${frontendUrl}/reset-password?token=${rawToken}`;
    const mail = this.mailService.buildResetEmail(resetUrl, user.name);
    await this.mailService.send({ to: user.email, ...mail });

    this.logger.log(`Password reset requested for ${email}`);
    return { success: true };
  }

  async resetPassword(token: string, newPassword: string) {
    if (!token || typeof newPassword !== 'string' || newPassword.length < 8) {
      throw new BadRequestException('A valid token and password of at least 8 characters are required');
    }

    const user = await this.store.consumePasswordReset(this.hashResetToken(token));
    if (!user) {
      throw new BadRequestException('This reset link is invalid or has expired');
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await this.store.updatePassword(user.id, hashed);
    return { success: true };
  }

  private hashResetToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}
