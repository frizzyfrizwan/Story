import type { LiveAircraft } from "@/lib/types";
import { carrierFromCallsign } from "@/data/airlines";
import { asArray, asBoolean, asNumber, asString, buildUrl, fetchJson, memo, pick } from "./http";
import { ProviderError, type BoundingBox, type LiveFlightsProvider } from "./types";

/**
 * OpenSky Network — live ADS-B state vectors.
 *
 *   GET https://opensky-network.org/api/states/all?lamin&lomin&lamax&lomax
 *
 * Anonymous access works (10 s resolution, ~400 req/day). With
 * OPENSKY_CLIENT_ID/SECRET we fetch an OAuth2 client-credentials token from
 * the OpenSky Keycloak realm and send it as a Bearer token (4 000 req/day).
 *
 * The provider is always `enabled`; the registry falls back to the simulator
 * when a request fails or returns nothing.
 */

export const OPENSKY_ID = "opensky";
export const OPENSKY_BASE = "https://opensky-network.org/api";
export const OPENSKY_TOKEN_URL = "https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token";

/** Indices into an OpenSky state vector (https://openskynetwork.github.io/opensky-api/rest.html#all-state-vectors). */
export const STATE_INDEX = {
  icao24: 0,
  callsign: 1,
  originCountry: 2,
  timePosition: 3,
  lastContact: 4,
  longitude: 5,
  latitude: 6,
  baroAltitude: 7,
  onGround: 8,
  velocity: 9,
  trueTrack: 10,
  verticalRate: 11,
  sensors: 12,
  geoAltitude: 13,
} as const;

const STATES_TTL_MS = 10_000;

export interface OpenSkyDeps {
  clientId?: string;
  clientSecret?: string;
  baseUrl?: string;
  tokenUrl?: string;
  now?: () => number;
  timeoutMs?: number;
  carrierFromCallsign?: (callsign: string | null | undefined) => string | undefined;
}

/** Map one raw state vector to `LiveAircraft`; null when the position is missing. */
export function mapState(raw: unknown, resolveCarrier: (cs: string | null | undefined) => string | undefined = carrierFromCallsign): LiveAircraft | null {
  if (!Array.isArray(raw)) return null;
  const icao24 = asString(raw[STATE_INDEX.icao24]);
  const lon = asNumber(raw[STATE_INDEX.longitude]);
  const lat = asNumber(raw[STATE_INDEX.latitude]);
  if (!icao24 || lon === undefined || lat === undefined) return null;
  const callsignRaw = asString(raw[STATE_INDEX.callsign])?.trim();
  const callsign = callsignRaw ? callsignRaw.toUpperCase() : null;
  const baro = asNumber(raw[STATE_INDEX.baroAltitude]);
  const geo = asNumber(raw[STATE_INDEX.geoAltitude]);
  return {
    icao24: icao24.toLowerCase(),
    callsign,
    originCountry: asString(raw[STATE_INDEX.originCountry]) ?? "Unknown",
    lat,
    lon,
    altitudeM: baro ?? geo ?? null,
    velocityMs: asNumber(raw[STATE_INDEX.velocity]) ?? null,
    heading: asNumber(raw[STATE_INDEX.trueTrack]) ?? null,
    verticalRateMs: asNumber(raw[STATE_INDEX.verticalRate]) ?? null,
    onGround: asBoolean(raw[STATE_INDEX.onGround]) ?? false,
    lastContact: asNumber(raw[STATE_INDEX.lastContact]) ?? asNumber(raw[STATE_INDEX.timePosition]) ?? 0,
    carrier: resolveCarrier(callsign),
  };
}

export function bboxKey(b: BoundingBox): string {
  const r = (n: number) => n.toFixed(2);
  return `${r(b.lamin)},${r(b.lomin)},${r(b.lamax)},${r(b.lomax)}`;
}

export function createOpenSkyProvider(deps: OpenSkyDeps = {}): LiveFlightsProvider {
  const base = deps.baseUrl ?? OPENSKY_BASE;
  const tokenUrl = deps.tokenUrl ?? OPENSKY_TOKEN_URL;
  const now = deps.now ?? (() => Date.now());
  const timeoutMs = deps.timeoutMs ?? 8_000;
  const resolveCarrier = deps.carrierFromCallsign ?? carrierFromCallsign;
  const hasAuth = Boolean(deps.clientId && deps.clientSecret);

  let token: { value: string; expiresAt: number } | null = null;
  let tokenPending: Promise<string | null> | null = null;
  let warnedAuth = false;

  /** Client-credentials token; null when auth is unconfigured or the token endpoint fails (fall back to anonymous). */
  async function getToken(signal?: AbortSignal): Promise<string | null> {
    if (!hasAuth) return null;
    if (token && token.expiresAt > now() + 30_000) return token.value;
    if (tokenPending) return tokenPending;
    tokenPending = (async () => {
      try {
        const body = new URLSearchParams({
          grant_type: "client_credentials",
          client_id: deps.clientId ?? "",
          client_secret: deps.clientSecret ?? "",
        }).toString();
        const payload = await fetchJson(
          tokenUrl,
          { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body, signal },
          { providerId: OPENSKY_ID, timeoutMs },
        );
        const access = asString(pick(payload, "access_token"));
        if (!access) throw new ProviderError(OPENSKY_ID, "token response missing access_token");
        const expiresIn = asNumber(pick(payload, "expires_in")) ?? 1_800;
        token = { value: access, expiresAt: now() + expiresIn * 1000 };
        return access;
      } catch (e) {
        if (!warnedAuth) {
          warnedAuth = true;
          console.warn("[opensky] token request failed, continuing anonymously:", e instanceof Error ? e.message : e);
        }
        return null;
      } finally {
        tokenPending = null;
      }
    })();
    return tokenPending;
  }

  return {
    id: OPENSKY_ID,
    label: hasAuth ? "OpenSky Network (authenticated)" : "OpenSky Network (anonymous)",
    source: "live",
    enabled: true,
    requires: hasAuth ? undefined : "Optional OPENSKY_CLIENT_ID + OPENSKY_CLIENT_SECRET for higher rate limits",

    async states(bbox, signal) {
      const key = `opensky:states:${bboxKey(bbox)}`;
      return memo(key, STATES_TTL_MS, async () => {
        const bearer = await getToken(signal);
        const url = buildUrl(base, "/states/all", { lamin: bbox.lamin, lomin: bbox.lomin, lamax: bbox.lamax, lomax: bbox.lomax });
        const payload = await fetchJson(
          url,
          { headers: { Accept: "application/json", ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}) }, signal },
          { providerId: OPENSKY_ID, timeoutMs },
        );
        const time = asNumber(pick(payload, "time")) ?? Math.floor(now() / 1000);
        const aircraft = asArray(pick(payload, "states"))
          .map((s) => mapState(s, resolveCarrier))
          .filter((a): a is LiveAircraft => a !== null);
        return { aircraft, time };
      });
    },
  };
}
