"use client";

import Link from "next/link";
import { useI18n } from "../../lib/i18n";

export default function ItemNotFound() {
  const { t } = useI18n();

  return (
    <div className="mx-auto flex flex-1 flex-col items-center justify-center gap-3 px-4 py-20 text-center">
      <p className="text-lg font-semibold text-foreground">{t("imageNotFound")}</p>
      <Link
        href="/"
        className="text-sm font-medium text-primary hover:underline"
      >
        {t("backToArchive")}
      </Link>
    </div>
  );
}
