import { Global, Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { AuthController } from "#auth/auth.controller";
import { AuthGuard } from "#auth/auth.guard";
import { AuthService } from "#auth/auth.service";
import { SessionsService } from "#auth/sessions.service";
import { UsersController } from "#auth/users.controller";
import { UsersService } from "#auth/users.service";

@Global()
@Module({
  controllers: [AuthController, UsersController],
  providers: [
    AuthService,
    SessionsService,
    UsersService,
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
  exports: [SessionsService],
})
export class AuthModule {}
