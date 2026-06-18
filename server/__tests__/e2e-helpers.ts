const BASE = "http://localhost:3000";

let _serverAvailable: boolean | null = null;

export async function isServerAvailable(): Promise<boolean> {
  if (_serverAvailable !== null) return _serverAvailable;
  try {
    const resp = await fetch(`${BASE}/healthz`, { signal: AbortSignal.timeout(2000) });
    const json = await resp.json();
    _serverAvailable = json.database === "connected";
  } catch {
    _serverAvailable = false;
  }
  return _serverAvailable;
}

export { BASE };
