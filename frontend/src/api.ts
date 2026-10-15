export const APPROVED_URL = "https://jsonplaceholder.typicode.com/posts";
export type Mode = "single" | "sequential" | "concurrent";
export const modeLabels: Record<Mode, string> = {
  single: "Single Request",
  sequential: "Sequential",
  concurrent: "Concurrent",
};
export interface TestConfig {
  url: string;
  mode: Mode;
  requestCount: number;
  concurrencyLevel: number;
}
export interface SingleResult {
  url: string;
  statusCode: number;
  responseTimeMs: number;
  success: boolean;
}
export interface Summary {
  url: string;
  totalRequests: number;
  averageResponseTimeMs: number;
  minResponseTimeMs: number;
  maxResponseTimeMs: number;
  successRate: number;
  p50ResponseTimeMs: number;
  p95ResponseTimeMs: number;
  p99ResponseTimeMs: number;
}
export interface ConcurrentSummary extends Summary {
  concurrencyLevel: number;
  totalExecutionTimeMs: number;
  throughputRequestsPerSecond: number;
}
export interface Run {
  id: number;
  completedAt: string;
  config: TestConfig;
  result: SingleResult | Summary | ConcurrentSummary;
}
export function validate(config: TestConfig): string | undefined {
  if (config.url !== APPROVED_URL)
    return "Use the exact approved target URL shown below.";
  if (
    config.mode !== "single" &&
    (!Number.isInteger(config.requestCount) ||
      config.requestCount < 1 ||
      config.requestCount > 100)
  )
    return "Number of requests must be a whole number between 1 and 100.";
  if (
    config.mode === "concurrent" &&
    (!Number.isInteger(config.concurrencyLevel) ||
      config.concurrencyLevel < 1 ||
      config.concurrencyLevel > 10)
  )
    return "Concurrency must be a whole number between 1 and 10.";
}
export async function runTest(config: TestConfig): Promise<Run["result"]> {
  const error = validate(config);
  if (error) throw new Error(error);
  const params = new URLSearchParams({ url: config.url });
  if (config.mode !== "single")
    params.set("requestCount", String(config.requestCount));
  if (config.mode === "concurrent")
    params.set("concurrencyLevel", String(config.concurrencyLevel));
  const endpoint = {
    single: "test",
    sequential: "analyze",
    concurrent: "concurrent",
  }[config.mode];
  let response: Response;
  try {
    response = await fetch(`/api/performance/${endpoint}?${params}`, {
      headers: { Accept: "application/json" },
    });
  } catch {
    throw new Error(
      "Cannot reach the API. Check your connection and that Spring Boot is running on port 8080, then retry.",
    );
  }
  const body = await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(
      body?.detail ||
        `The API returned HTTP ${response.status}. Please try again.`,
    );
  if (!isResult(body, config.mode))
    throw new Error(
      "The API returned an unexpected response. Check that the correct backend is running.",
    );
  return body;
}
function isResult(value: unknown, mode: Mode): value is Run["result"] {
  if (!value || typeof value !== "object") return false;
  const data = value as Record<string, unknown>;
  const fields =
    mode === "single"
      ? ["statusCode", "responseTimeMs"]
      : [
          "totalRequests",
          "averageResponseTimeMs",
          "minResponseTimeMs",
          "maxResponseTimeMs",
          "successRate",
          "p50ResponseTimeMs",
          "p95ResponseTimeMs",
          "p99ResponseTimeMs",
          ...(mode === "concurrent"
            ? [
                "concurrencyLevel",
                "totalExecutionTimeMs",
                "throughputRequestsPerSecond",
              ]
            : []),
        ];
  return (
    typeof data.url === "string" &&
    fields.every(
      (key) => typeof data[key] === "number" && Number.isFinite(data[key]),
    ) &&
    (mode !== "single" || typeof data.success === "boolean")
  );
}
export function metrics(result: Run["result"]) {
  if ("responseTimeMs" in result)
    return {
      average: result.responseTimeMs,
      min: result.responseTimeMs,
      max: result.responseTimeMs,
      success: result.success ? 100 : 0,
      count: 1,
    };
  return {
    average: result.averageResponseTimeMs,
    min: result.minResponseTimeMs,
    max: result.maxResponseTimeMs,
    success: result.successRate,
    count: result.totalRequests,
  };
}
