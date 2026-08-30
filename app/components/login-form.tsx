"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "../lib/auth/actions";
import { useI18n } from "../lib/i18n";
import { LanguageSwitcher } from "./language-switcher";
import { LoginArtPanel } from "./login-scene";
import { ThemeToggle } from "./theme-toggle";

/**
 * Single-account sign-in. No signup, no password reset, no account edit.
 */
export function LoginForm() {
  const { t } = useI18n();
  const [state, action, pending] = useActionState(loginAction, null);

  return (
    <div className="relative flex min-h-0 w-full flex-1 flex-col lg:flex-row">
      <LoginArtPanel />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex justify-end px-4 pt-4 sm:px-6 sm:pt-6">
        <div className="pointer-events-auto flex items-center gap-1">
          <ThemeToggle />
          <LanguageSwitcher />
        </div>
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-10 sm:px-6 lg:max-w-none lg:w-[min(32rem,40%)] lg:flex-none lg:px-10 lg:py-16">
        <div className="app-card rounded-3xl border border-border p-7 shadow-sm sm:p-8">
          <div className="mb-6 flex flex-col items-center text-center">
            {/* eslint-disable-next-line @next/next/no-img-element -- brand SVG mark */}
            <img
              src="/myna-mark.svg"
              alt=""
              width={40}
              height={40}
              className="mb-4 h-10 w-10 rounded-xl shadow-sm ring-1 ring-border"
              aria-hidden
            />
            <p className="text-[0.65rem] font-semibold tracking-[0.22em] text-foreground-subtle">
              {t("signInEyebrow")}
            </p>
            <h1 className="mt-1.5 font-serif text-2xl font-semibold text-foreground">
              {t("signInTitle")}
            </h1>
          </div>

          <form action={action} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-foreground">{t("email")}</span>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="username"
                inputMode="email"
                required
                autoFocus
                disabled={pending}
                className="rounded-xl border border-border bg-background px-3 py-2.5 text-base outline-none focus:border-primary focus:ring-2 focus:ring-ring/25 disabled:opacity-60 sm:text-sm"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-foreground">{t("password")}</span>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                disabled={pending}
                className="rounded-xl border border-border bg-background px-3 py-2.5 text-base outline-none focus:border-primary focus:ring-2 focus:ring-ring/25 disabled:opacity-60 sm:text-sm"
              />
            </label>

            {state?.error ? (
              <p role="alert" className="text-sm font-medium text-danger">
                {errorMessage(state, t)}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={pending}
              className="mt-1 inline-flex h-12 items-center justify-center rounded-full bg-primary px-4 text-base font-semibold text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-60"
            >
              {pending ? t("signingIn") : t("signInSubmit")}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function errorMessage(
  state: NonNullable<LoginState>,
  t: (key: "signInMissing" | "signInInvalid" | "signInUnavailable") => string,
): string {
  if (state.error === "missing") return t("signInMissing");
  if (state.error === "invalid") return t("signInInvalid");
  return t("signInUnavailable");
}
