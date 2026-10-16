import { afterEach, describe, expect, it, vi } from "vitest";
import {
  APPROVED_URL,
  metrics,
  runTest,
  validate,
  type TestConfig,
} from "./api";
const config: TestConfig = {
  url: APPROVED_URL,
  mode: "concurrent",
  requestCount: 20,
  concurrencyLevel: 5,
};
export const summary = {
  url: APPROVED_URL,
  totalRequests: 20,
  averageResponseTimeMs: 50,
  minResponseTimeMs: 10,
  maxResponseTimeMs: 100,
  successRate: 95,
  p50ResponseTimeMs: 40,
  p95ResponseTimeMs: 90,
  p99ResponseTimeMs: 100,
};
afterEach(() => vi.unstubAllGlobals());
describe("validation and metrics", () => {
  it("enforces the exact URL and integer limits", () => {
    expect(validate(config)).toBeUndefined();
    expect(validate({ ...config, url: "" })).toBeTruthy();
    expect(
      validate({ ...config, url: "http://localhost:8081/actuator/health" }),
    ).toBeUndefined();
    for (const requestCount of [0, 101, 1.5, NaN])
      expect(validate({ ...config, requestCount })).toBeTruthy();
    for (const concurrencyLevel of [0, 11, 1.5, NaN])
      expect(validate({ ...config, concurrencyLevel })).toBeTruthy();
    expect(
      validate({ ...config, requestCount: 100, concurrencyLevel: 10 }),
    ).toBeUndefined();
  });
  it("ignores controls unsupported by the selected mode", () => {
    expect(
      validate({
        ...config,
        mode: "single",
        requestCount: NaN,
        concurrencyLevel: NaN,
      }),
    ).toBeUndefined();
    expect(
      validate({ ...config, mode: "sequential", concurrencyLevel: NaN }),
    ).toBeUndefined();
  });
  it("maps a single failed attempt without inventing batch statistics", () => {
    expect(
      metrics({
        url: APPROVED_URL,
        responseTimeMs: 12,
        statusCode: 0,
        success: false,
      }),
    ).toEqual({ average: 12, min: 12, max: 12, success: 0, count: 1 });
  });
});
describe("backend adapter", () => {
  it.each(["single", "sequential", "concurrent"] as const)(
    "uses the %s contract",
    async (mode) => {
      const result =
        mode === "single"
          ? {
              url: APPROVED_URL,
              statusCode: 200,
              responseTimeMs: 10,
              success: true,
            }
          : mode === "sequential"
            ? summary
            : {
                ...summary,
                concurrencyLevel: 5,
                totalExecutionTimeMs: 200,
                throughputRequestsPerSecond: 100,
              };
      const fetchMock = vi
        .fn()
        .mockResolvedValue({ ok: true, json: async () => result });
      vi.stubGlobal("fetch", fetchMock);
      expect(await runTest({ ...config, mode })).toEqual(result);
      const url = new URL(fetchMock.mock.calls[0][0], "http://localhost");
      expect(url.pathname).toBe(
        `/api/performance/${{ single: "test", sequential: "analyze", concurrent: "concurrent" }[mode]}`,
      );
      expect(url.searchParams.get("url")).toBe(APPROVED_URL);
      expect(url.searchParams.get("requestCount")).toBe(
        mode === "single" ? null : "20",
      );
      expect(url.searchParams.get("concurrencyLevel")).toBe(
        mode === "concurrent" ? "5" : null,
      );
    },
  );
  it("surfaces problem details", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ detail: "Rejected target URL" }),
      }),
    );
    await expect(runTest(config)).rejects.toThrow("Rejected target URL");
  });
  it("handles unavailable networks and malformed responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("Failed to fetch")),
    );
    await expect(runTest(config)).rejects.toThrow("Cannot reach the API");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }),
    );
    await expect(runTest(config)).rejects.toThrow("unexpected response");
  });
  it("handles non-JSON server errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 502,
        json: async () => {
          throw new Error();
        },
      }),
    );
    await expect(runTest(config)).rejects.toThrow("HTTP 502");
  });
});

it("loads approved targets and rejects unavailable or malformed lists", async () => {
  const { loadTargets } = await import("./api");
  const targets = ["http://localhost:8081/actuator/health"];
  const fetchMock = vi
    .fn()
    .mockResolvedValue({ ok: true, json: async () => targets });
  vi.stubGlobal("fetch", fetchMock);
  expect(await loadTargets()).toEqual(targets);
  expect(fetchMock).toHaveBeenCalledWith("/api/performance/targets");
  fetchMock.mockResolvedValue({ ok: true, json: async () => [] });
  await expect(loadTargets()).rejects.toThrow("Cannot load approved targets");
  fetchMock.mockRejectedValue(new TypeError("offline"));
  await expect(loadTargets()).rejects.toThrow("Cannot load approved targets");
});
