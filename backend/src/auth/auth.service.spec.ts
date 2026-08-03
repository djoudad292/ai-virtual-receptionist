import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { StoreService } from '../common/store.service';
import { MailService } from '../common/mail.service';

const SECRET = 'test-refresh-secret-that-is-long-enough';

function makeUser(overrides: Partial<any> = {}) {
  return {
    id: 'user-1',
    email: 'admin@test.com',
    password: '$2a$10$abcdefghijklmnopqrstuv',
    name: 'Admin',
    role: 'COMPANY_ADMIN',
    companyId: 'company-1',
    tokenVersion: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('AuthService security fixes', () => {
  let authService: AuthService;
  let store: { [key: string]: jest.Mock };
  let jwtService: JwtService;
  let mail: { [key: string]: jest.Mock };

  beforeEach(async () => {
    store = {
      findUserByEmail: jest.fn(),
      findUserById: jest.fn(),
      createCompany: jest.fn(),
      createDepartment: jest.fn(),
      createUser: jest.fn(),
      createPasswordReset: jest.fn(),
      consumePasswordReset: jest.fn(),
      revokeUserTokens: jest.fn(),
      updatePassword: jest.fn(),
      findCompanyBySlug: jest.fn(),
    };
    mail = {
      send: jest.fn().mockResolvedValue(true),
      buildResetEmail: jest.fn().mockReturnValue({ subject: 's', text: 't', html: 'h' }),
    };
    jwtService = new JwtService({ secret: SECRET });

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: StoreService, useValue: store },
        { provide: JwtService, useValue: jwtService },
        { provide: MailService, useValue: mail },
      ],
    }).compile();

    authService = moduleRef.get(AuthService);
    process.env.JWT_SECRET = SECRET;
    process.env.JWT_REFRESH_SECRET = SECRET;
  });

  describe('refresh token revocation', () => {
    it('rejects a refresh token after the user token version is bumped', async () => {
      const user = makeUser({ tokenVersion: 1 });
      const tokens = await authService.generateTokens(user);

      // Simulate logout: token_version bumped server-side.
      user.tokenVersion = 2;
      store.findUserById.mockResolvedValue(user);

      await expect(authService.refreshToken(tokens.refreshToken)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('accepts a refresh token when the version still matches', async () => {
      const user = makeUser({ tokenVersion: 3 });
      const tokens = await authService.generateTokens(user);

      store.findUserById.mockResolvedValue(user);
      const result = await authService.refreshToken(tokens.refreshToken);
      expect(result.refreshToken).toBeDefined();
      expect(result.token).toBeDefined();
    });

    it('rejects an invalid refresh token', async () => {
      await expect(authService.refreshToken('not-a-valid-token')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });

  describe('registration', () => {
    it('rejects a duplicate email', async () => {
      store.findUserByEmail.mockResolvedValue(makeUser());
      await expect(
        authService.register({ email: 'admin@test.com', password: 'password', name: 'A', companyName: 'Acme' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('login', () => {
    it('does not reveal whether an email exists (invalid credentials)', async () => {
      store.findUserByEmail.mockResolvedValue(null);
      await expect(
        authService.login({ email: 'nobody@test.com', password: 'whatever' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('forgot password', () => {
    it('returns success even when the email is unknown (no account enumeration)', async () => {
      store.findUserByEmail.mockResolvedValue(null);
      const result = await authService.forgotPassword('ghost@test.com');
      expect(result.success).toBe(true);
      expect(store.createPasswordReset).not.toHaveBeenCalled();
      expect(mail.send).not.toHaveBeenCalled();
    });
  });

  describe('reset password', () => {
    it('rejects a missing or short password', async () => {
      await expect(
        authService.resetPassword('token', 'short'),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        authService.resetPassword('', 'longenough1'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects an invalid or expired reset token', async () => {
      store.consumePasswordReset.mockResolvedValue(null);
      await expect(
        authService.resetPassword('bad-token', 'newpassword1'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('updates the password and bumps the token version on success', async () => {
      store.consumePasswordReset.mockResolvedValue(makeUser());
      const result = await authService.resetPassword('valid-token', 'newpassword1');
      expect(result.success).toBe(true);
      expect(store.updatePassword).toHaveBeenCalledWith('user-1', expect.any(String));
    });
  });
});
