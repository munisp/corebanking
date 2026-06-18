// Package middleware provides reusable pagination utilities for 54Bank Go microservices.
//
// Usage:
//
//	page := middleware.ParsePagination(r, 25) // default pageSize=25
//	items := middleware.ApplyPagination(allItems, page)
//	middleware.WritePaginatedJSON(w, items, len(allItems), page)
package middleware

import (
	"encoding/json"
	"net/http"
	"strconv"
)

// Pagination holds parsed pagination parameters.
type Pagination struct {
	Page     int `json:"page"`
	PageSize int `json:"pageSize"`
	Offset   int `json:"offset"`
}

// PaginatedResponse is the standard paginated API response envelope.
type PaginatedResponse struct {
	Items      interface{} `json:"items"`
	Total      int         `json:"total"`
	Page       int         `json:"page"`
	PageSize   int         `json:"pageSize"`
	TotalPages int         `json:"totalPages"`
}

// ParsePagination extracts page and pageSize from query params with sane defaults.
func ParsePagination(r *http.Request, defaultPageSize int) Pagination {
	page := 1
	pageSize := defaultPageSize
	if pageSize <= 0 {
		pageSize = 25
	}

	if p := r.URL.Query().Get("page"); p != "" {
		if v, err := strconv.Atoi(p); err == nil && v > 0 {
			page = v
		}
	}
	if ps := r.URL.Query().Get("pageSize"); ps != "" {
		if v, err := strconv.Atoi(ps); err == nil && v > 0 && v <= 100 {
			pageSize = v
		}
	}

	offset := (page - 1) * pageSize
	return Pagination{Page: page, PageSize: pageSize, Offset: offset}
}

// ApplyPaginationSlice applies pagination to a generic slice by index range.
// Returns (start, end) indices safe for slicing.
func ApplyPaginationSlice(totalLen int, p Pagination) (int, int) {
	start := p.Offset
	if start > totalLen {
		start = totalLen
	}
	end := start + p.PageSize
	if end > totalLen {
		end = totalLen
	}
	return start, end
}

// WritePaginatedJSON writes a standard paginated JSON response.
func WritePaginatedJSON(w http.ResponseWriter, items interface{}, total int, p Pagination) {
	totalPages := total / p.PageSize
	if total%p.PageSize > 0 {
		totalPages++
	}
	resp := PaginatedResponse{
		Items:      items,
		Total:      total,
		Page:       p.Page,
		PageSize:   p.PageSize,
		TotalPages: totalPages,
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}
