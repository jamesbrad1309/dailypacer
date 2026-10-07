import { useMutation, useQuery } from "@apollo/client/react";
import { ArrowLeft, Pause, Play, Plus, Search, Trash2, Undo2 } from "lucide-react";
import { type FormEvent, type ReactNode, useReducer, useState } from "react";
import { useTranslation } from "react-i18next";
import { MoneyInput } from "#components/finance/MoneyInput";
import { ServiceLogo } from "#components/finance/subscriptions/ServiceLogo";
import { Button } from "#components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "#components/ui/dialog";
import { Input } from "#components/ui/input";
import { Label } from "#components/ui/label";
import { ACCOUNTS_QUERY, CATEGORIES_QUERY } from "#graphql/finance";
import {
  CANCEL_SUBSCRIPTION_MUTATION,
  CHANGE_SUBSCRIPTION_PRICE_MUTATION,
  CREATE_SUBSCRIPTION_MUTATION,
  DELETE_SUBSCRIPTION_MUTATION,
  PAUSE_SUBSCRIPTION_MUTATION,
  REACTIVATE_SUBSCRIPTION_MUTATION,
  RESUME_SUBSCRIPTION_MUTATION,
  SUBSCRIPTION_SERVICES_QUERY,
  SUBSCRIPTIONS_REFETCH,
  UPDATE_SUBSCRIPTION_MUTATION,
} from "#graphql/subscriptions";
import type {
  AccountsData,
  BillingInterval,
  Category,
  Subscription,
  SubscriptionService,
} from "#graphql/types";
import { useCategoryName } from "#hooks/useCategoryName";
import { formatShortDate, todayIsoDate } from "#lib/dates";
import { formatMoney, parseMoneyInput, toMoneyInput } from "#lib/money";
import { cn } from "#lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Edit this one; without it the dialog adds a new subscription. */
  subscription?: Subscription;
}

const selectClass =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50";

const INTERVALS: BillingInterval[] = ["WEEK", "MONTH", "YEAR"];

/** A picked catalog service, or `custom` for one typed in by hand. */
type Picked = SubscriptionService | "custom";

/**
 * Adding starts from the built-in list of services (with their logos), or
 * "Something else"; then one form. Editing shows the same form, plus the
 * price (changed from a date, keeping history), pause and cancel.
 */
