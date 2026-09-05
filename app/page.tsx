import { HomeView } from "./components/home-view";
import {
  ApiError,
  listArchiveItems,
  listOriginalCharacters,
  listTagSummaries,
  listTaxonomy,
} from "./lib/api";
import { sessionAuth } from "./lib/auth/session";
import {
  listParamsForView,
  parseCollectionView,
} from "./lib/collection-view";
import type {
  OriginalCharacter,
  TagSummary,
  TaxonomyCategoryDto,
} from "./lib/types";
import { loadTopTen, type TopTenData } from "./lib/top-ten";

type HomeProps = {
  searchParams: Promise<{
    q?: string;
    tag?: string | string[];
    view?: string | string[];
    group?: string;
    created?: string;
    video?: string;
  }>;
};

export default async function Home({ searchParams }: HomeProps) {
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q : "";
  const tags = normalizeTags(params.tag);
  const view = parseCollectionView(params.view);
  const auth = await sessionAuth();

  let items: Awaited<ReturnType<typeof listArchiveItems>>["data"] = [];
  let tagSummaries: TagSummary[] = [];
  let taxonomy: TaxonomyCategoryDto[] = [];
  let total = 0;
  let ocs: OriginalCharacter[] = [];
  let ocsTotal = 0;
  let topTen: TopTenData | undefined;
  let loadError: string | null = null;
  let usedFallbackError = false;

  try {
    if (view === "top-10") {
      topTen = await loadTopTen(query, auth);
    } else if (view === "oc") {
      const listResult = await listOriginalCharacters(
        {
          q: query || undefined,
          page: 1,
          pageSize: 40,
        },
        auth,
      );
      ocs = listResult.data;
      ocsTotal = listResult.meta.total;
    } else {
      const section = listParamsForView(view);
      // Parallel SSR: list + flat tags + taxonomy tree, scoped to the section.
      const [listResult, tagsResult, taxonomyResult] = await Promise.all([
        listArchiveItems(
          {
            q: query || undefined,
            tag: tags.length > 0 ? tags : undefined,
            ...section,
            page: 1,
            pageSize: 40,
          },
          auth,
        ),
        listTagSummaries(
          {
            mediaType: section.mediaType,
            section: section.section,
            imageGroup: section.imageGroup,
          },
          auth,
        ),
        listTaxonomy(auth),
      ]);
      items = listResult.data;
      total = listResult.meta.total;
      tagSummaries = tagsResult;
      taxonomy = taxonomyResult;
    }
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
      tagSummaries={tagSummaries}
      taxonomy={taxonomy}
      total={total}
      query={query}
      tags={tags}
      view={view}
      created={params.created === "1"}
      createdVideo={
        params.created === "1" &&
        (params.video === "1" || view === "videos")
      }
      loadError={loadError}
      usedFallbackError={usedFallbackError}
      ocs={ocs}
      ocsTotal={ocsTotal}
      topTen={topTen}
    />
  );
}

function normalizeTags(tag: string | string[] | undefined): string[] {
  if (!tag) return [];
  return (Array.isArray(tag) ? tag : [tag]).filter(Boolean);
}
