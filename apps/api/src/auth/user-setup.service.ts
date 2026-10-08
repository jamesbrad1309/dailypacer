import { Injectable } from "@nestjs/common";
import { asUser } from "#common/database/request-context";
import { CategoriesService } from "#finance/categories.service";
import { CurrenciesService } from "#finance/currencies.service";
import { TodosService } from "#todos/todos.service";

/**
 * Where an account's address is the email that the migration gives the
 * owner of data that existed before accounts did. It can't sign in; the
 * first sign-up or OWNER_EMAIL claims it, data and all.
 */
export const UNCLAIMED_EMAIL = "owner@unclaimed.invalid";

/**
 * What every user starts with: the default categories (and the system one
 * balance adjustments use), a main currency and an Inbox list. Safe to run
 * again: each step does nothing once it's there.
 */
@Injectable()
export class UserSetupService {
  constructor(
    private readonly categories: CategoriesService,
    private readonly currencies: CurrenciesService,
    private readonly todos: TodosService,
  ) {}

  provision(userId: string): Promise<void> {
    return asUser(userId, async () => {
      await this.categories.adjustmentCategory();
      await this.categories.seedDefaults();
      await this.currencies.ensureMain();
      await this.todos.ensureInbox();
    });
  }
}
