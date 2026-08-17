import { useState, useEffect } from "react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

const RUNALYZE_MCP_URL = "https://runalyze.com/mcp";

async function fetchRunalyzeData(prompt) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      system: `You are a fitness data assistant with access to Runalyze via MCP. 
When asked about runs, fetch the data and return ONLY a JSON array (no markdown, no preamble) 
with this structure for each run:
[{
  "date": "Jun 1",
  "distance_km": 10.5,
  "duration_min": 55,
  "pace_min_km": 5.24,
  "hr_avg": 145,
  "elevation_m": 120,
  "trimp": 65,
  "title": "Morning Run"
}]
If data is unavailable, return an empty array [].`,
      messages: [{ role: "user", content: prompt }],
      mcp_servers: [{ type: "url", url: RUNALYZE_MCP_URL, name: "runalyze" }],
    }),
  });
  const data = await response.json();
  const textBlock = data.content?.find(b => b.type === "text");
  if (!textBlock) return [];
  try {
    const clean = textBlock.text.replace(/```json|```/g, "").trim();
    return JSON.parse(clean);
  } catch {
    return null; // signal parse error
  }
}

function StatCard({ label, value, unit, accent }) {
  return (
    <div style={{
      background: "#0f1923",
      border: `1px solid ${accent}33`,
      borderLeft: `3px solid ${accent}`,
      borderRadius: 8,
      padding: "12px 16px",
    }}>
      <div style={{ color: "#7a8a99", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>{label}</div>
      <div style={{ color: "#e8f0f7", fontSize: 22, fontWeight: 700 }}>
        {value} <span style={{ fontSize: 13, color: accent, fontWeight: 400 }}>{unit}</span>
      </div>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#0f1923", border: "1px solid #1e3a5f", borderRadius: 8, padding: "10px 14px" }}>
      <div style={{ color: "#7ab3d4", fontWeight: 600, marginBottom: 6 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color, fontSize: 13 }}>{p.name}: <strong>{p.value}</strong></div>
      ))}
    </div>
  );
};

