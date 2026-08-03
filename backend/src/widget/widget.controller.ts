import { Controller, Get, Param } from '@nestjs/common';
import { StoreService } from '../common/store.service';

const DEFAULT_WIDGET = {
  title: 'Customer Support',
  color: '#3b82f6',
  position: 'right',
};

@Controller('widget')
export class WidgetController {
  constructor(private store: StoreService) {}

  @Get(':companyId/config')
  async getConfig(@Param('companyId') companyId: string) {
    const company = await this.store.findCompanyById(companyId);
    const w = company?.settings?.widget || {};
    return {
      title: w.title || DEFAULT_WIDGET.title,
      color: w.color || DEFAULT_WIDGET.color,
      position: w.position === 'left' ? 'left' : DEFAULT_WIDGET.position,
    };
  }
}
