/**
 * External Data API helper for 54Bank platform.
 * Makes authenticated requests to external REST APIs.
 *
 * Configuration:
 *   DATA_API_BASE_URL — base URL of your data API gateway (optional)
 *   DATA_API_KEY      — API key for the data gateway (optional)
 */
export type DataApiCallOptions = {
  query?: Record<string, unknown>;
  body?: Record<string, unknown>;
  pathParams?: Record<string, unknown>;
  formData?: Record<string, unknown>;
};

export async function callDataApi(
  apiPath: string,
  options: DataApiCallOptions = {}
): Promise<unknown> {
  const baseUrl = process.env.DATA_API_BASE_URL;
  if (!baseUrl) {
    throw new Error(
      "DATA_API_BASE_URL is not configured. Set the DATA_API_BASE_URL environment variable."
    );
  }

  const apiKey = process.env.DATA_API_KEY ?? "";
  let url = `${baseUrl.replace(/\/$/, "")}/${apiPath.replace(/^\//, "")}`;

  // Apply path params
  if (options.pathParams) {
    for (const [key, value] of Object.entries(options.pathParams)) {
      url = url.replace(`{${key}}`, encodeURIComponent(String(value)));
    }
  }

  // Apply query params
  if (options.query) {
    const qs = new URLSearchParams(
      Object.entries(options.query)
        .filter(([, v]) => v !== undefined && v !== null)
        .map(([k, v]) => [k, String(v)])
    );
    url = `${url}?${qs.toString()}`;
  }

  const headers: Record<string, string> = { "content-type": "application/json" };
  if (apiKey) headers["x-api-key"] = apiKey;

  const response = await fetch(url, {
    method: options.body ? "POST" : "GET",
    headers,
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Data API call failed: ${response.status} ${response.statusText} — ${errorText}`);
  }

  return response.json();
}