export function SubscriptionDialog({ open, onOpenChange, subscription }: Props) {
  const { t } = useTranslation();
  const [picked, setPicked] = useState<Picked | null>(null);

  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setPicked(null);
  }

  const editing = Boolean(subscription);
  const choosing = !editing && picked === null;
  const title = subscription
    ? t("finance.subscriptions.dialog.editTitle", { name: subscription.name })
    : t("finance.subscriptions.dialog.addTitle");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {choosing ? (
          <ServicePicker onPick={setPicked} />
        ) : (
          <SubscriptionForm
            key={subscription?.id ?? (picked === "custom" ? "custom" : picked?.key)}
            subscription={subscription}
            service={picked && picked !== "custom" ? picked : null}
            onBack={editing ? undefined : () => setPicked(null)}
            onDone={() => onOpenChange(false)}
          />
        )}
        {subscription && (
          <ManageSubscription subscription={subscription} onDeleted={() => onOpenChange(false)} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function ServicePicker({ onPick }: { onPick: (picked: Picked) => void }) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const { data, previousData } = useQuery<{ subscriptionServices: SubscriptionService[] }>(
    SUBSCRIPTION_SERVICES_QUERY,
    { variables: { search: search.trim() || null } },
  );
  // Keep the last results on screen while the next search loads, instead of flashing empty.
  const services = (data ?? previousData)?.subscriptionServices ?? [];

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          autoFocus
          aria-label={t("finance.subscriptions.dialog.search")}
          placeholder={t("finance.subscriptions.dialog.searchPlaceholder")}
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {services.length === 0 && data && (
        <p className="text-sm text-muted-foreground">
          {t("finance.subscriptions.dialog.noMatches")}
        </p>
      )}
      <ul className="grid max-h-72 grid-cols-2 gap-1.5 overflow-y-auto sm:grid-cols-3">
        {services.map((service) => (
          <li key={service.key}>
            <button
              type="button"
              onClick={() => onPick(service)}
              className="flex w-full items-center gap-2 rounded-md border px-2 py-1.5 text-left text-sm outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ServiceLogo name={service.name} logoUrl={service.logoUrl} size="sm" />
              <span className="min-w-0 truncate">{service.name}</span>
            </button>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={() => onPick("custom")}
        className="flex items-center gap-3 rounded-md border border-dashed px-3 py-2 text-left outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="flex size-8 items-center justify-center rounded-lg bg-muted">
          <Plus className="size-4" />
        </span>
        <span>
          <span className="block text-sm font-medium">
            {t("finance.subscriptions.dialog.custom")}
          </span>
          <span className="block text-xs text-muted-foreground">
            {t("finance.subscriptions.dialog.customHint")}
          </span>
        </span>
      </button>
    </div>
  );
}

function SubscriptionForm({
  subscription,
  service,
  onBack,
  onDone,
}: {
  subscription?: Subscription;
  service: SubscriptionService | null;
  onBack?: () => void;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const categoryName = useCategoryName();
  const { data: accountsData } = useQuery<AccountsData>(ACCOUNTS_QUERY);
  const { data: categoriesData } = useQuery<{ categories: Category[] }>(CATEGORIES_QUERY);
  const accounts = accountsData?.accounts ?? [];
  const custom = !subscription && !service;

  const [draft, setDraft] = useState(() => ({
    name: subscription?.name ?? service?.name ?? "",
    domain: subscription?.domain ?? "",
    amount: "",
    interval: subscription?.interval ?? ("MONTH" as BillingInterval),
    intervalCount: String(subscription?.intervalCount ?? 1),
    nextChargeOn: subscription?.nextChargeOn ?? subscription?.firstChargeOn ?? todayIsoDate(),
    trial: Boolean(subscription?.trialEndsOn),
    trialEndsOn: subscription?.trialEndsOn ?? "",
    accountId: subscription?.account.id ?? accounts.find((a) => a.isDefault)?.id ?? "",
    // "" = let the API choose the service's usual category.
    categoryId: subscription?.category?.id ?? "",
    note: subscription?.note ?? "",
    isIncome: subscription?.isIncome ?? false,
    autoLog: subscription?.autoLog ?? false,
  }));
  const categories = (categoriesData?.categories ?? []).filter(
    (c) => c.kind === (draft.isIncome ? "income" : "expense"),
  );
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof typeof draft>(key: K, value: (typeof draft)[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const options = { refetchQueries: SUBSCRIPTIONS_REFETCH, awaitRefetchQueries: true };
  const [create, created] = useMutation(CREATE_SUBSCRIPTION_MUTATION, options);
  const [update, updated] = useMutation(UPDATE_SUBSCRIPTION_MUTATION, options);
  const saving = created.loading || updated.loading;
  // The accounts query may still be loading when the form opens; fall back to the default.
  const accountId = draft.accountId || accounts.find((a) => a.isDefault)?.id || "";
  const currency =
    accounts.find((a) => a.id === accountId)?.currency ?? subscription?.currency ?? "GBP";

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const name = draft.name.trim();
    const amountMinor = parseMoneyInput(draft.amount, currency);
    const nextChargeOn = draft.trial ? draft.trialEndsOn : draft.nextChargeOn;
    if (!name) return setError(t("finance.subscriptions.dialog.enterName"));
    if (!subscription && !amountMinor)
      return setError(t("finance.subscriptions.dialog.enterPrice"));
    if (!accountId) return setError(t("finance.subscriptions.dialog.chooseAccount"));
    if (!nextChargeOn) return setError(t("finance.subscriptions.dialog.enterDate"));

    const common = {
      name,
      accountId,
      interval: draft.interval,
      intervalCount: Math.min(52, Math.max(1, Number(draft.intervalCount) || 1)),
      trialEndsOn: draft.trial ? draft.trialEndsOn : null,
      note: draft.note.trim() || null,
      isIncome: draft.isIncome,
      autoLog: draft.autoLog,
      // Adding: leave it out for the service's usual category. Editing: "" clears it.
      ...(draft.categoryId || subscription ? { categoryId: draft.categoryId || null } : {}),
      ...(custom || subscription ? { domain: draft.domain.trim() || null } : {}),
    };
    const today = todayIsoDate();
    try {
      if (subscription) {
        const moved = nextChargeOn !== (subscription.nextChargeOn ?? subscription.firstChargeOn);
        await update({
          variables: {
            id: subscription.id,
            today,
            input: { ...common, ...(moved ? { nextChargeOn } : {}) },
          },
        });
      } else {
        await create({
          variables: {
            today,
            input: { ...common, serviceKey: service?.key ?? null, amountMinor, nextChargeOn },
          },
        });
      }
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.couldntSave"));
    }
  }

  if (accountsData && accounts.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {t("finance.subscriptions.dialog.noAccounts")}
      </p>
    );
  }

  const logoName = draft.name || service?.name || "?";
  const logoUrl = service?.logoUrl ?? subscription?.logoUrl ?? null;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1 self-start text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" /> {t("finance.subscriptions.dialog.back")}
        </button>
      )}

      <div className="flex items-end gap-3">
        <ServiceLogo name={logoName} logoUrl={logoUrl} size="lg" />
        <Field label={t("finance.subscriptions.dialog.name")} id="sub-name" className="flex-1">
          <Input
            id="sub-name"
            autoComplete="off"
            autoFocus={custom}
            value={draft.name}
            onChange={(e) => set("name", e.target.value)}
          />
        </Field>
      </div>

      {(custom || subscription) && (
        <Field
          label={t("finance.subscriptions.dialog.website")}
          hint={t("finance.subscriptions.dialog.websiteHint")}
          id="sub-domain"
          optional
        >
          <Input
            id="sub-domain"
            inputMode="url"
            autoComplete="off"
            placeholder="netflix.com"
            value={draft.domain}
            onChange={(e) => set("domain", e.target.value)}
          />
        </Field>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {!subscription && (
          <Field label={t("finance.subscriptions.dialog.price")} id="sub-amount">
            <MoneyInput
              id="sub-amount"
              currency={currency}
              autoFocus={!custom}
              value={draft.amount}
              onChange={(e) => set("amount", e.target.value)}
            />
          </Field>
        )}
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium">
            {t("finance.subscriptions.dialog.billedEvery")}
          </legend>
          <div className="flex gap-2">
            <Input
              type="number"
              min={1}
              max={52}
              aria-label={t("finance.subscriptions.dialog.billedEvery")}
              className="w-16"
              value={draft.intervalCount}
              onChange={(e) => set("intervalCount", e.target.value)}
            />
            <select
              aria-label={t("finance.subscriptions.dialog.billedEvery")}
              className={selectClass}
              value={draft.interval}
              onChange={(e) => set("interval", e.target.value as BillingInterval)}
            >
              {INTERVALS.map((interval) => (
                <option key={interval} value={interval}>
                  {t(`finance.subscriptions.dialog.unit.${interval}`, {
                    count: Number(draft.intervalCount) || 1,
                  })}
                </option>
              ))}
            </select>
          </div>
        </fieldset>
      </div>

      {custom || subscription?.isIncome ? (
        <Toggle
          checked={draft.isIncome}
          onChange={(isIncome) => setDraft((d) => ({ ...d, isIncome, categoryId: "" }))}
          label={t("finance.subscriptions.dialog.isIncome")}
          hint={t("finance.subscriptions.dialog.isIncomeHint")}
        />
      ) : null}

      <label className="flex cursor-pointer items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={draft.trial}
          onChange={(e) => set("trial", e.target.checked)}
          className="mt-0.5 accent-primary"
        />
        <span>
          {t("finance.subscriptions.dialog.freeTrial")}
          <span className="block text-xs text-muted-foreground">
            {t("finance.subscriptions.dialog.trialHint")}
          </span>
        </span>
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        {draft.trial ? (
          <Field label={t("finance.subscriptions.dialog.trialEnds")} id="sub-trial">
            <Input
              id="sub-trial"
              type="date"
              value={draft.trialEndsOn}
              onChange={(e) => set("trialEndsOn", e.target.value)}
            />
          </Field>
        ) : (
          <Field label={t("finance.subscriptions.dialog.nextCharge")} id="sub-next">
            <Input
              id="sub-next"
              type="date"
              value={draft.nextChargeOn}
              onChange={(e) => set("nextChargeOn", e.target.value)}
            />
          </Field>
        )}
        <Field label={t("finance.subscriptions.dialog.account")} id="sub-account">
          <select
            id="sub-account"
            className={selectClass}
            value={accountId}
            onChange={(e) => set("accountId", e.target.value)}
          >
            <option value="" disabled>
              {t("common.choose")}
            </option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("finance.subscriptions.dialog.category")} id="sub-category" optional>
          <select
            id="sub-category"
            className={selectClass}
            value={draft.categoryId}
            onChange={(e) => set("categoryId", e.target.value)}
          >
            <option value="">—</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.icon} {categoryName(c)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("finance.subscriptions.dialog.note")} id="sub-note" optional>
          <Input
            id="sub-note"
            autoComplete="off"
            value={draft.note}
            onChange={(e) => set("note", e.target.value)}
          />
        </Field>
      </div>

      <Toggle
        checked={draft.autoLog}
        onChange={(autoLog) => set("autoLog", autoLog)}
        label={t("finance.subscriptions.dialog.autoLog")}
        hint={t("finance.subscriptions.dialog.autoLogHint")}
      />

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <DialogFooter>
        <Button type="submit" disabled={saving}>
          {subscription ? t("common.save") : t("common.add")}
        </Button>
      </DialogFooter>
    </form>
  );
}

/** The manage section's open panels and their inputs. */
interface ManageState {
  editingPrice: boolean;
  price: string;
  /** "YYYY-MM-DD" the new price applies from. */
  priceFrom: string;
  cancelling: boolean;
  /** "YYYY-MM-DD" the subscription runs until when cancelled. */
  endsOn: string;
  deleting: boolean;
  error: string | null;
}

type ManageAction = {
  [K in keyof ManageState]: { type: "set"; field: K; value: ManageState[K] };
}[keyof ManageState];

function manageReducer(state: ManageState, action: ManageAction): ManageState {
  return { ...state, [action.field]: action.value };
}

/** Price changes, pause, cancel and delete: each takes effect at once, apart from the form. */
function ManageSubscription({
  subscription: sub,
  onDeleted,
}: {
  subscription: Subscription;
  onDeleted: () => void;
}) {
  const { t } = useTranslation();
  const today = todayIsoDate();
  const nextOrToday = sub.nextChargeOn ?? today;
  const [state, dispatch] = useReducer(manageReducer, {
    editingPrice: false,
    price: toMoneyInput(sub.amountMinor, sub.currency),
    priceFrom: nextOrToday,
    cancelling: false,
    endsOn: nextOrToday,
    deleting: false,
    error: null,
  });
  const set = <K extends keyof ManageState>(field: K, value: ManageState[K]) =>
    dispatch({ type: "set", field, value } as ManageAction);
  const { editingPrice, price, priceFrom, cancelling, endsOn, deleting, error } = state;

  const options = { refetchQueries: SUBSCRIPTIONS_REFETCH, awaitRefetchQueries: true };
  const [changePrice, changingPrice] = useMutation(CHANGE_SUBSCRIPTION_PRICE_MUTATION, options);
  const [pause] = useMutation(PAUSE_SUBSCRIPTION_MUTATION, options);
  const [resume] = useMutation(RESUME_SUBSCRIPTION_MUTATION, options);
  const [cancel] = useMutation(CANCEL_SUBSCRIPTION_MUTATION, options);
  const [reactivate] = useMutation(REACTIVATE_SUBSCRIPTION_MUTATION, options);
  const [remove] = useMutation(DELETE_SUBSCRIPTION_MUTATION, options);

  async function run(action: () => Promise<unknown>) {
    set("error", null);
    try {
      await action();
      return true;
    } catch (err) {
      set("error", err instanceof Error ? err.message : t("common.couldntSave"));
      return false;
    }
  }

  async function savePrice() {
    const amountMinor = parseMoneyInput(price, sub.currency);
    if (!amountMinor) return set("error", t("finance.subscriptions.dialog.enterPrice"));
    const ok = await run(() =>
      changePrice({ variables: { id: sub.id, amountMinor, effectiveFrom: priceFrom, today } }),
    );
    if (ok) set("editingPrice", false);
  }

  const vars = { variables: { id: sub.id, today } };
  const ended = sub.status === "ENDED";

  return (
    <div className="flex flex-col gap-4 border-t pt-4">
      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">{t("finance.subscriptions.manage.priceTitle")}</h3>
          {!editingPrice && (
            <Button size="sm" variant="outline" onClick={() => set("editingPrice", true)}>
              {t("finance.subscriptions.manage.changePrice")}
            </Button>
          )}
        </div>
        {editingPrice && (
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <Field label={t("finance.subscriptions.manage.newPrice")} id="sub-new-price">
              <MoneyInput
                id="sub-new-price"
                currency={sub.currency}
                autoFocus
                value={price}
                onChange={(e) => set("price", e.target.value)}
              />
            </Field>
            <Field label={t("finance.subscriptions.manage.from")} id="sub-price-from">
              <Input
                id="sub-price-from"
                type="date"
                value={priceFrom}
                onChange={(e) => set("priceFrom", e.target.value)}
              />
            </Field>
            <Button disabled={changingPrice.loading} onClick={savePrice}>
              {t("finance.subscriptions.manage.savePrice")}
            </Button>
            <p className="text-xs text-muted-foreground sm:col-span-3">
              {t("finance.subscriptions.manage.fromHint")}
            </p>
          </div>
        )}
        <ol
          aria-label={t("finance.subscriptions.manage.history")}
          className="flex flex-col gap-1 text-sm"
        >
          {sub.prices.map((p, i) => (
            <li
              key={p.effectiveFrom}
              className={cn("flex justify-between tabular-nums", i > 0 && "text-muted-foreground")}
            >
              <span>{formatMoney(p.amountMinor, sub.currency)}</span>
              <span className="text-xs">
                {t("finance.subscriptions.manage.since", {
                  date: formatShortDate(p.effectiveFrom),
                })}
              </span>
            </li>
          ))}
        </ol>
      </section>

      {sub.status === "PAUSED" && (
        <p className="text-xs text-muted-foreground">
          {t("finance.subscriptions.manage.pausedHint")}
        </p>
      )}
      {sub.endsOn && (
        <p className="text-xs text-muted-foreground">
          {t("finance.subscriptions.manage.endsHint", { date: formatShortDate(sub.endsOn) })}
        </p>
      )}

      {cancelling && !sub.endsOn && (
        <div className="flex flex-wrap items-end gap-3">
          <Field label={t("finance.subscriptions.manage.stopFrom")} id="sub-ends">
            <Input
              id="sub-ends"
              type="date"
              value={endsOn}
              onChange={(e) => set("endsOn", e.target.value)}
            />
          </Field>
          <Button
            variant="destructive"
            onClick={async () => {
              if (await run(() => cancel({ variables: { id: sub.id, endsOn, today } }))) {
                set("cancelling", false);
              }
            }}
          >
            {t("finance.subscriptions.manage.confirmCancel")}
          </Button>
        </div>
      )}

      {deleting && (
        <div className="flex flex-col gap-2 rounded-md bg-destructive/10 p-3">
          <p className="text-sm">
            {t("finance.subscriptions.manage.deleteHint", { name: sub.name })}
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => set("deleting", false)}>
              {t("common.cancel")}
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={async () => {
                if (await run(() => remove({ variables: { id: sub.id } }))) onDeleted();
              }}
            >
              <Trash2 className="size-3.5" /> {t("finance.subscriptions.manage.confirmDelete")}
            </Button>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {!ended &&
          (sub.status === "PAUSED" ? (
            <Button size="sm" variant="outline" onClick={() => run(() => resume(vars))}>
              <Play className="size-3.5" /> {t("finance.subscriptions.manage.resume")}
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={() => run(() => pause(vars))}>
              <Pause className="size-3.5" /> {t("finance.subscriptions.manage.pause")}
            </Button>
          ))}
        {sub.endsOn ? (
          <Button size="sm" variant="outline" onClick={() => run(() => reactivate(vars))}>
            <Undo2 className="size-3.5" /> {t("finance.subscriptions.manage.reactivate")}
          </Button>
        ) : (
          !cancelling && (
            <Button size="sm" variant="outline" onClick={() => set("cancelling", true)}>
              {t("finance.subscriptions.manage.cancel")}
            </Button>
          )
        )}
        {!deleting && (
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto text-muted-foreground"
            onClick={() => set("deleting", true)}
          >
            <Trash2 className="size-3.5" /> {t("finance.subscriptions.manage.delete")}
          </Button>
        )}
      </div>
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  hint: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 accent-primary"
      />
      <span>
        {label}
        <span className="block text-xs text-muted-foreground">{hint}</span>
      </span>
    </label>
  );
}

function Field({
  label,
  id,
  hint,
  optional,
  className,
  children,
}: {
  label: string;
  id: string;
  hint?: string;
  optional?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Label htmlFor={id} className="flex items-baseline gap-1.5">
        {label}
        {optional && (
          <span className="text-xs font-normal text-muted-foreground">{t("common.optional")}</span>
        )}
      </Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
