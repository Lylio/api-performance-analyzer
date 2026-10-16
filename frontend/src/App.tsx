import { useEffect, useRef, useState } from "react";
import {
  Activity,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Clock3,
  Gauge,
  Layers,
  Play,
  Radio,
  Server,
  Zap,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  loadTargets,
  metrics,
  modeLabels,
  runTest,
  validate,
  type Mode,
  type Run,
  type TestConfig,
} from "./api";

const number = (value: number) =>
  new Intl.NumberFormat("en", { maximumFractionDigits: 2 }).format(value);
const ms = (value: number) => `${number(value)} ms`;
const colors = ["#6ee7cb", "#818cf8", "#f5b86b"];
function MetricCard({
  title,
  value,
  detail,
  icon: Icon,
}: {
  title: string;
  value: string;
  detail: string;
  icon: typeof Activity;
}) {
  return (
    <article className="metric">
      <div className="metric-title">
        {title}
        <Icon size={17} />
      </div>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}
function PercentileChart({ run }: { run: Run }) {
  if (!("p50ResponseTimeMs" in run.result))
    return (
      <div className="empty-chart">
        <Activity />
        <strong>One request, one measurement</strong>
        <span>
          Run a sequential or concurrent batch to see backend percentile
          statistics.
        </span>
      </div>
    );
  const data = [
    { name: "P50", latency: run.result.p50ResponseTimeMs },
    { name: "P95", latency: run.result.p95ResponseTimeMs },
    { name: "P99", latency: run.result.p99ResponseTimeMs },
  ];
  return (
    <>
      <div className="percentiles">
        {data.map((d) => (
          <div key={d.name}>
            <small>{d.name}</small>
            <strong>{ms(d.latency)}</strong>
          </div>
        ))}
      </div>
      <div
        className="chart"
        role="img"
        aria-label={data
          .map((d) => `${d.name}: ${d.latency} milliseconds`)
          .join(", ")}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barSize={48} margin={{ left: 0, right: 15 }}>
            <CartesianGrid stroke="#253042" vertical={false} />
            <XAxis dataKey="name" />
            <YAxis unit=" ms" width={65} />
            <Tooltip
              contentStyle={{
                background: "#151e2d",
                border: "1px solid #354156",
                borderRadius: 8,
              }}
              formatter={(v) => [ms(Number(v)), "Latency"]}
            />
            <Bar dataKey="latency" fill={colors[0]} radius={[5, 5, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}
export default function App() {
  const [config, setConfig] = useState<TestConfig>({
    url: "",
    mode: "concurrent",
    requestCount: 20,
    concurrencyLevel: 5,
  });
  const [targets, setTargets] = useState<string[]>([]);
  useEffect(() => {
    let active = true;
    loadTargets()
      .then((urls) => {
        if (active) {
          setTargets(urls);
          setConfig((previous) => ({ ...previous, url: urls[0] }));
        }
      })
      .catch((cause) => {
        if (active) setError(cause.message);
      });
    return () => {
      active = false;
    };
  }, []);
  const [runs, setRuns] = useState<Run[]>([]);
  const [selected, setSelected] = useState<number>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const running = useRef(false);
  const nextId = useRef(1);
  const current = runs.find((run) => run.id === selected) ?? runs.at(-1);
  const stats = current ? metrics(current.result) : undefined;
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (running.current) return;
    const invalid = validate(config);
    if (invalid) {
      setError(invalid);
      return;
    }
    running.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await runTest(config);
      const run: Run = {
        id: nextId.current++,
        completedAt: new Date().toISOString(),
        config: { ...config },
        result,
      };
      setRuns((previous) => [...previous, run]);
      setSelected(run.id);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The test could not be completed. Please retry.",
      );
    } finally {
      running.current = false;
      setBusy(false);
    }
  }
  const comparison = runs.slice(-10).map((run, index) => ({
    name: `#${runs.length - Math.min(runs.length, 10) + index + 1}`,
    Average: metrics(run.result).average,
    P95:
      "p95ResponseTimeMs" in run.result
        ? run.result.p95ResponseTimeMs
        : undefined,
    P99:
      "p99ResponseTimeMs" in run.result
        ? run.result.p99ResponseTimeMs
        : undefined,
  }));
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#">
          <span>
            <Activity size={23} />
          </span>
          pulse<span className="brand-dot">.</span>
        </a>
        <div className="workspace-label">WORKSPACE</div>
        <a className="nav-item active" href="#dashboard">
          <Gauge size={18} />
          Overview
        </a>
        <a className="nav-item" href="#history">
          <Layers size={18} />
          Test history <span className="nav-count">{runs.length}</span>
        </a>
        <div className="sidebar-bottom">
          <Server size={18} />
          <div>
            API Performance Analyzer<small>Java 21 · Virtual threads</small>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <span>
            Workspace <span className="slash">/</span>{" "}
            <b>Performance monitoring</b>
          </span>
          <span className="environment">
            <i /> Local environment
          </span>
        </header>
        <main id="dashboard">
          <div className="page-heading">
            <div>
              <div className="eyebrow">OBSERVE. MEASURE. IMPROVE.</div>
              <h1>Performance overview</h1>
              <p>Understand your API’s latency, reliability and throughput.</p>
            </div>
            <span className="badge">
              <Radio size={14} /> On-demand testing
            </span>
          </div>
          <section className="panel configuration">
            <div className="section-heading">
              <div>
                <h2>
                  <Zap size={18} /> Configure a test
                </h2>
                <p>
                  A controlled benchmark against your approved API endpoint.
                </p>
              </div>
              <span className="step-label">01 / CONFIGURE</span>
            </div>
            <form onSubmit={submit}>
              <fieldset disabled={busy || !targets.length}>
                <div className="config-grid">
                  <label className="url-field">
                    Target URL
                    <select
                      required
                      value={config.url}
                      onChange={(e) =>
                        setConfig({ ...config, url: e.target.value })
                      }
                    >
                      {!targets.length && (
                        <option value="">Loading approved targets…</option>
                      )}
                      {targets.map((url) => (
                        <option key={url} value={url}>
                          {url}
                        </option>
                      ))}
                    </select>
                    <span className="field-help">
                      Approved target only · GET request
                    </span>
                  </label>
                  <label>
                    Test mode
                    <select
                      value={config.mode}
                      onChange={(e) =>
                        setConfig({ ...config, mode: e.target.value as Mode })
                      }
                    >
                      {Object.entries(modeLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Requests
                    <input
                      type="number"
                      min="1"
                      max="100"
                      step="1"
                      required
                      disabled={config.mode === "single"}
                      value={config.mode === "single" ? 1 : config.requestCount}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          requestCount: e.target.valueAsNumber,
                        })
                      }
                    />
                  </label>
                  <label>
                    Concurrency
                    <input
                      type="number"
                      min="1"
                      max="10"
                      step="1"
                      required
                      disabled={config.mode !== "concurrent"}
                      value={
                        config.mode === "concurrent"
                          ? config.concurrencyLevel
                          : 1
                      }
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          concurrencyLevel: e.target.valueAsNumber,
                        })
                      }
                    />
                  </label>
                  <button className="run-button" type="submit">
                    {busy ? (
                      <span className="spinner" />
                    ) : (
                      <Play size={16} fill="currentColor" />
                    )}
                    {busy ? "Running…" : "Run Test"}
                  </button>
                </div>
              </fieldset>
            </form>
            <div className="config-footer">
              <span>
                <span className="status-dot" />{" "}
                {config.mode === "concurrent"
                  ? "Bounded concurrency with Java virtual threads"
                  : config.mode === "single"
                    ? "Measure a single HTTP request"
                    : "Requests execute one after another"}
              </span>
              <span>100 requests max · 10 concurrent max</span>
            </div>
            {error && (
              <div className="error" role="alert">
                {error}
                <small>Targets approved by the backend · GET only</small>
              </div>
            )}
            {busy && (
              <div className="loading" role="status">
                Test in progress. Waiting for the complete API result; large
                sequential batches can take several minutes. Previous results
                remain available below.
              </div>
            )}
          </section>
          <div className="results-heading">
            <h2>
              Test results{" "}
              <span className="badge neutral">
                {current
                  ? modeLabels[current.config.mode]
                  : "Awaiting first run"}
              </span>
            </h2>
            {current && (
              <span className="timestamp">
                Run #{runs.indexOf(current) + 1} ·{" "}
                {new Date(current.completedAt).toLocaleTimeString()}
              </span>
            )}
          </div>
          {current && "statusCode" in current.result && (
            <div
              className={current.result.success ? "result-notice" : "error"}
              role="status"
            >
              {current.result.success ? "Request succeeded" : "Request failed"}{" "}
              ·{" "}
              {current.result.statusCode === 0
                ? "Transport failure (status 0). See backend logs for details."
                : `HTTP ${current.result.statusCode}`}
            </div>
          )}
          {stats &&
            stats.success < 100 &&
            !("statusCode" in current!.result) && (
              <div className="error" role="status">
                The batch completed with failed requests. Success rate:{" "}
                {number(stats.success)}%. Batch responses do not include
                individual failure details.
              </div>
            )}
          <div className="metrics-grid">
            <MetricCard
              title="Average latency"
              value={stats ? ms(stats.average) : "—"}
              detail="Across all attempts"
              icon={Activity}
            />
            <MetricCard
              title="Minimum latency"
              value={stats ? ms(stats.min) : "—"}
              detail="Fastest observed attempt"
              icon={ArrowDown}
            />
            <MetricCard
              title="Maximum latency"
              value={stats ? ms(stats.max) : "—"}
              detail="Slowest observed attempt"
              icon={ArrowUp}
            />
            <MetricCard
              title="Success rate"
              value={stats ? `${number(stats.success)}%` : "—"}
              detail="HTTP 2xx responses"
              icon={CheckCircle2}
            />
            <MetricCard
              title="Throughput"
              value={
                current && "throughputRequestsPerSecond" in current.result
                  ? `${number(current.result.throughputRequestsPerSecond)} req/s`
                  : "—"
              }
              detail="Available for concurrent runs"
              icon={Zap}
            />
            <MetricCard
              title="Execution time"
              value={
                current && "totalExecutionTimeMs" in current.result
                  ? ms(current.result.totalExecutionTimeMs)
                  : "—"
              }
              detail="Available for concurrent runs"
              icon={Clock3}
            />
          </div>
          <div className="charts-grid">
            <section className="panel chart-panel">
              <div className="section-heading">
                <div>
                  <h2>Latency percentiles</h2>
                  <p>Aggregate latency at each percentile · milliseconds</p>
                </div>
                <span className="chart-key">
                  <i /> Selected run
                </span>
              </div>
              {current ? (
                <PercentileChart run={current} />
              ) : (
                <div className="empty-chart">
                  <Activity />
                  <strong>Your first benchmark starts here</strong>
                  <span>Run a batch to reveal P50, P95 and P99 latency.</span>
                </div>
              )}
              <div className="chart-footnote">
                Backend nearest-rank statistics. No per-request samples are
                generated.
              </div>
            </section>
            <section className="panel chart-panel">
              <div className="section-heading">
                <div>
                  <h2>Run comparison</h2>
                  <p>Latest 10 completed tests · milliseconds</p>
                </div>
                <span className="badge neutral">{runs.length} runs</span>
              </div>
              {runs.length ? (
                <div
                  className="chart comparison"
                  role="img"
                  aria-label="Average, P95 and P99 latency comparison for the latest ten runs"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={comparison} margin={{ right: 10 }}>
                      <CartesianGrid stroke="#253042" vertical={false} />
                      <XAxis dataKey="name" />
                      <YAxis width={65} unit=" ms" />
                      <Tooltip
                        contentStyle={{
                          background: "#151e2d",
                          border: "1px solid #354156",
                          borderRadius: 8,
                        }}
                        formatter={(v) => ms(Number(v))}
                      />
                      <Legend />
                      {["Average", "P95", "P99"].map((key, index) => (
                        <Bar
                          key={key}
                          dataKey={key}
                          fill={colors[index]}
                          radius={[3, 3, 0, 0]}
                        />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="empty-chart">
                  <Layers />
                  <strong>See how your runs compare</strong>
                  <span>Completed tests will appear here automatically.</span>
                </div>
              )}
              <div className="chart-footnote">
                Single requests include latency only. Compare equivalent
                configurations.
              </div>
            </section>
          </div>
          <section id="history" className="panel history">
            <div className="section-heading">
              <div>
                <h2>Test history</h2>
                <p>
                  Select a run to inspect its metrics. Stored in memory for this
                  session.
                </p>
              </div>
              <span className="badge neutral">{runs.length} completed</span>
            </div>
            {runs.length ? (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Run / time</th>
                      <th>Mode</th>
                      <th>Requests</th>
                      <th>Concurrency</th>
                      <th>Avg. latency</th>
                      <th>Success</th>
                      <th>Inspect</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...runs].reverse().map((run) => {
                      const metric = metrics(run.result);
                      return (
                        <tr
                          key={run.id}
                          className={
                            current?.id === run.id ? "selected-row" : ""
                          }
                        >
                          <td>
                            <b>#{runs.indexOf(run) + 1}</b>
                            <small>
                              {new Date(run.completedAt).toLocaleTimeString()}
                            </small>
                          </td>
                          <td>{modeLabels[run.config.mode]}</td>
                          <td>{metric.count}</td>
                          <td>
                            {run.config.mode === "concurrent"
                              ? run.config.concurrencyLevel
                              : "—"}
                          </td>
                          <td>{ms(metric.average)}</td>
                          <td>
                            <span
                              className={
                                metric.success === 100
                                  ? "success-text"
                                  : "failure-text"
                              }
                            >
                              {number(metric.success)}%
                            </span>
                          </td>
                          <td>
                            <button
                              className="view-button"
                              onClick={() => setSelected(run.id)}
                              aria-pressed={current?.id === run.id}
                            >
                              {current?.id === run.id ? "Selected" : "View run"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="history-empty">
                No tests yet. Configure your first run above to begin
                monitoring.
              </div>
            )}
          </section>
          <footer>
            Pulse <span>API Performance Analyzer</span>
            <span>Session history resets on refresh</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
