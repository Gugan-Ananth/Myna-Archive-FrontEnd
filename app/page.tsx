import { HomeView } from "./components/home-view";
import { ApiError, getAllTags, listArchiveItems } from "./lib/api";

type HomeProps = {
  searchParams: Promise<{
    q?: string;
    tag?: string | string[];
    created?: string;
    video?: string;
  }>;
};

export default async function Home({ searchParams }: HomeProps) {
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q : "";
  const tags = normalizeTags(params.tag);

  let items: Awaited<ReturnType<typeof listArchiveItems>>["data"] = [];
  let availableTags: string[] = [];
  let total = 0;
  let loadError: string | null = null;
  let usedFallbackError = false;

  try {
    const [listResult, tagsResult] = await Promise.all([
      listArchiveItems({
        q: query || undefined,
        tag: tags.length > 0 ? tags : undefined,
        page: 1,
        pageSize: 40,
      }),
      getAllTags(),
    ]);
    items = listResult.data;
    total = listResult.meta.total;
    availableTags = tagsResult;
  } catch (error) {
    if (error instanceof ApiError) {
      loadError = error.message;
      usedFallbackError = false;
    } else {
      loadError = "fallback";
      usedFallbackError = true;
    }
  }

  return (
    <HomeView
      items={items}
      availableTags={availableTags}
      total={total}
      query={query}
      tags={tags}
      created={params.created === "1"}
      createdVideo={params.created === "1" && params.video === "1"}
      loadError={loadError}
      usedFallbackError={usedFallbackError}
    />
  );
}

function normalizeTags(tag: string | string[] | undefined): string[] {
  if (!tag) return [];
  return (Array.isArray(tag) ? tag : [tag]).filter(Boolean);
}
