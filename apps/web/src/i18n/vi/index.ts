import type { en } from "#i18n/en/index";
import { auth } from "#i18n/vi/auth";
import { commands } from "#i18n/vi/commands";
import { common } from "#i18n/vi/common";
import { finance } from "#i18n/vi/finance";
import { habits } from "#i18n/vi/habits";
import { journal } from "#i18n/vi/journal";
import { notifications } from "#i18n/vi/notifications";
import { progress } from "#i18n/vi/progress";
import { shell } from "#i18n/vi/shell";
import { todos } from "#i18n/vi/todos";

export const vi: typeof en = {
  common,
  shell,
  commands,
  finance,
  habits,
  journal,
  todos,
  progress,
  notifications,
  auth,
};
