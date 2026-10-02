import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Logger as PinoLogger } from 'nestjs-pino';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { existsSync } from 'fs';
import { join } from 'path';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/exception.filter';
import { DatabaseService } from './common/database.service';
import { StoreService } from './common/store.service';
import { AIService } from './ai/ai.service';

let appPromise: Promise<NestExpressApplication> | null = null;

async function buildApp(): Promise<NestExpressApplication> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });
  app.useLogger(app.get(PinoLogger));
  const logger = new Logger('Bootstrap');

  // Serve the embeddable chat widget: GET /widget.js
  // Output layout differs: nested under dist/src when api/ is compiled alongside.
  const publicDir = [join(__dirname, '..', 'public'), join(__dirname, '..', '..', 'public')].find((d) =>
    existsSync(d),
  );
  if (publicDir) {
    app.useStaticAssets(publicDir, { index: false });
    logger.log(`Serving static assets from ${publicDir}`);
  } else {
    logger.warn('public dir not found; /widget.js will 404');
  }

  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type,Authorization',
    credentials: false,
  });

  app.useGlobalFilters(new AllExceptionsFilter());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('AI Customer Support API')
    .setDescription('The AI Customer Support SaaS Platform API description')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const db = app.get(DatabaseService);
  const store = app.get(StoreService);
  const ai = app.get(AIService);

  await db.initialize();
  await seedDemoData(store, ai, logger);

  if (process.env.VERCEL) {
    await app.init();
  }
  return app;
}

async function getHandler(): Promise<NestExpressApplication> {
  if (!appPromise) {
    appPromise = buildApp().catch((err) => {
      appPromise = null;
      throw err;
    });
  }
  return appPromise;
}

async function bootstrap() {
  const app = await getHandler();
  const port = process.env.PORT || 4000;
  await app.listen(port, '0.0.0.0');
  console.log(`Application is running on: http://0.0.0.0:${port}`);
}

async function seedDemoData(store: StoreService, ai: AIService, logger: Logger) {
  // Set up LangGraph checkpointer tables for conversation memory persistence
  try {
    const { PostgresSaver } = await import('@langchain/langgraph-checkpoint-postgres');
    const checkpointer = PostgresSaver.fromConnString(process.env.DATABASE_URL || '');
    await checkpointer.setup();
    logger.log('LangGraph PostgresSaver checkpointer tables created/verified');
  } catch (err) {
    logger.warn(`LangGraph checkpointer setup skipped: ${(err as Error).message}`);
  }

  for (const id of ['preview', 'public']) {
    await store.findCompanyById(id) ||
    (await store.createCompany({
      id,
      name: id === 'preview' ? 'Preview' : 'Public',
      slug: id,
      plan: 'free',
      settings: {},
    }));

    const existing = await store.findDocumentsByCompany(id);
    if (existing.length === 0) {
      const content =
        'We are a demo AI virtual receptionist platform. Business hours: 9am-5pm EST Monday-Friday. Contact: support@demo.com or call 1-800-DEMO. We help businesses answer customer questions automatically, capture leads, book appointments, and route conversations to the right department 24/7.';
      try {
        const doc = await store.createDocument({
          id: crypto.randomUUID(),
          companyId: id,
          title: 'Company Info',
          content,
          chunks: [content],
          filename: null,
          mime: null,
          sizeBytes: 0,
          file: null,
          pageCount: 0,
          status: 'ready',
          published: true,
          error: null,
        });
        // Embed the seed chunk when OpenAI is available; otherwise leave the
        // embedding null so keyword retrieval still serves the demo company.
        let embedding: number[] | null = null;
        try {
          embedding = await ai.generateEmbedding(content);
        } catch (e) {
          logger.warn(`Seed embedding skipped, chunk stays keyword-searchable: ${(e as Error).message}`);
        }
        await store.insertChunk({
          id: crypto.randomUUID(),
          documentId: doc.id,
          companyId: id,
          chunkIndex: 0,
          chunkText: content,
          embedding,
        });
      } catch (e) {
        logger.warn(`Seed chunk skipped: ${(e as Error).message}`);
      }
    }

    const departments = await store.listDepartments(id);
    if (departments.length === 0) {
      await store.createDepartment({
        companyId: id,
        name: 'Sales',
        description: 'Pricing, quotes and purchasing',
        keywords: ['price', 'pricing', 'buy', 'purchase', 'quote', 'cost', 'order', 'sales'],
        email: null,
      });
      await store.createDepartment({
        companyId: id,
        name: 'Support',
        description: 'Help with product issues',
        keywords: ['help', 'issue', 'problem', 'error', 'broken', 'not working', 'fix', 'support'],
        email: null,
      });
      await store.createDepartment({
        companyId: id,
        name: 'Billing',
        description: 'Invoices, payments and refunds',
        keywords: ['bill', 'invoice', 'payment', 'refund', 'charge', 'card', 'receipt', 'billing'],
        email: null,
      });
    }
  }
}

if (!process.env.VERCEL) {
  bootstrap().catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}

export { getHandler };
