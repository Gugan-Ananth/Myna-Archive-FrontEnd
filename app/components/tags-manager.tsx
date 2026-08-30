"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  ApiError,
  createTaxonomyCategory,
  createTaxonomyTag,
  deleteTaxonomyCategory,
  deleteTaxonomyTag,
  updateTaxonomyCategory,
  updateTaxonomyTag,
} from "../lib/api";
import { useI18n } from "../lib/i18n";
import { slugify, toDisplayLabel } from "../lib/taxonomy";
import type { TaxonomyCategoryDto, TaxonomyTagDto } from "../lib/types";
import { EmptyBoard } from "./empty-board";
import { StatusCallout } from "./status-callout";

type TagsManagerProps = {
  initialCategories: TaxonomyCategoryDto[];
};

/**
 * Outline of categories (1, 2, 3) with indented tags (a, b, c).
 * Tag chips keep inline edit / move / delete.
 */
export function TagsManager({ initialCategories }: TagsManagerProps) {
  const { t } = useI18n();
  const [categories, setCategories] = useState(initialCategories);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryTag, setNewCategoryTag] = useState("");
  const [addingTagFor, setAddingTagFor] = useState<string | null>(null);
  const [draftTag, setDraftTag] = useState("");
  const [editingCategorySlug, setEditingCategorySlug] = useState<string | null>(
    null,
  );
  const [categoryDraft, setCategoryDraft] = useState("");
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [tagDraft, setTagDraft] = useState("");
  const [movingKey, setMovingKey] = useState<string | null>(null);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return categories;
    return categories
      .map((category) => {
        const catMatch = category.label.toLowerCase().includes(q);
        const tags = catMatch
          ? category.tags
          : category.tags.filter((tag) =>
              tag.label.toLowerCase().includes(q),
            );
        if (!catMatch && tags.length === 0) return null;
        return { ...category, tags };
      })
      .filter((category): category is TaxonomyCategoryDto => category !== null);
  }, [categories, query]);

  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.details.length > 1
            ? err.details.join(" · ")
            : err.message
          : err instanceof Error
            ? err.message
            : t("somethingWentWrong"),
      );
    } finally {
      setBusy(false);
    }
  }

  function replaceCategory(slug: string, next: TaxonomyCategoryDto | null) {
    setCategories((prev) => {
      const index = prev.findIndex((category) => category.slug === slug);
      if (!next) return prev.filter((category) => category.slug !== slug);
      if (index < 0) return [...prev, next];
      const copy = [...prev];
      copy[index] = next;
      return copy;
    });
  }

  async function submitNewCategory() {
    const label = toDisplayLabel(newCategoryName);
    const first = toDisplayLabel(newCategoryTag);
    if (!slugify(label)) return;
    await run(async () => {
      const created = await createTaxonomyCategory({
        label,
        ...(slugify(first) ? { firstTag: { label: first } } : {}),
      });
      setCategories((prev) => {
        if (prev.some((category) => category.slug === created.slug)) {
          return prev.map((category) =>
            category.slug === created.slug ? created : category,
          );
        }
        return [...prev, created];
      });
      setAddingCategory(false);
      setNewCategoryName("");
      setNewCategoryTag("");
    });
  }

  async function saveCategory(slug: string) {
    const label = toDisplayLabel(categoryDraft);
    if (!slugify(label)) return;
    await run(async () => {
      const updated = await updateTaxonomyCategory(slug, label);
      replaceCategory(slug, updated);
      setEditingCategorySlug(null);
    });
  }

  async function removeCategory(category: TaxonomyCategoryDto) {
    const confirmed = window.confirm(
      t("deleteCategoryConfirm", {
        name: category.label,
        count: category.tags.length,
      }),
    );
    if (!confirmed) return;
    await run(async () => {
      await deleteTaxonomyCategory(category.slug);
      replaceCategory(category.slug, null);
      setEditingCategorySlug(null);
    });
  }

  async function addTag(categorySlug: string) {
    const label = toDisplayLabel(draftTag);
    if (!slugify(label)) return;
    await run(async () => {
      const result = await createTaxonomyTag(categorySlug, label);
      setCategories((prev) =>
        prev.map((category) =>
          category.slug === categorySlug
            ? {
                ...category,
                tags: category.tags.some((tag) => tag.slug === result.tag.slug)
                  ? category.tags
                  : [...category.tags, result.tag],
              }
            : category,
        ),
      );
      setDraftTag("");
      setAddingTagFor(null);
    });
  }

  async function saveTag(categorySlug: string, tag: TaxonomyTagDto) {
    const label = toDisplayLabel(tagDraft);
    if (!slugify(label)) return;
    await run(async () => {
      const result = await updateTaxonomyTag(categorySlug, tag.slug, {
        label,
      });
      applyTagMove(categorySlug, tag.slug, result.categorySlug, result.tag);
      setEditingKey(null);
    });
  }

  async function moveTag(
    categorySlug: string,
    tag: TaxonomyTagDto,
    destSlug: string,
  ) {
    if (!destSlug || destSlug === categorySlug) return;
    await run(async () => {
      const result = await updateTaxonomyTag(categorySlug, tag.slug, {
        categorySlug: destSlug,
      });
      applyTagMove(categorySlug, tag.slug, result.categorySlug, result.tag);
      setMovingKey(null);
    });
  }

  async function removeTag(categorySlug: string, tag: TaxonomyTagDto) {
    const confirmed = window.confirm(
      t("deleteTagConfirm", { name: tag.label, count: tag.count }),
    );
    if (!confirmed) return;
    await run(async () => {
      await deleteTaxonomyTag(categorySlug, tag.slug);
      setCategories((prev) =>
        prev.map((category) =>
          category.slug === categorySlug
            ? {
                ...category,
                tags: category.tags.filter((entry) => entry.slug !== tag.slug),
              }
            : category,
        ),
      );
    });
  }

  function applyTagMove(
    fromSlug: string,
    fromTagSlug: string,
    toSlug: string,
    tag: TaxonomyTagDto,
  ) {
    setCategories((prev) =>
      prev.map((category) => {
        if (category.slug === fromSlug && fromSlug !== toSlug) {
          return {
            ...category,
            tags: category.tags.filter((entry) => entry.slug !== fromTagSlug),
          };
        }
        if (category.slug === toSlug) {
          const without = category.tags.filter(
            (entry) => entry.slug !== tag.slug,
          );
          return { ...category, tags: [...without, tag] };
        }
        if (category.slug === fromSlug && fromSlug === toSlug) {
          return {
            ...category,
            tags: category.tags.map((entry) =>
              entry.slug === fromTagSlug ? tag : entry,
            ),
          };
        }
        return category;
      }),
    );
  }

  return (
    <main className="flex min-h-0 w-full flex-1 flex-col px-4 py-5 pb-24 sm:px-6 md:pb-7 lg:px-8 lg:py-7">
      <div className="mb-6 flex flex-wrap items-center justify-end gap-2.5">
        {searchOpen ? (
          <input
            id="manage-tags-search"
            type="search"
            value={query}
            autoFocus
            onChange={(e) => setQuery(e.target.value)}
            onBlur={() => {
              if (!query) setSearchOpen(false);
            }}
            placeholder={t("searchManageTags")}
            className="h-11 w-full max-w-xs rounded-full border border-border bg-surface px-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/25"
          />
        ) : (
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="inline-flex h-11 items-center gap-2 rounded-full border border-border bg-surface px-4 text-sm font-medium text-foreground shadow-sm transition-colors hover:border-border-strong hover:bg-accent-soft hover:text-primary"
          >
            <SearchIcon className="h-5 w-5" />
            {t("search")}
          </button>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={() => setAddingCategory(true)}
          className="inline-flex h-11 items-center gap-1.5 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary-hover disabled:opacity-50"
        >
          <PlusIcon className="h-5 w-5" />
          {t("addCategory")}
        </button>
      </div>

      {addingCategory ? (
        <div className="app-card mb-6 flex max-w-3xl flex-col gap-2.5 rounded-2xl border border-border p-3.5 sm:flex-row sm:items-center">
          <input
            value={newCategoryName}
            disabled={busy}
            autoFocus
            onChange={(e) => setNewCategoryName(e.target.value)}
            placeholder={t("categoryNamePlaceholder")}
            className="h-11 flex-1 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/25"
          />
          <input
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
            className="h-11 flex-1 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/25"
          />
          <button
            type="button"
            disabled={busy || !slugify(newCategoryName)}
            onClick={() => void submitNewCategory()}
            className="h-11 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-50"
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
            className="h-11 rounded-full border border-border bg-surface px-4 text-sm font-medium text-foreground hover:bg-surface-muted disabled:opacity-50"
          >
            {t("cancel")}
          </button>
        </div>
      ) : null}

      {error ? (
        <div className="mb-4">
          <StatusCallout title={error} compact />
        </div>
      ) : null}

      {visible.length === 0 ? (
        <EmptyBoard
          title={query ? t("noTagsMatch", { query }) : t("noTaxonomyYet")}
          mood={query ? "no-match" : "empty"}
        />
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 xl:grid-cols-3">
          {visible.map((category) => {
            const editingCat = editingCategorySlug === category.slug;
            const addingHere = addingTagFor === category.slug;
            return (
              <li
                key={category.slug}
                className="app-card min-w-0 rounded-2xl border border-border p-4 shadow-sm sm:p-5"
              >
                <div className="flex min-w-0 items-center gap-1.5 border-b border-border pb-3">
                  {editingCat ? (
                    <>
                      <input
                        value={categoryDraft}
                        disabled={busy}
                        autoFocus
                        onChange={(e) => setCategoryDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            void saveCategory(category.slug);
                          }
                          if (e.key === "Escape") setEditingCategorySlug(null);
                        }}
                        className="min-w-0 flex-1 rounded-xl border border-border bg-surface px-3 py-2 text-base font-semibold outline-none focus:border-primary focus:ring-2 focus:ring-ring/25"
                      />
                      <button
                        type="button"
                        disabled={busy || !slugify(categoryDraft)}
                        onClick={() => void saveCategory(category.slug)}
                        className="h-10 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
                      >
                        {t("save")}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setEditingCategorySlug(null)}
                        className="h-10 rounded-full border border-border bg-surface px-3 text-sm font-medium text-foreground hover:bg-surface-muted disabled:opacity-50"
                      >
                        {t("cancel")}
                      </button>
                    </>
                  ) : (
                    <>
                      <h2 className="min-w-0 truncate text-base font-semibold tracking-tight text-foreground">
                        {category.label}
                      </h2>
                      <div className="ml-auto flex shrink-0 items-center gap-1">
                        <IconButton
                          label={t("addTagButton")}
                          disabled={busy}
                          onClick={() => {
                            setAddingTagFor(category.slug);
                            setDraftTag("");
                            setEditingKey(null);
                            setMovingKey(null);
                            setEditingCategorySlug(null);
                          }}
                        >
                          <PlusIcon className="h-5 w-5" />
                        </IconButton>
                        <IconButton
                          label={t("editCategory")}
                          disabled={busy}
                          onClick={() => {
                            setEditingCategorySlug(category.slug);
                            setCategoryDraft(category.label);
                            setAddingTagFor(null);
                            setEditingKey(null);
                            setMovingKey(null);
                          }}
                        >
                          <PencilIcon className="h-5 w-5" />
                        </IconButton>
                        <IconButton
                          danger
                          label={t("deleteCategory")}
                          disabled={busy}
                          onClick={() => void removeCategory(category)}
                        >
                          <TrashIcon className="h-5 w-5" />
                        </IconButton>
                      </div>
                    </>
                  )}
                </div>

                <ul className="mt-4 flex flex-wrap gap-2">
                  {category.tags.map((tag) => {
                    const key = `${category.slug}:${tag.slug}`;
                    const editing = editingKey === key;
                    const moving = movingKey === key;
                    return (
                      <li key={key} className="relative min-w-0">
                        {editing ? (
                          <div className="flex items-center gap-1.5 rounded-full border border-primary bg-surface py-1 pr-1.5 pl-3.5">
                            <input
                              value={tagDraft}
                              disabled={busy}
                              autoFocus
                              onChange={(e) => setTagDraft(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  void saveTag(category.slug, tag);
                                }
                                if (e.key === "Escape") setEditingKey(null);
                              }}
                              className="w-28 bg-transparent text-sm outline-none sm:w-36"
                            />
                            <button
                              type="button"
                              disabled={busy || !slugify(tagDraft)}
                              onClick={() => void saveTag(category.slug, tag)}
                              className="h-8 rounded-full bg-primary px-3 text-xs font-medium text-primary-foreground disabled:opacity-50"
                            >
                              {t("save")}
                            </button>
                          </div>
                        ) : (
                          <div
                            className={[
                              "inline-flex items-center gap-0.5 rounded-full border bg-surface py-1 pr-1.5 pl-3.5 shadow-sm",
                              moving ? "border-primary" : "border-border",
                            ].join(" ")}
                          >
                            <span className="max-w-[11rem] truncate text-sm font-medium text-foreground">
                              {tag.label}
                            </span>
                            <IconButton
                              compact
                              label={t("editTag")}
                              disabled={busy}
                              onClick={() => {
                                setEditingKey(key);
                                setTagDraft(tag.label);
                                setMovingKey(null);
                              }}
                            >
                              <PencilIcon className="h-4 w-4" />
                            </IconButton>
                            <IconButton
                              compact
                              label={t("moveTag")}
                              disabled={busy || categories.length < 2}
                              onClick={() =>
                                setMovingKey(moving ? null : key)
                              }
                            >
                              <MoveIcon className="h-4 w-4" />
                            </IconButton>
                            <IconButton
                              compact
                              danger
                              label={t("deleteTag")}
                              disabled={busy}
                              onClick={() =>
                                void removeTag(category.slug, tag)
                              }
                            >
                              <TrashIcon className="h-4 w-4" />
                            </IconButton>
                          </div>
                        )}
                        {moving ? (
                          <div className="absolute top-[calc(100%+0.35rem)] left-0 z-20 min-w-[11rem] rounded-2xl border border-border bg-surface p-1.5 shadow-lg">
                            <p className="px-2 py-1 text-[10px] font-semibold tracking-wide text-foreground-subtle uppercase">
                              {t("moveTagTo")}
                            </p>
                            {categories
                              .filter((entry) => entry.slug !== category.slug)
                              .map((entry) => (
                                <button
                                  key={entry.slug}
                                  type="button"
                                  disabled={busy}
                                  onClick={() =>
                                    void moveTag(
                                      category.slug,
                                      tag,
                                      entry.slug,
                                    )
                                  }
                                  className="block w-full rounded-xl px-2.5 py-1.5 text-left text-sm text-foreground hover:bg-accent-soft hover:text-primary disabled:opacity-50"
                                >
                                  {entry.label}
                                </button>
                              ))}
                          </div>
                        ) : null}
                      </li>
                    );
                  })}

                  {addingHere ? (
                    <li>
                      <form
                        className="flex items-center gap-1.5 rounded-full border border-primary bg-surface py-1 pr-1.5 pl-3.5"
                        onSubmit={(e) => {
                          e.preventDefault();
                          void addTag(category.slug);
                        }}
                      >
                        <input
                          value={draftTag}
                          disabled={busy}
                          autoFocus
                          onChange={(e) => setDraftTag(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Escape") {
                              setAddingTagFor(null);
                              setDraftTag("");
                            }
                          }}
                          placeholder={t("newTagPlaceholder")}
                          className="w-32 bg-transparent text-sm outline-none sm:w-40"
                        />
                        <button
                          type="submit"
                          disabled={busy || !slugify(draftTag)}
                          className="h-8 rounded-full bg-primary px-3 text-xs font-medium text-primary-foreground disabled:opacity-50"
                        >
                          {t("addTagButton")}
                        </button>
                      </form>
                    </li>
                  ) : null}
                </ul>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  danger = false,
  compact = false,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  compact?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={[
        "inline-flex shrink-0 items-center justify-center rounded-full transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        compact ? "h-8 w-8" : "h-10 w-10",
        danger
          ? "bg-danger/10 text-danger hover:bg-danger hover:text-primary-foreground"
          : "bg-accent-soft text-primary hover:bg-primary hover:text-primary-foreground",
        "disabled:opacity-50",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.2-3.2" />
    </svg>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function PencilIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M15.2 4.8a2.1 2.1 0 0 1 3 3L8.5 17.5 4 19l1.5-4.5L15.2 4.8Z" />
      <path d="m13.7 6.3 3 3" />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 7h16" />
      <path d="M9 7V5h6v2" />
      <path d="M6 7l1 13h10l1-13" />
    </svg>
  );
}

function MoveIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M8 7h11l-3-3M19 7l-3 3" />
      <path d="M16 17H5l3 3M5 17l3-3" />
    </svg>
  );
}
