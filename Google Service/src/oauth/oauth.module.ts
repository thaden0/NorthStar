import { Module } from '@nestjs/common';
import { OAuthController } from './oauth.controller';
import { OAuthService } from './oauth.service';
import { GoogleClientService } from './google-client.service';

@Module({
  controllers: [OAuthController],
  providers: [OAuthService, GoogleClientService],
  exports: [OAuthService, GoogleClientService],
})
export class OAuthModule {}
