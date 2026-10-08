import { Global, Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { AuthController } from "#auth/auth.controller";
import { AuthGuard } from "#auth/auth.guard";
import { AuthService } from "#auth/auth.service";
import { SessionsService } from "#auth/sessions.service";
import { UserSetupService } from "#auth/user-setup.service";
import { UsersController } from "#auth/users.controller";
import { UsersService } from "#auth/users.service";
import { FinanceModule } from "#finance/finance.module";
import { TodosModule } from "#todos/todos.module";

@Global()
@Module({
  imports: [FinanceModule, TodosModule],
  controllers: [AuthController, UsersController],
  providers: [
    AuthService,
    SessionsService,
    UsersService,
    UserSetupService,
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
  exports: [SessionsService, UserSetupService],
})
export class AuthModule {}
