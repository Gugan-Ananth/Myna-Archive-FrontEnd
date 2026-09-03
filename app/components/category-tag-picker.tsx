"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createTaxonomyCategory,
  createTaxonomyTag,
  listTaxonomy,
  type TaxonomyCategoryDto,
} from "../lib/api";
import { useI18n } from "../lib/i18n";
import {
  buildTaxonomyFromApi,
  encodeTag,
  formatTagLabel,
  slugify,
  tagStorageValue,
  toDisplayLabel,
  UNCATEGORIZED_SLUG,
  type TaxonomyCategory,
} from "../lib/taxonomy";
import type { TagSummary } from "../lib/types";

type CategoryTagPickerProps = {
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  /** SSR/API taxonomy when available. */
  initialTaxonomy?: TaxonomyCategoryDto[];
  /** Optional usage counts from GET /tags for legacy freeform merge. */
  tagSummaries?: TagSummary[];
};

/**
 * Category → multi-select tags for create / edit.
 * Vocabulary from Nest `GET /taxonomy`; Others / new category POST to API.
 */
export function CategoryTagPicker({
  value,
  onChange,
  disabled = false,
  initialTaxonomy = [],
  tagSummaries = [],
}: CategoryTagPickerProps) {
  const { t } = useI18n();
  /** Client-fetched tree; null means “use initialTaxonomy / still loading”. */
  const [fetchedTaxonomy, setFetchedTaxonomy] = useState<
    TaxonomyCategoryDto[] | null
  >(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [mutating, setMutating] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [othersOpen, setOthersOpen] = useState<string | null>(null);
  const [othersDraft, setOthersDraft] = useState("");
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryTag, setNewCategoryTag] = useState("");

  const apiTaxonomy = fetchedTaxonomy ?? initialTaxonomy;
  const loading =
    fetchedTaxonomy === null &&
    initialTaxonomy.length === 0 &&
    !loadFailed;

  const refreshTaxonomy = useCallback(async () => {
    try {
      const data = await listTaxonomy({ cache: "no-store" });
      setFetchedTaxonomy(data);
      setLocalError(null);
      setLoadFailed(false);
    } catch {
      // Keep previous tree (seed fallback via buildTaxonomyFromApi).
      setLoadFailed(true);
    }
  }, []);

  useEffect(() => {
    // SSR/parent already provided vocabulary — no client fetch needed.
    if (initialTaxonomy.length > 0) return;

    let cancelled = false;
    void (async () => {
      try {
        const data = await listTaxonomy();
        if (!cancelled) {
          setFetchedTaxonomy(data);
          setLocalError(null);
          setLoadFailed(false);
        }
      } catch {
        if (!cancelled) setLoadFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initialTaxonomy.length]);

  const taxonomy = useMemo(
    () =>
      buildTaxonomyFromApi(apiTaxonomy, tagSummaries, {
        includeUnused: true,
      }),
    [apiTaxonomy, tagSummaries],
  );

  const selectedSet = useMemo(() => new Set(value), [value]);
  const busy = disabled || mutating;

  function toggleEncoded(encoded: string) {
    if (busy || !encoded) return;
    if (selectedSet.has(encoded)) {
      onChange(value.filter((v) => v !== encoded));
    } else {
      onChange([...value, encoded]);
    }
  }

  function removeEncoded(encoded: string) {
    if (busy) return;
    onChange(value.filter((v) => v !== encoded));
  }

  async function addOthers(category: TaxonomyCategory) {
    const label = othersDraft.trim();
    if (!label || busy) return;
    setMutating(true);
    setLocalError(null);
    try {
      const result = await createTaxonomyTag(
        category.slug,
        toDisplayLabel(label),
      );
      const encoded = encodeTag(result.categorySlug, result.tag.slug);
      await refreshTaxonomy();
      if (encoded && !selectedSet.has(encoded)) {
        onChange([...value, encoded]);
      }
      setOthersDraft("");
      setOthersOpen(null);
    } catch (err) {
      setLocalError(
        err instanceof Error ? err.message : t("somethingWentWrong"),
      );
    } finally {
      setMutating(false);
    }
  }

  async function submitNewCategory() {
    if (busy) return;
    const catLabel = newCategoryName.trim();
    const tagLabel = newCategoryTag.trim();
    if (!catLabel || !tagLabel) return;

    setMutating(true);
    setLocalError(null);
    try {
      const created = await createTaxonomyCategory({
        label: toDisplayLabel(catLabel),
        firstTag: { label: toDisplayLabel(tagLabel) },
      });
      const first = created.tags[0];
      const encoded = first
        ? encodeTag(created.slug, first.slug)
        : encodeTag(created.slug, slugify(tagLabel));
      await refreshTaxonomy();
      if (encoded && !selectedSet.has(encoded)) {
        onChange([...value, encoded]);
      }
      setNewCategoryName("");
      setNewCategoryTag("");
      setAddingCategory(false);
    } catch (err) {
      setLocalError(
        err instanceof Error ? err.message : t("somethingWentWrong"),
      );
    } finally {
      setMutating(false);
    }
  }

  return (
    <div className="min-w-0 space-y-2">
      <div className="flex min-h-[1.75rem] flex-wrap gap-1.5">
        {value.length === 0 && (
          <span className="text-sm text-foreground-subtle">
            {t("addAtLeastOneTagHint")}
          </span>
        )}
        {value.map((encoded) => (
          <span
            key={encoded}
            className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2.5 py-0.5 text-base font-medium text-primary"
          >
            {formatTagLabel(encoded, taxonomy)}
            <button
              type="button"
              disabled={busy}
              onClick={() => removeEncoded(encoded)}
              aria-label={t("removeTag", {
                tag: formatTagLabel(encoded, taxonomy),
              })}
              className="rounded-full hover:bg-primary/15 disabled:opacity-50"
            >
              ×
            </button>
          </span>
        ))}
      </div>

      {localError && (
        <p className="text-base text-danger" role="alert">
          {localError}
        </p>
      )}

      {loading && taxonomy.length === 0 ? (
        <p className="text-base text-foreground-muted">{t("loadingMore")}</p>
      ) : (
        <div className="space-y-1.5">
          {taxonomy.map((category) => (
            <CategorySection
              key={category.slug}
              category={category}
              selectedSet={selectedSet}
              disabled={busy}
              allowOthers={category.slug !== UNCATEGORIZED_SLUG}
              othersOpen={othersOpen === category.slug}
              othersDraft={othersOpen === category.slug ? othersDraft : ""}
              onToggleTag={(tagSlug) => {
                const encoded = tagStorageValue(category.slug, tagSlug);
                toggleEncoded(encoded);
              }}
              onOpenOthers={() => {
                setOthersOpen(category.slug);
                setOthersDraft("");
                setAddingCategory(false);
              }}
              onCloseOthers={() => {
                setOthersOpen(null);
                setOthersDraft("");
              }}
              onOthersDraftChange={setOthersDraft}
              onAddOthers={() => void addOthers(category)}
              othersLabel={t("others")}
              customTagPlaceholder={t("customTagPlaceholder")}
              addLabel={t("addTagButton")}
            />
          ))}
        </div>
      )}

      {addingCategory ? (
        <div className="space-y-1.5 rounded-xl border border-border bg-background p-2.5">
          <p className="text-sm font-semibold uppercase tracking-wide text-foreground-muted">
            {t("addCategory")}
          </p>
          <input
            type="text"
            value={newCategoryName}
            disabled={busy}
            onChange={(e) => setNewCategoryName(e.target.value)}
            placeholder={t("categoryNamePlaceholder")}
            className="w-full rounded-xl border border-border bg-background px-3 py-1.5 text-base outline-none focus:border-primary focus:ring-2 focus:ring-ring/25 disabled:opacity-60"
          />
          <input
            type="text"
            value={newCategoryTag}
            disabled={busy}
            onChange={(e) => setNewCategoryTag(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void submitNewCategory();
              }
            }}
            placeholder={t("firstTagPlaceholder")}
            className="w-full rounded-xl border border-border bg-background px-3 py-1.5 text-base outline-none focus:border-primary focus:ring-2 focus:ring-ring/25 disabled:opacity-60"
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={
                busy ||
                !slugify(newCategoryName) ||
                !slugify(newCategoryTag)
              }
              onClick={() => void submitNewCategory()}
              className="rounded-xl bg-primary px-3 py-1.5 text-base font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-50"
            >
              {t("addCategoryConfirm")}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setAddingCategory(false);
                setNewCategoryName("");
                setNewCategoryTag("");
              }}
              className="rounded-xl border border-border px-3 py-1.5 text-base font-medium text-foreground hover:bg-surface-muted disabled:opacity-50"
            >
              {t("cancel")}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setAddingCategory(true);
            setOthersOpen(null);
          }}
          className="inline-flex h-8 items-center rounded-xl border border-dashed border-border-strong px-3 text-base font-medium text-foreground-muted transition-colors hover:border-primary hover:bg-accent-soft hover:text-primary disabled:opacity-50"
        >
          + {t("addCategory")}
        </button>
      )}
    </div>
  );
}

