import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/exception.filter';
import { DatabaseService } from './common/database.service';
import { StoreService } from './common/store.service';
import { AIService } from './ai/ai.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

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

  const db = app.get(DatabaseService);
  const store = app.get(StoreService);
  const ai = app.get(AIService);

  await db.initialize();
  await seedDemoData(store, ai, logger);

  const port = process.env.PORT || 4000;
  await app.listen(port, '0.0.0.0');
  logger.log(`Application is running on: http://0.0.0.0:${port}`);
}

async function seedDemoData(store: StoreService, ai: AIService, logger: Logger) {
  for (const id of ['preview', 'public']) {
    const company =
      (await store.findCompanyById(id)) ||
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
        });
        const embedding = await ai.generateEmbedding(content);
        await store.insertChunk({
          id: crypto.randomUUID(),
          documentId: doc.id,
          companyId: id,
          chunkIndex: 0,
          chunkText: content,
          embedding,
        });
      } catch (e) {
        logger.warn(`Seed embedding skipped: ${(e as Error).message}`);
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

bootstrap().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
