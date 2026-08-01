import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { StoreService } from '../common/store.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private store: StoreService,
    private jwtService: JwtService,
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
        secret: process.env.JWT_REFRESH_SECRET || 'refresh-secret-key-change-in-production',
      });

      const user = await this.store.findUserById(payload.sub);
      if (!user) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      return this.generateTokens(user);
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  generateTokens(user: { id: string; email: string; role: string; companyId?: string | null }) {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
    };

    const accessToken = this.jwtService.sign(payload, { expiresIn: '15m' });
    const refreshToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_REFRESH_SECRET || 'refresh-secret-key-change-in-production',
      expiresIn: '7d',
    });

    return { token: accessToken, accessToken, refreshToken };
  }
}
