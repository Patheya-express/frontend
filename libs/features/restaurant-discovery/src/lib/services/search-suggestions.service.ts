import { Injectable, inject } from '@angular/core';
import {
  SearchService as GeneratedSearchService,
  type RecentSearchDto,
  type SearchSuggestionDto,
  type TrendingSearchDto,
} from '@patheya-express-frontend/api-sdk';

interface ApiEnvelope<T> {
  success: boolean;
  timestamp: string;
  data: T;
}

function unwrap<T>(response: T): T {
  return (response as unknown as ApiEnvelope<T>).data;
}

@Injectable({ providedIn: 'root' })
export class SearchSuggestionsService {
  private readonly searchService = inject(GeneratedSearchService);

  async getSuggestions(q: string): Promise<SearchSuggestionDto[]> {
    if (!q.trim()) {
      return [];
    }

    const response = await this.searchService.searchControllerGetSuggestions({ q, limit: 8 });
    return unwrap(response);
  }

  async getTrending(): Promise<TrendingSearchDto[]> {
    const response = await this.searchService.searchControllerGetTrending();
    return unwrap(response);
  }

  async getRecent(): Promise<RecentSearchDto[]> {
    const response = await this.searchService.searchControllerGetRecent();
    return unwrap(response);
  }

  async logSearch(query: string): Promise<void> {
    await this.searchService.searchControllerLogSearch({ body: { query } });
  }

  async recordRecent(query: string): Promise<void> {
    await this.searchService.searchControllerRecordRecent({ body: { query } });
  }

  async deleteRecent(id: string): Promise<void> {
    await this.searchService.searchControllerDeleteRecent({ id });
  }
}
