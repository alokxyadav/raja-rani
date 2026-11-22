import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { Public } from '../auth/public.decorator';
import { Roles } from '../auth/roles.guard';
import { SettingsService } from './settings.service';
import { SetSettingDto } from './dto/setting.dto';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('settings')
@Controller('api/v1/settings')
export class SettingsController {
  constructor(private settings: SettingsService) {}

  // Public and unauthenticated deliberately — this is what the splash
  // screen calls before a session exists, to decide whether to show a
  // maintenance screen or a force-update prompt (Sections 100-101 of the
  // brief). Values here are non-sensitive by design (version strings and
  // booleans), never secrets.
  @Public()
  @Get()
  getAll() {
    return this.settings.getAll();
  }

  @Roles('ADMIN')
  @Put(':key')
  set(@Param('key') key: string, @Body() dto: SetSettingDto) {
    return this.settings.set(key, dto.value);
  }
}
