"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import {
  ApiError,
  createTaxonomyCategory,
  createTaxonomyTag,
  deleteTaxonomyCategory,
  deleteTaxonomyTag,
  reorderTaxonomy,
  updateTaxonomyCategory,
  updateTaxonomyTag,
} from "../lib/api";
import { useI18n } from "../lib/i18n";
import { slugify, toDisplayLabel } from "../lib/taxonomy";
import type { TaxonomyCategoryDto, TaxonomyTagDto } from "../lib/types";
import { EmptyBoard } from "./empty-board";
import { ConfirmDialog } from "./confirm-dialog";
import { StatusCallout } from "./status-callout";

type TagsManagerProps = {
  initialCategories: TaxonomyCategoryDto[];
};

type ConfirmationRequest = {
  message: string;
  confirm: () => Promise<void>;
};

/**
 * Outline of categories (1, 2, 3) with indented tags (a, b, c).
 * Tag chips keep inline edit / move / delete. Drag handles reorder.
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
  const [confirmation, setConfirmation] =
    useState<ConfirmationRequest | null>(null);
  const [addingTagFor, setAddingTagFor] = useState<string | null>(null);
  const [draftTag, setDraftTag] = useState("");
  const [editingCategorySlug, setEditingCategorySlug] = useState<string | null>(
    null,
  );
  const [categoryDraft, setCategoryDraft] = useState("");
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [tagDraft, setTagDraft] = useState("");
  const [movingKey, setMovingKey] = useState<string | null>(null);
  const dragRef = useRef<ActiveDrag | null>(null);
  const persistLock = useRef(false);
  const categoriesRef = useRef(categories);
  const [drag, setDrag] = useState<DragState | null>(null);

  useEffect(() => {
    categoriesRef.current = categories;
  }, [categories]);

  useEffect(() => {
    return () => {
      teardownLift(dragRef.current);
    };
  }, []);

  const searching = Boolean(query.trim());
  const canReorder = !busy && !searching;
  const showCategoryHandles = !searching && categories.length > 1;

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

  function removeCategory(category: TaxonomyCategoryDto) {
    setConfirmation({
      message: t("deleteCategoryConfirm", {
        name: category.label,
        count: category.tags.length,
      }),
      confirm: async () => {
        await run(async () => {
          await deleteTaxonomyCategory(category.slug);
          replaceCategory(category.slug, null);
          setEditingCategorySlug(null);
        });
      },
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

  function removeTag(categorySlug: string, tag: TaxonomyTagDto) {
    setConfirmation({
      message: t("deleteTagConfirm", { name: tag.label, count: tag.count }),
      confirm: async () => {
        await run(async () => {
          await deleteTaxonomyTag(categorySlug, tag.slug);
          setCategories((prev) =>
            prev.map((category) =>
              category.slug === categorySlug
                ? {
                    ...category,
                    tags: category.tags.filter(
                      (entry) => entry.slug !== tag.slug,
                    ),
                  }
                : category,
            ),
          );
        });
      },
    });
  }

  async function confirmPending() {
    if (!confirmation || busy) return;
    const request = confirmation;
    setConfirmation(null);
    await request.confirm();
  }

  function closestDropId(
    x: number,
    y: number,
    kind: DragKind,
    categorySlug: string | null,
  ): string | null {
    const selector =
      kind === "tag" && categorySlug
        ? `[data-drop-kind="tag"][data-drop-category="${CSS.escape(categorySlug)}"]`
        : `[data-drop-kind="category"]`;
    const nodes = document.querySelectorAll(selector);
    let bestId: string | null = null;
    let bestDist = Infinity;
    for (const node of nodes) {
      if (!(node instanceof HTMLElement)) continue;
      const rect = node.getBoundingClientRect();
      const dx = rect.left + rect.width / 2 - x;
      const dy = rect.top + rect.height / 2 - y;
      const dist = dx * dx + dy * dy;
      if (dist < bestDist) {
        bestDist = dist;
        bestId = node.dataset.dropId ?? null;
      }
    }
    return bestId;
  }

  function startDrag(
    event: PointerEvent<HTMLButtonElement>,
    kind: DragKind,
    id: string,
    categorySlug: string | null,
  ) {
    if (!canReorder || event.button !== 0) return;
    const source = event.currentTarget.closest("[data-drop-kind]");
    if (!(source instanceof HTMLElement)) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);

    const rect = source.getBoundingClientRect();
    const scale = kind === "category" ? 1.06 : 1.12;
    const clone = liftSource(source, rect, scale);
    const snapshot = categoriesRef.current;
    const next: ActiveDrag = {
      kind,
      categorySlug,
      id,
      overId: id,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originLeft: rect.left,
      originTop: rect.top,
      scale,
      snapshot,
      clone,
      moved: false,
      detachListeners: () => {},
    };

    const onMove = (pointer: globalThis.PointerEvent) => {
      if (pointer.pointerId !== next.pointerId) return;
      pointer.preventDefault();
      updateDragOver(pointer);
    };
    const onUp = (pointer: globalThis.PointerEvent) => {
      if (pointer.pointerId !== next.pointerId) return;
      finishDrag(pointer);
    };
    const onCancel = (pointer: globalThis.PointerEvent) => {
      if (pointer.pointerId !== next.pointerId) return;
      abortDrag();
    };
    const onEscape = (keyboard: globalThis.KeyboardEvent) => {
      if (keyboard.key !== "Escape") return;
      keyboard.preventDefault();
      abortDrag();
    };
    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    window.addEventListener("keydown", onEscape);
    next.detachListeners = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      window.removeEventListener("keydown", onEscape);
    };

    dragRef.current = next;
    setDrag({
      kind,
      categorySlug,
      id,
      overId: id,
      pointerId: event.pointerId,
    });
    lockPageForDrag();
  }

  function updateDragOver(event: {
    pointerId: number;
    clientX: number;
    clientY: number;
  }) {
    const current = dragRef.current;
    if (!current || event.pointerId !== current.pointerId) return;
    const dx = event.clientX - current.startX;
    const dy = event.clientY - current.startY;
    moveLiftedClone(current, dx, dy);
    const overId = closestDropId(
      event.clientX,
      event.clientY,
      current.kind,
      current.categorySlug,
    );
    if (!overId || overId === current.overId) return;
    current.overId = overId;
    setDrag({
      kind: current.kind,
      categorySlug: current.categorySlug,
      id: current.id,
      overId,
      pointerId: current.pointerId,
    });
  }

  function finishDrag(event: { pointerId: number }) {
    const current = dragRef.current;
    if (!current || event.pointerId !== current.pointerId) return;
    const overId = current.overId;
    dragRef.current = null;
    setDrag(null);
    teardownLift(current);
    if (!overId || overId === current.id) return;
    if (current.kind === "category") {
      void persistCategoryOrder(current.id, overId);
      return;
    }
    if (current.categorySlug) {
      void persistTagOrder(current.categorySlug, current.id, overId);
    }
  }

  function abortDrag() {
    const current = dragRef.current;
    if (!current) return;
    dragRef.current = null;
    setDrag(null);
    teardownLift(current);
  }

  async function persistCategoryList(
    next: TaxonomyCategoryDto[],
    previous: TaxonomyCategoryDto[],
  ) {
    if (sameCategoryOrder(next, previous) || persistLock.current) return;
    persistLock.current = true;
    setCategories(next);
    categoriesRef.current = next;
    try {
      await run(async () => {
        try {
          const saved = await reorderTaxonomy({
            categorySlugs: next.map((category) => category.slug),
          });
          categoriesRef.current = saved;
          setCategories(saved);
        } catch (err) {
          categoriesRef.current = previous;
          setCategories(previous);
          throw err;
        }
      });
    } finally {
      persistLock.current = false;
    }
  }

  async function persistTagList(
    categorySlug: string,
    next: TaxonomyCategoryDto[],
    previous: TaxonomyCategoryDto[],
  ) {
    const nextTags =
      next.find((category) => category.slug === categorySlug)?.tags ?? [];
    const previousTags =
      previous.find((category) => category.slug === categorySlug)?.tags ?? [];
    if (sameTagOrder(nextTags, previousTags) || persistLock.current) return;
    persistLock.current = true;
    setCategories(next);
    categoriesRef.current = next;
    try {
      await run(async () => {
        try {
          const saved = await reorderTaxonomy({
            tags: [
              {
                categorySlug,
                tagSlugs: nextTags.map((tag) => tag.slug),
              },
            ],
          });
          categoriesRef.current = saved;
          setCategories(saved);
        } catch (err) {
          categoriesRef.current = previous;
          setCategories(previous);
          throw err;
        }
      });
    } finally {
      persistLock.current = false;
    }
  }

  async function persistCategoryOrder(fromId: string, toId: string) {
    const previous = categoriesRef.current;
    const from = previous.findIndex((category) => category.slug === fromId);
    const to = previous.findIndex((category) => category.slug === toId);
    const next = moveItem(previous, from, to);
    await persistCategoryList(next, previous);
  }

  async function persistTagOrder(
    categorySlug: string,
    fromId: string,
    toId: string,
  ) {
    const previous = categoriesRef.current;
    const next = previous.map((entry) => {
      if (entry.slug !== categorySlug) return entry;
      const from = entry.tags.findIndex((tag) => tag.slug === fromId);
      const to = entry.tags.findIndex((tag) => tag.slug === toId);
      return { ...entry, tags: moveItem(entry.tags, from, to) };
    });
    await persistTagList(categorySlug, next, previous);
  }

  function nudgeCategory(slug: string, delta: number) {
    if (!canReorder) return;
    const from = categories.findIndex((category) => category.slug === slug);
    const target = categories[from + delta];
    if (!target) return;
    void persistCategoryOrder(slug, target.slug);
  }

  function nudgeTag(categorySlug: string, tagSlug: string, delta: number) {
    if (!canReorder) return;
    const category = categories.find((entry) => entry.slug === categorySlug);
    if (!category) return;
    const from = category.tags.findIndex((tag) => tag.slug === tagSlug);
    const target = category.tags[from + delta];
    if (!target) return;
    void persistTagOrder(categorySlug, tagSlug, target.slug);
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
        <ul
          className={[
            "grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 xl:grid-cols-3",
            drag ? "select-none" : "",
          ].join(" ")}
        >
          {visible.map((category) => {
            const editingCat = editingCategorySlug === category.slug;
            const addingHere = addingTagFor === category.slug;
            const categoryDragging =
              drag?.kind === "category" && drag.id === category.slug;
            const categoryDropTarget =
              drag?.kind === "category" &&
              drag.overId === category.slug &&
              drag.id !== category.slug;
            return (
              <li
                key={category.slug}
                data-drop-kind="category"
                data-drop-id={category.slug}
                className={[
                  "app-card min-w-0 rounded-2xl border p-4 shadow-sm sm:p-5",
                  "transition-[opacity,border-color,box-shadow] duration-200",
                  categoryDragging
                    ? "pointer-events-none border-dashed border-primary/50 opacity-25 shadow-none"
                    : categoryDropTarget
                      ? "border-primary ring-2 ring-ring/40"
                      : "border-border",
                ].join(" ")}
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
                      {showCategoryHandles ? (
                        <ReorderHandle
                          label={t("reorderCategory")}
                          disabled={busy}
                          dragging={categoryDragging}
                          onPointerDown={(event) =>
                            startDrag(event, "category", category.slug, null)
                          }
                          onKeyDown={(event) => {
                            if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
                              event.preventDefault();
                              nudgeCategory(category.slug, -1);
                            }
                            if (
                              event.key === "ArrowRight" ||
                              event.key === "ArrowDown"
                            ) {
                              event.preventDefault();
                              nudgeCategory(category.slug, 1);
                            }
                            if (event.key === "Escape" && drag) {
                              event.preventDefault();
                              abortDrag();
                            }
                          }}
                        />
                      ) : null}
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
                    const tagDragging =
                      drag?.kind === "tag" &&
                      drag.categorySlug === category.slug &&
                      drag.id === tag.slug;
                    const tagDropTarget =
                      drag?.kind === "tag" &&
                      drag.categorySlug === category.slug &&
                      drag.overId === tag.slug &&
                      drag.id !== tag.slug;
                    const showTagHandle =
                      !searching && category.tags.length > 1 && !editing;
                    return (
                      <li
                        key={key}
                        data-drop-kind="tag"
                        data-drop-category={category.slug}
                        data-drop-id={tag.slug}
                        className={[
                          "relative min-w-0",
                          tagDragging ? "pointer-events-none opacity-25" : "",
                        ].join(" ")}
                      >
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
                              "inline-flex items-center gap-0.5 rounded-full border bg-surface py-1 pr-1.5 shadow-sm",
                              showTagHandle ? "pl-1" : "pl-3.5",
                              moving || tagDragging || tagDropTarget
                                ? "border-primary"
                                : "border-border",
                              tagDragging ? "border-dashed shadow-none" : "",
                              tagDropTarget ? "ring-2 ring-ring/40" : "",
                            ].join(" ")}
                          >
                            {showTagHandle ? (
                              <ReorderHandle
                                compact
                                label={t("reorderTag")}
                                disabled={busy}
                                dragging={tagDragging}
                                onPointerDown={(event) =>
                                  startDrag(
                                    event,
                                    "tag",
                                    tag.slug,
                                    category.slug,
                                  )
                                }
                                onKeyDown={(event) => {
                                  if (
                                    event.key === "ArrowLeft" ||
                                    event.key === "ArrowUp"
                                  ) {
                                    event.preventDefault();
                                    nudgeTag(category.slug, tag.slug, -1);
                                  }
                                  if (
                                    event.key === "ArrowRight" ||
                                    event.key === "ArrowDown"
                                  ) {
                                    event.preventDefault();
                                    nudgeTag(category.slug, tag.slug, 1);
                                  }
                                  if (event.key === "Escape" && drag) {
                                    event.preventDefault();
                                    abortDrag();
                                  }
                                }}
                              />
                            ) : null}
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
      <ConfirmDialog
        open={confirmation !== null}
        message={confirmation?.message ?? ""}
        confirmLabel={t("delete")}
        busy={busy}
        onCancel={() => setConfirmation(null)}
        onConfirm={() => void confirmPending()}
      />
    </main>
  );
}

type DragKind = "category" | "tag";

type DragState = {
  kind: DragKind;
  categorySlug: string | null;
  id: string;
  overId: string | null;
  pointerId: number;
};

type ActiveDrag = DragState & {
  startX: number;
  startY: number;
  originLeft: number;
  originTop: number;
  scale: number;
  snapshot: TaxonomyCategoryDto[];
  clone: HTMLElement | null;
  moved: boolean;
  detachListeners: () => void;
};

const LIFT_PX = 8;

function sameCategoryOrder(
  left: TaxonomyCategoryDto[],
  right: TaxonomyCategoryDto[],
): boolean {
  if (left.length !== right.length) return false;
  return left.every((category, index) => category.slug === right[index]?.slug);
}

function sameTagOrder(left: TaxonomyTagDto[], right: TaxonomyTagDto[]): boolean {
  if (left.length !== right.length) return false;
  return left.every((tag, index) => tag.slug === right[index]?.slug);
}

function liftSource(
  source: HTMLElement,
  rect: DOMRect,
  scale: number,
): HTMLElement {
  const kind = source.dataset.dropKind;
  const clone = source.cloneNode(true) as HTMLElement;
  clone.removeAttribute("data-drop-kind");
  clone.removeAttribute("data-drop-id");
  clone.removeAttribute("data-drop-category");
  clone.setAttribute("aria-hidden", "true");
  clone.querySelectorAll("[id]").forEach((node) => node.removeAttribute("id"));
  clone.style.position = "fixed";
  clone.style.left = "0";
  clone.style.top = "0";
  clone.style.width = `${rect.width}px`;
  clone.style.height = `${rect.height}px`;
  clone.style.margin = "0";
  clone.style.listStyle = "none";
  clone.style.zIndex = "9999";
  clone.style.isolation = "isolate";
  clone.style.pointerEvents = "none";
  clone.style.cursor = "grabbing";
  clone.style.transformOrigin = "center center";
  clone.style.willChange = "transform";
  clone.style.opacity = "1";
  const shadow =
    "0 22px 48px -14px color-mix(in srgb, var(--foreground) 32%, transparent), 0 8px 18px -10px color-mix(in srgb, var(--primary) 45%, transparent)";
  if (kind === "category") {
    clone.style.borderStyle = "solid";
    clone.style.borderColor = "var(--primary)";
    clone.style.boxShadow = shadow;
  } else {
    const chip = clone.querySelector(":scope > div");
    if (chip instanceof HTMLElement) {
      chip.style.borderColor = "var(--primary)";
      chip.style.boxShadow = shadow;
    }
  }
  clone.style.transition =
    "transform 180ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 180ms ease";
  clone.style.transform = `translate3d(${rect.left}px, ${rect.top}px, 0) scale(1)`;
  document.body.appendChild(clone);
  void clone.offsetWidth;
  clone.style.transform = `translate3d(${rect.left}px, ${rect.top - LIFT_PX}px, 0) scale(${scale})`;
  return clone;
}

function moveLiftedClone(drag: ActiveDrag, dx: number, dy: number) {
  if (!drag.clone) return;
  if (!drag.moved) {
    drag.clone.style.transition = "none";
    drag.moved = true;
  }
  drag.clone.style.transform = `translate3d(${drag.originLeft + dx}px, ${drag.originTop + dy - LIFT_PX}px, 0) scale(${drag.scale})`;
}

function lockPageForDrag() {
  const { body } = document;
  body.style.cursor = "grabbing";
  body.style.userSelect = "none";
}

function unlockPageForDrag() {
  const { body } = document;
  body.style.cursor = "";
  body.style.userSelect = "";
}

function teardownLift(drag: ActiveDrag | null) {
  if (!drag) return;
  drag.detachListeners();
  drag.clone?.remove();
  drag.clone = null;
  unlockPageForDrag();
}

function moveItem<T>(items: T[], from: number, to: number): T[] {
  if (
    from === to ||
    from < 0 ||
    to < 0 ||
    from >= items.length ||
    to >= items.length
  ) {
    return items;
  }
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function ReorderHandle({
  label,
  dragging,
  disabled = false,
  compact = false,
  onPointerDown,
  onKeyDown,
}: {
  label: string;
  dragging: boolean;
  disabled?: boolean;
  compact?: boolean;
  onPointerDown: (event: PointerEvent<HTMLButtonElement>) => void;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-grabbed={dragging}
      disabled={disabled}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
      className={[
        "inline-flex shrink-0 touch-none select-none items-center justify-center rounded-full text-foreground-subtle",
        "hover:bg-accent-soft hover:text-primary",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        compact ? "h-8 w-8" : "h-10 w-8",
        dragging ? "cursor-grabbing" : "cursor-grab",
        "disabled:cursor-default disabled:opacity-50",
      ].join(" ")}
    >
      <GripIcon className={compact ? "h-4 w-4" : "h-5 w-5"} />
    </button>
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

function GripIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      className={className}
      fill="currentColor"
      aria-hidden
    >
      <circle cx="7" cy="5" r="1.35" />
      <circle cx="13" cy="5" r="1.35" />
      <circle cx="7" cy="10" r="1.35" />
      <circle cx="13" cy="10" r="1.35" />
      <circle cx="7" cy="15" r="1.35" />
      <circle cx="13" cy="15" r="1.35" />
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
