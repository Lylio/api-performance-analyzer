import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import App from "./App";
import { APPROVED_URL, loadTargets } from "./api";
vi.mock("./api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./api")>()),
  loadTargets: vi.fn(async () => [
    APPROVED_URL,
    "http://localhost:8081/actuator/health",
  ]),
}));
// Chart sizing belongs to the browser; keep interaction tests independent of SVG layout.
vi.mock("recharts", () => ({
  ResponsiveContainer: () => <div>Chart</div>,
  Bar: () => null,
  BarChart: () => null,
  CartesianGrid: () => null,
  Legend: () => null,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
}));
afterEach(() => vi.unstubAllGlobals());
const single = {
  url: APPROVED_URL,
  statusCode: 200,
  responseTimeMs: 25,
  success: true,
};
it("handles loading, completed history, selection and unavailable single metrics", async () => {
  let resolve!: (value: unknown) => void;
  const fetchMock = vi
    .fn()
    .mockReturnValueOnce(
      new Promise((r) => {
        resolve = r;
      }),
    )
    .mockResolvedValue({
      ok: true,
      json: async () => ({ ...single, responseTimeMs: 75 }),
    });
  vi.stubGlobal("fetch", fetchMock);
  render(<App />);
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Run Test" })).toBeEnabled(),
  );
  fireEvent.change(screen.getByLabelText("Test mode"), {
    target: { value: "single" },
  });
  expect(screen.getByLabelText("Requests")).toBeDisabled();
  expect(screen.getByLabelText("Concurrency")).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Run Test" }));
  expect(screen.getByRole("button", { name: "Running…" })).toBeDisabled();
  expect(screen.getByRole("status")).toHaveTextContent("Test in progress");
  resolve({ ok: true, json: async () => single });
  await screen.findByText("Request succeeded · HTTP 200");
  expect(screen.getByText("One request, one measurement")).toBeInTheDocument();
  expect(
    within(screen.getByText("Throughput").closest("article")!).getByText("—"),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Run Test" }));
  await screen.findByText("2 completed");
  fireEvent.click(screen.getByRole("button", { name: "View run" }));
  expect(
    within(screen.getByText("Average latency").closest("article")!).getByText(
      "25 ms",
    ),
  ).toBeInTheDocument();
  expect(screen.getAllByRole("row")).toHaveLength(3);
});
it("keeps completed results after a network failure and permits retry", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => single })
      .mockRejectedValue(new TypeError("offline")),
  );
  render(<App />);
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Run Test" })).toBeEnabled(),
  );
  fireEvent.change(screen.getByLabelText("Test mode"), {
    target: { value: "single" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Run Test" }));
  await screen.findByText("1 completed");
  fireEvent.click(screen.getByRole("button", { name: "Run Test" }));
  await waitFor(() =>
    expect(screen.getByRole("alert")).toHaveTextContent("Cannot reach the API"),
  );
  expect(screen.getByText("1 completed")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Run Test" })).toBeEnabled();
});
it("offers backend targets and sends the selected local URL", async () => {
  const local = "http://localhost:8081/actuator/health";
  const fetchMock = vi
    .fn()
    .mockResolvedValue({
      ok: true,
      json: async () => ({ ...single, url: local }),
    });
  vi.stubGlobal("fetch", fetchMock);
  render(<App />);
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Run Test" })).toBeEnabled(),
  );
  fireEvent.change(screen.getByLabelText(/Target URL/), {
    target: { value: local },
  });
  fireEvent.change(screen.getByLabelText("Test mode"), {
    target: { value: "single" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Run Test" }));
  await screen.findByText("1 completed");
  expect(
    new URL(fetchMock.mock.calls[0][0], "http://localhost").searchParams.get(
      "url",
    ),
  ).toBe(local);
});
it("disables tests when approved targets cannot load", async () => {
  vi.mocked(loadTargets).mockRejectedValueOnce(
    new Error("Cannot load approved targets"),
  );
  render(<App />);
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Cannot load approved targets",
  );
  expect(screen.getByRole("button", { name: "Run Test" })).toBeDisabled();
});
it("renders supplied aggregate percentiles and concurrent-only metrics", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        url: APPROVED_URL,
        totalRequests: 20,
        concurrencyLevel: 5,
        averageResponseTimeMs: 50,
        minResponseTimeMs: 10,
        maxResponseTimeMs: 100,
        successRate: 95,
        p50ResponseTimeMs: 40,
        p95ResponseTimeMs: 90,
        p99ResponseTimeMs: 100,
        totalExecutionTimeMs: 200,
        throughputRequestsPerSecond: 100,
      }),
    }),
  );
  render(<App />);
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Run Test" })).toBeEnabled(),
  );
  fireEvent.click(screen.getByRole("button", { name: "Run Test" }));
  await screen.findByText("1 completed");
  expect(screen.getByText("40 ms")).toBeInTheDocument();
  expect(screen.getByText("90 ms")).toBeInTheDocument();
  expect(screen.getByText("100 req/s")).toBeInTheDocument();
  expect(screen.getByText("200 ms")).toBeInTheDocument();
  expect(
    screen.getByText(/batch completed with failed requests/),
  ).toBeInTheDocument();
});
