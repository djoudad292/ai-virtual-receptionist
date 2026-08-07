import { Module } from '@nestjs/common';
import { WidgetController } from './widget.controller';
import { AIModule } from '../ai/ai.module';

@Module({
  imports: [AIModule],
  controllers: [WidgetController],
})
export class WidgetModule {}
