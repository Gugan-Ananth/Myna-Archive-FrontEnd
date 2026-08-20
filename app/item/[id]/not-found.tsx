"use client";

import Link from "next/link";
import { StatusScreen } from "../../components/status-screen";
import { useI18n } from "../../lib/i18n";

export default function ItemNotFound() {
  const { t } = useI18n();

  return (
    <StatusScreen
      mood="not-found"
      title={t("imageNotFound")}
      hint={t("pageNotFoundHint")}
      action={
        <Link
          href="/"
          className="text-sm font-medium text-primary hover:underline"
        >
          {t("backToArchive")}
        </Link>
      }
    />
  );
}
