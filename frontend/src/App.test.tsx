import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import App from "./App";
import { APPROVED_URL } from "./api";
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
it("rejects alternate target URLs before contacting the API", async () => {
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  render(<App />);
  fireEvent.change(screen.getByLabelText(/Target URL/), {
    target: { value: "https://example.com" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Run Test" }));
  expect(screen.getByRole("alert")).toHaveTextContent("exact approved target");
  expect(fetchMock).not.toHaveBeenCalled();
});
it("renders supplied aggregate percentiles and concurrent-only metrics", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue({
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