export default function JuneRunsDashboard() {
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeChart, setActiveChart] = useState("distance");

  useEffect(() => {
    fetchRunalyzeData("Fetch all my run activities from June 2026 and return them as JSON.")
      .then(data => {
        if (data === null) setError("Could not parse Runalyze response.");
        else if (data.length === 0) setError("No June runs found or Runalyze returned no data.");
        else setRuns(data);
      })
      .catch(() => setError("Failed to connect to Runalyze. Make sure the MCP is connected."))
      .finally(() => setLoading(false));
  }, []);

  const totalKm = runs.reduce((s, r) => s + (r.distance_km || 0), 0).toFixed(1);
  const totalMin = runs.reduce((s, r) => s + (r.duration_min || 0), 0);
  const avgHR = runs.length ? Math.round(runs.reduce((s, r) => s + (r.hr_avg || 0), 0) / runs.filter(r => r.hr_avg).length) : 0;
  const totalElev = runs.reduce((s, r) => s + (r.elevation_m || 0), 0);

  const chartConfigs = {
    distance: { key: "distance_km", label: "Distance (km)", color: "#3b9eff" },
    pace: { key: "pace_min_km", label: "Pace (min/km)", color: "#22d3a0" },
    hr: { key: "hr_avg", label: "Avg HR (bpm)", color: "#f97066" },
    trimp: { key: "trimp", label: "TRIMP", color: "#a78bfa" },
  };

  const cc = chartConfigs[activeChart];

  return (
    <div style={{
      minHeight: "100vh",
      background: "#070e17",
      color: "#e8f0f7",
      fontFamily: "'Inter', system-ui, sans-serif",
      padding: "28px 20px",
      maxWidth: 720,
      margin: "0 auto",
    }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#3b9eff", boxShadow: "0 0 8px #3b9eff" }} />
          <span style={{ color: "#3b9eff", fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase" }}>Runalyze · June 2026</span>
        </div>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em" }}>June Runs</h1>
        <p style={{ margin: "4px 0 0", color: "#4a6a80", fontSize: 14 }}>{runs.length} activities compared</p>
      </div>

      {loading && (
        <div style={{ textAlign: "center", padding: "60px 0", color: "#4a6a80" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
          <div>Fetching your runs from Runalyze…</div>
        </div>
      )}

      {error && (
        <div style={{
          background: "#1a0a0a", border: "1px solid #7f1d1d", borderRadius: 10,
          padding: "20px 24px", color: "#fca5a5", lineHeight: 1.6,
        }}>
          <strong>⚠ {error}</strong>
          <p style={{ margin: "8px 0 0", fontSize: 13, color: "#ef4444" }}>
            Make sure Runalyze MCP is connected at <code>https://runalyze.com/mcp</code> in your Claude settings.
          </p>
        </div>
      )}

      {!loading && !error && runs.length > 0 && (
        <>
          {/* Summary Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 24 }}>
            <StatCard label="Total Distance" value={totalKm} unit="km" accent="#3b9eff" />
            <StatCard label="Total Time" value={`${Math.floor(totalMin / 60)}h ${totalMin % 60}m`} unit="" accent="#22d3a0" />
            <StatCard label="Avg Heart Rate" value={avgHR} unit="bpm" accent="#f97066" />
            <StatCard label="Total Elevation" value={totalElev} unit="m" accent="#a78bfa" />
          </div>

          {/* Chart Switcher */}
          <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
            {Object.entries(chartConfigs).map(([key, cfg]) => (
              <button key={key} onClick={() => setActiveChart(key)} style={{
                background: activeChart === key ? cfg.color + "22" : "transparent",
                border: `1px solid ${activeChart === key ? cfg.color : "#1e3a5f"}`,
                borderRadius: 20,
                color: activeChart === key ? cfg.color : "#4a6a80",
                padding: "6px 14px",
                fontSize: 12,
                cursor: "pointer",
                fontWeight: activeChart === key ? 600 : 400,
                transition: "all 0.15s",
              }}>
                {cfg.label}
              </button>
            ))}
          </div>

          {/* Main Chart */}
          <div style={{ background: "#0a1520", borderRadius: 12, padding: "20px 8px 12px", marginBottom: 24 }}>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={runs} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: "#4a6a80", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#4a6a80", fontSize: 11 }} axisLine={false} tickLine={false} width={36} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey={cc.key} name={cc.label} fill={cc.color} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Run Table */}
          <div style={{ background: "#0a1520", borderRadius: 12, overflow: "hidden" }}>
            <div style={{ padding: "14px 18px", borderBottom: "1px solid #1e3a5f", fontSize: 12, color: "#3b9eff", letterSpacing: "0.08em", textTransform: "uppercase" }}>
              All Activities
            </div>
            {runs.map((run, i) => (
              <div key={i} style={{
                display: "grid",
                gridTemplateColumns: "60px 1fr 70px 70px 60px",
                gap: 8,
                padding: "12px 18px",
                borderBottom: i < runs.length - 1 ? "1px solid #0f1923" : "none",
                alignItems: "center",
                fontSize: 13,
              }}>
                <div style={{ color: "#3b9eff", fontWeight: 600 }}>{run.date}</div>
                <div style={{ color: "#c8d8e8", fontSize: 12 }}>{run.title || "Run"}</div>
                <div style={{ color: "#e8f0f7", textAlign: "right" }}>{run.distance_km} <span style={{ color: "#4a6a80", fontSize: 11 }}>km</span></div>
                <div style={{ color: "#22d3a0", textAlign: "right" }}>{run.pace_min_km} <span style={{ color: "#4a6a80", fontSize: 11 }}>/km</span></div>
                <div style={{ color: "#f97066", textAlign: "right" }}>{run.hr_avg || "—"} <span style={{ color: "#4a6a80", fontSize: 11 }}>bpm</span></div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
