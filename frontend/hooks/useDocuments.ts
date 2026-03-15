"use client";

import { useState, useCallback } from "react";
import { documentsApi } from "@/services/api";
import type { Document, KBStats, SearchResult } from "@/types";

interface UseDocumentsReturn {
  documents:    Document[];
  kbStats:      KBStats | null;
  searchResults:SearchResult[];
  isLoading:    boolean;
  isSearching:  boolean;
  loadKBData:   () => Promise<void>;
  search:       (query: string, k?: number) => Promise<void>;
  clearSearch:  () => void;
}

export function useDocuments(): UseDocumentsReturn {
  const [documents,     setDocuments]     = useState<Document[]>([]);
  const [kbStats,       setKbStats]       = useState<KBStats | null>(null);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isLoading,     setIsLoading]     = useState(false);
  const [isSearching,   setIsSearching]   = useState(false);

  const loadKBData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [docs, stats] = await Promise.all([
        documentsApi.list(),
        documentsApi.stats(),
      ]);
      setDocuments(docs.documents);
      setKbStats(stats);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const search = useCallback(async (query: string, k = 5) => {
    if (!query.trim()) return;
    setIsSearching(true);
    try {
      const res = await documentsApi.search(query, k);
      setSearchResults(res.results);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const clearSearch = useCallback(() => setSearchResults([]), []);

  return { documents, kbStats, searchResults, isLoading, isSearching, loadKBData, search, clearSearch };
}
