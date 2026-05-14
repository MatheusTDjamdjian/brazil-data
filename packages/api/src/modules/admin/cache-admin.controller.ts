import { Controller, Delete, HttpCode } from '@nestjs/common';
import { CacheService } from '../../common/cache.service';

@Controller('admin/cache')
export class CacheAdminController {
  constructor(private readonly cache: CacheService) {}

  /**
   * DELETE /admin/cache
   * Limpa todo o cache de respostas. Útil em dev/demo.
   */
  @Delete()
  @HttpCode(200)
  async flush(): Promise<{ flushed: true; enabled: boolean }> {
    await this.cache.flush();
    return { flushed: true, enabled: this.cache.isEnabled() };
  }
}
