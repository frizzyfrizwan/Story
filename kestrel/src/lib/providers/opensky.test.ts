import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { memoClear } from "./http";
import { bboxKey, createOpenSkyProvider, mapState } from "./opensky";
import { fixtureCarrierFromCallsign, headerOf, jsonResponse, mockFetch } from "./test-fixtures";

const STATE = ["a0b1c2", "UAL123  ", "United States", 1759849200, 1759849205, -73.9, 40.7, 10668.0, false, 245.3, 87.5, 0.65, null, 10900.2, "1234", false, 0];

describe("OpenSky state mapping", () => {
  it("maps the documented indices to LiveAircraft", () => {
    const a = mapState(STATE, fixtureCarrierFromCallsign);
    expect(a).toEqual({
      icao24: "a0b1c2",
      callsign: "UAL123",
      originCountry: "United States",
      lat: 40.7,
      lon: -73.9,
      altitudeM: 10668,
      velocityMs: 245.3,
      heading: 87.5,
      verticalRateMs: 0.65,
      onGround: false,
      lastContact: 1759849205,
      carrier: "UA",
    });
  });

  it("tolerates nulls and drops rows without a position", () => {
    const a = mapState(["abc", null, "Germany", null, 1, 8.5, 50.0, null, true, null, null, null, null, 120.5], fixtureCarrierFromCallsign);
    expect(a).toMatchObject({ callsign: null, altitudeM: 120.5, velocityMs: null, heading: null, onGround: true, carrier: undefined });
    expect(mapState(["abc", "X", "Y", null, null, null, 50.0], fixtureCarrierFromCallsign)).toBeNull();
    expect(mapState("nope", fixtureCarrierFromCallsign)).toBeNull();
  });
});

describe("OpenSky provider", () => {
  beforeEach(() => memoClear());
  afterEach(() => {
    vi.unstubAllGlobals();
    memoClear();
  });

  const bbox = { lamin: 40, lomin: -75, lamax: 42, lomax: -70 };

  it("queries the bbox anonymously and caches per bbox for 10 s", async () => {
    const { fn, calls } = mockFetch(() => jsonResponse({ time: 1759849200, states: [STATE, ["zz", "BAW1", "UK", null, 1, -74, 41, null, false, 200, 90, 0, null, 10000]] }));
    vi.stubGlobal("fetch", fn);
    const p = createOpenSkyProvider({ carrierFromCallsign: fixtureCarrierFromCallsign });
    expect(p.enabled).toBe(true);
    const first = await p.states(bbox);
    const again = await p.states({ ...bbox });
    expect(calls).toHaveLength(1);
    const url = new URL(calls[0].url);
    expect(url.origin + url.pathname).toBe("https://opensky-network.org/api/states/all");
    expect(url.searchParams.get("lamin")).toBe("40");
    expect(url.searchParams.get("lomax")).toBe("-70");
    expect(headerOf(calls[0].init, "Authorization")).toBeUndefined();
    expect(first.time).toBe(1759849200);
    expect(first.aircraft).toHaveLength(2);
    expect(first.aircraft[1].carrier).toBe("BA");
    expect(again).toBe(first);
    await p.states({ ...bbox, lamax: 45 });
    expect(calls).toHaveLength(2);
    expect(bboxKey(bbox)).toBe("40.00,-75.00,42.00,-70.00");
  });

  it("fetches an OAuth2 token with client credentials and sends it as Bearer", async () => {
    const { fn, calls } = mockFetch((url) => (url.includes("openid-connect/token") ? jsonResponse({ access_token: "tok-1", expires_in: 1800 }) : jsonResponse({ time: 1, states: [STATE] })));
    vi.stubGlobal("fetch", fn);
    const p = createOpenSkyProvider({ clientId: "id", clientSecret: "secret", carrierFromCallsign: fixtureCarrierFromCallsign });
    await p.states(bbox);
    expect(calls[0].url).toBe("https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token");
    expect(calls[0].init?.method).toBe("POST");
    expect(String(calls[0].init?.body)).toContain("grant_type=client_credentials");
    expect(String(calls[0].init?.body)).toContain("client_id=id");
    expect(headerOf(calls[1].init, "Authorization")).toBe("Bearer tok-1");
    memoClear();
    await p.states(bbox);
    expect(calls.filter((c) => c.url.includes("openid-connect"))).toHaveLength(1); // token reused
  });

  it("continues anonymously when the token endpoint fails", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { fn, calls } = mockFetch((url) => (url.includes("openid-connect/token") ? jsonResponse({ error: "invalid_client" }, 401) : jsonResponse({ time: 1, states: [STATE] })));
    vi.stubGlobal("fetch", fn);
    const p = createOpenSkyProvider({ clientId: "id", clientSecret: "bad" });
    const res = await p.states(bbox);
    expect(res.aircraft).toHaveLength(1);
    expect(headerOf(calls[1].init, "Authorization")).toBeUndefined();
    warn.mockRestore();
  });

  it("propagates HTTP failures so the registry can fall back", async () => {
    vi.stubGlobal("fetch", mockFetch(() => jsonResponse({}, 429, "Too Many Requests")).fn);
    const p = createOpenSkyProvider();
    await expect(p.states(bbox)).rejects.toMatchObject({ name: "ProviderError", status: 429 });
  });
});
