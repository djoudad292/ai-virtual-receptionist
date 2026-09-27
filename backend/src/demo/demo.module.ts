import { Module } from '@nestjs/common';
import { AIModule } from '../ai/ai.module';
import { KnowledgeBaseModule } from '../knowledge-base/knowledge-base.module';
import { DemoController } from './demo.controller';
import { DemoService } from './demo.service';

@Module({
  imports: [AIModule, KnowledgeBaseModule],
  controllers: [DemoController],
  providers: [DemoService],
})
export class DemoModule {}