type CategorySectionProps = {
  category: TaxonomyCategory;
  selectedSet: Set<string>;
  disabled: boolean;
  allowOthers: boolean;
  othersOpen: boolean;
  othersDraft: string;
  onToggleTag: (tagSlug: string) => void;
  onOpenOthers: () => void;
  onCloseOthers: () => void;
  onOthersDraftChange: (v: string) => void;
  onAddOthers: () => void;
  othersLabel: string;
  customTagPlaceholder: string;
  addLabel: string;
};

function CategorySection({
  category,
  selectedSet,
  disabled,
  allowOthers,
  othersOpen,
  othersDraft,
  onToggleTag,
  onOpenOthers,
  onCloseOthers,
  onOthersDraftChange,
  onAddOthers,
  othersLabel,
  customTagPlaceholder,
  addLabel,
}: CategorySectionProps) {
  return (
    <fieldset
      disabled={disabled}
      className="rounded-xl border border-border bg-background px-2.5 py-1.5 disabled:opacity-60"
    >
      <legend className="px-1 text-sm font-semibold uppercase tracking-wide text-foreground-muted">
        {category.label}
      </legend>
      <div className="flex flex-wrap gap-1">
        {category.tags.map((tag) => {
          const encoded = tagStorageValue(category.slug, tag.slug);
          const selected = selectedSet.has(encoded);
          return (
            <button
              key={tag.slug}
              type="button"
              onClick={() => onToggleTag(tag.slug)}
              aria-pressed={selected}
              className={[
                "inline-flex h-8 items-center rounded-lg px-2.5 text-base font-medium transition-all",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                selected
                  ? "bg-primary text-primary-foreground shadow-sm hover:bg-primary-hover"
                  : "bg-surface-muted text-foreground hover:bg-border-strong/50",
              ].join(" ")}
            >
              {tag.label}
            </button>
          );
        })}

        {allowOthers && (
          <button
            type="button"
            onClick={() => (othersOpen ? onCloseOthers() : onOpenOthers())}
            aria-expanded={othersOpen}
            className={[
              "inline-flex h-8 items-center rounded-lg border border-dashed px-2.5 text-base font-medium transition-all",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              othersOpen
                ? "border-primary bg-accent-soft text-primary"
                : "border-border-strong bg-background text-foreground-muted hover:border-primary hover:bg-accent-soft hover:text-primary",
            ].join(" ")}
          >
            {othersLabel}
          </button>
        )}
      </div>

      {allowOthers && othersOpen && (
        <div className="mt-1.5 flex gap-2">
          <input
            type="text"
            value={othersDraft}
            autoFocus
            onChange={(e) => onOthersDraftChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onAddOthers();
              }
              if (e.key === "Escape") {
                e.preventDefault();
                onCloseOthers();
              }
            }}
            placeholder={customTagPlaceholder}
            className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-1.5 text-base outline-none focus:border-primary focus:ring-2 focus:ring-ring/25"
          />
          <button
            type="button"
            disabled={!slugify(othersDraft)}
            onClick={onAddOthers}
            className="rounded-xl border border-border px-3 text-base font-medium hover:bg-surface-muted disabled:opacity-50"
          >
            {addLabel}
          </button>
        </div>
      )}
    </fieldset>
  );
}
