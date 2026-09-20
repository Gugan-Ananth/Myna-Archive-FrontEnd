"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  sampleArchiveSection,
  sampleOriginalCharacters,
} from "../lib/dice-sample";
import type {
  ArchiveCollectionView,
  CollectionView,
} from "../lib/collection-view";
import type { ArchiveItem, OriginalCharacter } from "../lib/types";

export type DiceSample =
  | {
      view: ArchiveCollectionView;
      requestedCount: number;
      items: ArchiveItem[];
    }
  | {
      view: "oc";
      requestedCount: number;
      items: OriginalCharacter[];
    };

type DiceSampleContextValue = {
  sample: DiceSample | null;
  loading: boolean;
  error: boolean;
  roll: (
    view: Exclude<CollectionView, "top-10">,
    count: number,
  ) => Promise<boolean>;
  clear: () => void;
};

const DiceSampleContext = createContext<DiceSampleContextValue | null>(null);

export function DiceSampleProvider({ children }: { children: ReactNode }) {
  const [sample, setSample] = useState<DiceSample | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const requestIdRef = useRef(0);

  const clear = useCallback(() => {
    requestIdRef.current += 1;
    setSample(null);
    setLoading(false);
    setError(false);
  }, []);

  const roll = useCallback(
    async (view: Exclude<CollectionView, "top-10">, count: number) => {
      const requestId = ++requestIdRef.current;
      setLoading(true);
      setError(false);
      try {
        if (view === "oc") {
          const items = await sampleOriginalCharacters(count);
          if (requestId !== requestIdRef.current) return false;
          setSample({ view: "oc", requestedCount: count, items });
        } else {
          const items = await sampleArchiveSection(view, count);
          if (requestId !== requestIdRef.current) return false;
          setSample({ view, requestedCount: count, items });
        }
        return true;
      } catch {
        if (requestId !== requestIdRef.current) return false;
        setSample(null);
        setError(true);
        return false;
      } finally {
        if (requestId === requestIdRef.current) setLoading(false);
      }
    },
    [],
  );

  const value = useMemo(
    () => ({ sample, loading, error, roll, clear }),
    [sample, loading, error, roll, clear],
  );

  return (
    <DiceSampleContext.Provider value={value}>
      {children}
    </DiceSampleContext.Provider>
  );
}

export function useDiceSample(): DiceSampleContextValue {
  const value = useContext(DiceSampleContext);
  if (!value) {
    throw new Error("useDiceSample must be used within DiceSampleProvider");
  }
  return value;
}

export function isArchiveDiceSample(
  sample: DiceSample | null,
  view: CollectionView,
): sample is Extract<DiceSample, { view: ArchiveCollectionView }> {
  return sample != null && sample.view !== "oc" && sample.view === view;
}

export function isOcDiceSample(
  sample: DiceSample | null,
  view: CollectionView,
): sample is Extract<DiceSample, { view: "oc" }> {
  return sample != null && sample.view === "oc" && view === "oc";
}
