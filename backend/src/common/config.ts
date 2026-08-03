export function requiredSecret(name: string): string {
  const value = process.env[name];
  if (!value || value === 'change-me' || value === 'change-me-too') {
    throw new Error(
      `Missing required environment variable "${name}". Set it to a strong, unique secret before starting the server.`,
    );
  }
  return value;
}

export const JWT_SECRET = () => requiredSecret('JWT_SECRET');
export const JWT_REFRESH_SECRET = () => requiredSecret('JWT_REFRESH_SECRET');
