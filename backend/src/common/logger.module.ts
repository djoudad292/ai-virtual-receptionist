import { Module, Global } from '@nestjs/common'
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino'

@Global()
@Module({
  imports: [
    PinoLoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL || 'info',
        transport: process.env.NODE_ENV !== 'production'
          ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:standard', ignore: 'pid,hostname' } }
          : undefined,
        autoLogging: {
          ignore: (req) => req.url === '/health' || req.url === '/health/live' || req.url === '/health/ready',
        },
        customProps: (req) => ({
          correlationId: req.headers['x-correlation-id'] || req.headers['x-request-id'],
          userId: (req as any).user?.id,
          companyId: (req as any).user?.companyId,
        }),
        customSuccessMessage: (res) => `${res.statusCode} ${res.statusMessage}`,
        customErrorMessage: (err, res) => `${res.statusCode} ${res.statusMessage} - ${err instanceof Error ? err.message : String(err)}`,
        serializers: {
          req: (req) => ({
            method: req.method,
            url: req.url,
            headers: {
              'user-agent': req.headers['user-agent'],
              'content-type': req.headers['content-type'],
            },
            remoteAddress: req.remoteAddress,
          }),
          res: (res) => ({
            statusCode: res.statusCode,
          }),
        },
      },
    }),
  ],
  exports: [PinoLoggerModule],
})
export class LoggerModule {}