"use client";

import Link from "next/link";
import { useEffect } from "react";
import { StatusScreen } from "./components/status-screen";
import { useI18n } from "./lib/i18n";

export default function ErrorPage({
  error,
  reset,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  reset?: () => void;
  unstable_retry?: () => void;
}) {
  const { t } = useI18n();
  const retry = unstable_retry ?? reset;

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <StatusScreen
      mood="error"
      title={t("pageErrorTitle")}
      hint={t("pageErrorHint")}
      action={
        <div className="mt-1 flex flex-wrap items-center justify-center gap-3">
          {retry ? (
            <button
              type="button"
              onClick={() => retry()}
              className="inline-flex h-10 items-center justify-center rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
            >
              {t("tryAgain")}
            </button>
          ) : null}
          <Link
            href="/"
            className="text-sm font-medium text-primary hover:underline"
          >
            {t("backToArchive")}
          </Link>
        </div>
      }
    />
  );
}
