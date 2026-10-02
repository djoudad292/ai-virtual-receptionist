import { Module } from '@nestjs/common';
import { AIService } from './ai.service';
import { AIController } from './ai.controller';
import { EmbeddingsService } from './embeddings.service';
import { MailModule } from '../common/mail.module';

@Module({
  imports: [MailModule],
  controllers: [AIController],
  providers: [AIService, EmbeddingsService],
  exports: [AIService, EmbeddingsService],
})
export class AIModule {}
