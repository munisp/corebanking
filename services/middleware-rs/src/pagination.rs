/// Reusable pagination utilities for 54Bank Rust microservices.
///
/// # Usage
/// ```rust
/// use middleware_rs::pagination::{PaginationParams, paginate_slice};
///
/// let params = PaginationParams::from_query("page=2&pageSize=10");
/// let (items, total_pages) = paginate_slice(&all_items, &params);
/// ```

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Deserialize)]
pub struct PaginationParams {
    #[serde(default = "default_page")]
    pub page: usize,
    #[serde(default = "default_page_size", rename = "pageSize")]
    pub page_size: usize,
}

fn default_page() -> usize { 1 }
fn default_page_size() -> usize { 25 }

impl PaginationParams {
    pub fn from_query(query: &str) -> Self {
        let mut page = 1usize;
        let mut page_size = 25usize;
        for pair in query.split('&') {
            let mut kv = pair.splitn(2, '=');
            if let (Some(k), Some(v)) = (kv.next(), kv.next()) {
                match k {
                    "page" => { if let Ok(p) = v.parse::<usize>() { if p > 0 { page = p; } } },
                    "pageSize" => { if let Ok(ps) = v.parse::<usize>() { if ps > 0 && ps <= 100 { page_size = ps; } } },
                    _ => {}
                }
            }
        }
        Self { page, page_size }
    }

    pub fn offset(&self) -> usize {
        (self.page - 1) * self.page_size
    }

    pub fn total_pages(&self, total: usize) -> usize {
        if total == 0 { return 0; }
        (total + self.page_size - 1) / self.page_size
    }
}

/// Paginate a slice, returning the sub-slice and total pages.
pub fn paginate_slice<'a, T>(items: &'a [T], params: &PaginationParams) -> (&'a [T], usize) {
    let total = items.len();
    let start = params.offset().min(total);
    let end = (start + params.page_size).min(total);
    let total_pages = params.total_pages(total);
    (&items[start..end], total_pages)
}

#[derive(Serialize)]
pub struct PaginatedResponse<'a, T: Serialize> {
    pub items: &'a [T],
    pub total: usize,
    pub page: usize,
    #[serde(rename = "pageSize")]
    pub page_size: usize,
    #[serde(rename = "totalPages")]
    pub total_pages: usize,
}
