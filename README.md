# API Performance Analyzer

A Java 21 / Spring Boot application for measuring HTTP response latency through single requests, sequential batches, and bounded concurrent batches. Concurrent execution uses Java 21 virtual threads.

## Running locally

Requires JDK 21 and Maven (or the included Maven wrapper).

```sh
mvn spring-boot:run
```

The API listens on `http://localhost:8080` by default.

Production requests accept exactly `https://jsonplaceholder.typicode.com/posts`. Alternate hosts, paths, query strings, and trailing slashes are rejected. Redirects are never followed. Batches accept 1–100 requests and concurrent batches accept a concurrency level of 1–10. The concurrency cap applies separately to each analysis invocation.

## Endpoints

All endpoints use GET and are relative to `/api/performance`.

| Endpoint | Query parameters | Result |
| --- | --- | --- |
| `/test` | `url` | One HTTP request result |
| `/analyze` | `url`, `requestCount` | Sequential latency summary |
| `/concurrent` | `url`, `requestCount`, `concurrencyLevel` | Concurrent latency summary and throughput |

```sh
curl --get 'http://localhost:8080/api/performance/test' \
  --data-urlencode 'url=https://jsonplaceholder.typicode.com/posts'

curl --get 'http://localhost:8080/api/performance/analyze' \
  --data-urlencode 'url=https://jsonplaceholder.typicode.com/posts' \
  --data 'requestCount=10'

curl --get 'http://localhost:8080/api/performance/concurrent' \
  --data-urlencode 'url=https://jsonplaceholder.typicode.com/posts' \
  --data 'requestCount=20' --data 'concurrencyLevel=5'
```

A single result contains `url`, `statusCode`, `responseTimeMs`, and `success`. A sequential summary contains `url`, `totalRequests`, `averageResponseTimeMs`, `minResponseTimeMs`, `maxResponseTimeMs`, `successRate`, `p50ResponseTimeMs`, `p95ResponseTimeMs`, and `p99ResponseTimeMs`. Concurrent summaries retain all these fields and add `concurrencyLevel`, `totalExecutionTimeMs`, and `throughputRequestsPerSecond`.

HTTP 2xx responses are successful. Other HTTP statuses are preserved and counted as failures. Connection errors, timeouts, and other transport I/O failures produce `statusCode: 0` and `success: false`; the reason is logged on the server. A failed request does not abort its batch. Summaries include every attempt in latency statistics and success-rate calculations. Their existing schema exposes aggregate success rate rather than individual error details.

Invalid URL or range parameters return HTTP 400 with a Problem Detail response. Interrupted analyses return HTTP 503; unexpected concurrent execution failures return HTTP 500. Outstanding tasks are cancelled when concurrent collection fails or is interrupted.

## Architecture and measurements

- `PerformanceController` delegates REST requests through constructor injection.
- `PerformanceService` enforces the fixed URL allowlist and request limits, measures attempts, and calculates summaries.
- `HttpRequestExecutor` owns a reusable JDK HTTP client. It executes GET requests, discards response bodies, disables redirects, and sets a 10-second connection timeout and a 10-second request timeout. Spring closes the client on shutdown.
- Concurrent batches submit one virtual-thread task per request. A semaphore bounds active HTTP executions to the requested concurrency level and releases permits on all completion paths.
- `PercentileCalculator` retains the nearest-rank calculation: sort ascending and select `ceil(percentile / 100 × count) - 1`.
- `PerformanceExceptionHandler` maps validation and analysis exceptions to HTTP Problem Details.

Measurements use monotonic `System.nanoTime()`. Each attempt is timed immediately around transport execution, including failed attempts and body consumption, excluding semaphore waiting. Both sequential and concurrent latency statistics use these same attempt intervals. Millisecond values and arithmetic averages truncate fractional milliseconds, preserving the existing response format.

Concurrent total execution time covers task scheduling through executor completion. Throughput is attempted requests divided by this same wall-clock interval in seconds, using nanosecond precision before rounding. It includes failures and differs from the sum of individual request durations because requests overlap. These are application-observed timings, not isolated network or server processing times; connection reuse and JVM warm-up can affect results.

## Tests

```sh
mvn clean test
# Alternatively:
./mvnw clean test
```

The suite includes Spring context loading, existing percentile and validation tests, REST contract checks, and integration tests using the JDK's loopback HTTP server. A test-only transport maps the approved URL to the local server without changing production validation. No automated test sends an external HTTP request.

Concurrency tests synchronize the first wave of requests at the server to prove actual overlap and check peak activity against limits of 1, 3, and 10. Additional tests cover sequential execution, virtual-thread use, throughput interval consistency, non-2xx responses, refused connections, redirects, and rejected URLs and request counts.

The tool is intended for small controlled measurements. It has no global admission limit across simultaneous API callers, distributed load generation, retries, or per-request error lists in batch responses.

## Milestone 5: monitoring dashboard

The `frontend/` application uses React, TypeScript, Vite and Recharts with a responsive dark interface and lightweight custom CSS. Requires Node.js 22.12+ (or Node.js 24 LTS) and npm. Run both applications in separate terminals:

```sh
# Terminal 1, from the repository root (JDK 21)
mvn spring-boot:run

# Terminal 2, from the repository root
cd frontend
npm ci
npm run dev
```

Open the local URL printed by Vite (normally `http://localhost:5173`). Vite forwards `/api` to Spring Boot at `http://localhost:8080`; no CORS changes are needed. Keep the backend running while using the dashboard.

Select Single Request, Sequential or Concurrent, configure the enabled controls, and click **Run Test**. The target defaults to the exact approved URL above; frontend and backend both enforce the URL and applicable integer limits. The dashboard displays loading feedback, HTTP/transport failures, API Problem Details and network errors. A completed batch with failed attempts remains a completed result with its aggregate success rate.

Metric cards reflect the selected history entry. Single requests use their observed latency for average/minimum/maximum and their success flag for success rate; their HTTP status is also displayed. P50/P95/P99 are available only for batches. Throughput and execution time are available only for concurrent tests; unavailable values display `—`. Charts use supplied aggregate statistics, never synthetic per-request samples or timing estimates. The comparison chart shows the latest ten runs; all completed runs remain selectable in the session history. Compare similar request counts and modes for meaningful conclusions. History is in React memory and resets on refresh; no database or browser persistence is used.

```sh
# Frontend checks, from frontend/
npm test
npm run build

# Backend checks, from the repository root
mvn clean test
```

Frontend tests cover endpoint/query contracts, validation, failure handling, loading feedback and history selection. Backend tests continue to use local fixtures. The frontend build writes static assets to `frontend/dist/`. `npm run preview` serves those built assets locally and forwards `/api` to the backend on port 8080. Production hosting must route `/api` to the backend on the same origin. This milestone adds no deployment infrastructure.

Tests are on demand, with no streaming progress, polling or automatic retries. A sequential batch can take several minutes if attempts time out. Controls stay locked until the API completes; the dashboard does not offer cancellation because stopping a browser request would not guarantee cancellation of backend work. Batch DTOs do not expose individual request errors or samples. Google Fonts are optional; system fonts provide a fallback when offline.
