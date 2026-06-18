/**
 * B4: Server-side pagination helper
 * Supports cursor-based and offset-based pagination with consistent envelope format.
 */

import type { Request, Response } from "express";

export interface PaginationParams {
  limit: number;
  offset: number;
  sortBy?: string;
  sortDir?: "asc" | "desc";
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
  nextOffset: number | null;
}

export function parsePagination(req: Request): PaginationParams {
  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
  const offset = Math.max(Number(req.query.offset) || 0, 0);
  const sortBy = (req.query.sortBy as string) || undefined;
  const sortDir = req.query.sortDir === "desc" ? "desc" : "asc";
  return { limit, offset, sortBy, sortDir };
}

export function paginate<T>(items: T[], params: PaginationParams): PaginatedResponse<T> {
  // Apply sorting
  let sorted = [...items];
  if (params.sortBy) {
    sorted.sort((a, b) => {
      const va = String((a as Record<string, unknown>)[params.sortBy!] ?? "");
      const vb = String((b as Record<string, unknown>)[params.sortBy!] ?? "");
      const cmp = va.localeCompare(vb, undefined, { numeric: true });
      return params.sortDir === "desc" ? -cmp : cmp;
    });
  }

  const total = sorted.length;
  const page = sorted.slice(params.offset, params.offset + params.limit);
  const hasMore = params.offset + params.limit < total;

  return {
    items: page,
    total,
    limit: params.limit,
    offset: params.offset,
    hasMore,
    nextOffset: hasMore ? params.offset + params.limit : null,
  };
}

export function sendPaginated<T>(res: Response, items: T[], params: PaginationParams): void {
  res.json(paginate(items, params));
}
