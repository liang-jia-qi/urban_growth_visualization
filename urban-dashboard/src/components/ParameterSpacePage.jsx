import { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import { useStore } from "../store";
import { CONTINENT_COLOR } from "../continentColors";
import WorldMapFlat from "./WorldMapFlat";

const CONTINENTS = ["Africa", "Asia", "Latin America"];
const YEAR_OPACITY = { "2016": 0.45, "2023": 0.9 };
const CHART_W = 540;
const CHART_H = 420;
const MARGIN = { top: 46, right: 24, bottom: 56, left: 68 };
const POINT_R = 5;
const POINT_R_SELECTED = 9;
const AXIS_TICK_FONT = 13;
const AXIS_LABEL_FONT = 14;
const TITLE_FONT = 17;

// Rule-based horizontal typology (paper thresholds: alpha=0, kappa=0 is the
// 50% logit midpoint; beta-bar/delta-bar are pooled means across all cities
// and both years, computed from the loaded data rather than hardcoded so
// they stay correct if the fit results are ever refit).
const CONSTRAINT_BADGE = {
  "Uniformly open": { bg: "#EAF3DE", text: "#3B6D11" },
  "Uniformly constrained": { bg: "#FAECE7", text: "#993C1D" },
  "Edge-constrained": { bg: "#E6F1FB", text: "#185FA5" },
  "Locked": { bg: "#FAEEDA", text: "#854F0B" },
};
const CONSTRUCTION_BADGE = {
  "Uniformly sparse": { bg: "#F1EFE8", text: "#5F5E5A" },
  "Uniformly dense": { bg: "#EEEDFE", text: "#534AB7" },
  "Thinly built": { bg: "#E1F5EE", text: "#0F6E56" },
  "Core-dense": { bg: "#FBEAF0", text: "#993556" },
};

function classifyConstraint(alpha, betaBar, beta) {
  if (alpha < 0 && beta < betaBar) return "Uniformly open";
  if (alpha >= 0 && beta < betaBar) return "Uniformly constrained";
  if (alpha < 0 && beta >= betaBar) return "Edge-constrained";
  return "Locked";
}
function classifyConstruction(kappa, deltaBar, delta) {
  if (kappa < 0 && delta < deltaBar) return "Uniformly sparse";
  if (kappa >= 0 && delta < deltaBar) return "Uniformly dense";
  if (kappa < 0 && delta >= deltaBar) return "Thinly built";
  return "Core-dense";
}

/** Joins zib (alpha/beta/kappa/delta) + height (A/B/C) fits with each city's
 * continent, one record per city/year, plus the rule-based typology. */
function buildRecords(cities, zib, height) {
  const byCityName = new Map(cities.map(c => [c.Name, c]));
  const raw = [];
  zib.forEach(z => {
    const h = height.find(hh => hh.city === z.city && String(hh.year) === String(z.year));
    const c = byCityName.get(z.city);
    if (!h || !c) return;
    raw.push({
      city: z.city,
      year: String(z.year),
      continent: c.continent,
      alpha: z.alpha, beta: z.beta, kappa: z.kappa,
      // The fitted CSV's `delta` follows this app's other tabs' convention,
      // pi(r) = logistic(kappa + delta*r). The paper's typology instead
      // defines pi(r) = logistic(kappa - delta*r), so its delta is the
      // negation of the raw column. Flip sign here so delta_bar comes out
      // as the paper's stated +0.086 (not -0.086) and the rule thresholds
      // below match the paper exactly.
      delta: -z.delta,
      A: h.A, B: h.B, C: h.C,
    });
  });

  const betaBar = d3.mean(raw, d => d.beta);
  const deltaBar = d3.mean(raw, d => d.delta);
  raw.forEach(d => {
    d.constraintType = classifyConstraint(d.alpha, betaBar, d.beta);
    d.constructionType = classifyConstruction(d.kappa, deltaBar, d.delta);
  });

  return { records: raw, betaBar, deltaBar };
}

/** One 2016->2023 change record per city (only cities with both years). */
function buildDeltas(records) {
  const byCity = d3.group(records, d => d.city);
  const deltas = [];
  byCity.forEach((recs, city) => {
    const r16 = recs.find(r => r.year === "2016");
    const r23 = recs.find(r => r.year === "2023");
    if (!r16 || !r23) return;
    deltas.push({
      city,
      continent: r16.continent,
      dAlpha: r23.alpha - r16.alpha, dBeta: r23.beta - r16.beta,
      dKappa: r23.kappa - r16.kappa, dDelta: r23.delta - r16.delta,
      dA: r23.A - r16.A, dB: r23.B - r16.B, dC: r23.C - r16.C,
    });
  });
  return deltas;
}

function fmt(v, digits = 4) {
  return v !== undefined && v !== null && !Number.isNaN(v) ? v.toFixed(digits) : "–";
}

/** Generic scatter plot: points colored by continent; if `byYear` is true,
 * points also carry a `year` field and are drawn with per-year opacity
 * (lighter = 2016, darker = 2023). The globally selected city (from the map)
 * is drawn larger with a black outline. Clicking a point shows its full
 * details (city, year, params, typology if present) below the chart. */
function ScatterPlot({ data, xKey, yKey, xLabel, yLabel, title, byYear, selectedCity }) {
  const svgRef = useRef();
  const [clicked, setClicked] = useState(null);

  useEffect(() => {
    const svg = d3.select(svgRef.current).attr("width", CHART_W).attr("height", CHART_H);
    svg.selectAll("*").remove();
    if (!data.length) return;

    const xExtent = d3.extent(data, d => d[xKey]);
    const yExtent = d3.extent(data, d => d[yKey]);
    const xPad = (xExtent[1] - xExtent[0]) * 0.08 || 0.1;
    const yPad = (yExtent[1] - yExtent[0]) * 0.08 || 0.1;

    const x = d3.scaleLinear().domain([xExtent[0] - xPad, xExtent[1] + xPad]).range([MARGIN.left, CHART_W - MARGIN.right]);
    const y = d3.scaleLinear().domain([yExtent[0] - yPad, yExtent[1] + yPad]).range([CHART_H - MARGIN.bottom, MARGIN.top]);

    svg.append("g").attr("transform", `translate(0,${CHART_H - MARGIN.bottom})`).call(d3.axisBottom(x).ticks(5))
      .selectAll("text").style("font-size", `${AXIS_TICK_FONT}px`);
    svg.append("g").attr("transform", `translate(${MARGIN.left},0)`).call(d3.axisLeft(y).ticks(5))
      .selectAll("text").style("font-size", `${AXIS_TICK_FONT}px`);

    if (xExtent[0] < 0 && xExtent[1] > 0) {
      svg.append("line").attr("x1", x(0)).attr("x2", x(0)).attr("y1", MARGIN.top).attr("y2", CHART_H - MARGIN.bottom)
        .attr("stroke", "#ccc").attr("stroke-width", 1);
    }
    if (yExtent[0] < 0 && yExtent[1] > 0) {
      svg.append("line").attr("x1", MARGIN.left).attr("x2", CHART_W - MARGIN.right).attr("y1", y(0)).attr("y2", y(0))
        .attr("stroke", "#ccc").attr("stroke-width", 1);
    }

    svg.append("text").attr("x", CHART_W / 2).attr("y", 22).attr("text-anchor", "middle").attr("font-size", TITLE_FONT).attr("font-weight", "bold").text(title);
    svg.append("text").attr("x", CHART_W / 2).attr("y", CHART_H - 10).attr("text-anchor", "middle").attr("font-size", AXIS_LABEL_FONT).attr("fill", "#555").text(xLabel);
    svg.append("text").attr("transform", "rotate(-90)").attr("x", -CHART_H / 2).attr("y", 18).attr("text-anchor", "middle").attr("font-size", AXIS_LABEL_FONT).attr("fill", "#555").text(yLabel);

    // draw the selected city's points last so they sit on top
    const sorted = selectedCity ? [...data].sort((a, b) => (a.city === selectedCity ? 1 : 0) - (b.city === selectedCity ? 1 : 0)) : data;

    svg.append("g")
      .selectAll("circle")
      .data(sorted)
      .join("circle")
      .attr("cx", d => x(d[xKey]))
      .attr("cy", d => y(d[yKey]))
      .attr("r", d => (d.city === selectedCity ? POINT_R_SELECTED : POINT_R))
      .attr("fill", d => CONTINENT_COLOR[d.continent] || "#888")
      .attr("fill-opacity", d => (byYear ? YEAR_OPACITY[d.year] : 0.75))
      .attr("stroke", d => (d.city === selectedCity ? "#000" : "none"))
      .attr("stroke-width", 2.2)
      .style("cursor", "pointer")
      .on("click", (_, d) => setClicked(d));
  }, [data, xKey, yKey, xLabel, yLabel, title, byYear, selectedCity]);

  useEffect(() => { setClicked(null); }, [data]);

  return (
    <div style={{ textAlign: "center" }}>
      <svg ref={svgRef} />
      <div style={{ fontSize: 14, color: "#555", minHeight: 40, maxWidth: CHART_W, margin: "4px auto 0", lineHeight: 1.5 }}>
        {clicked ? (
          <>
            <strong>{clicked.city}</strong>{clicked.year ? ` (${clicked.year})` : ""}
            {" — "}{xLabel.split(" ")[0]}: {fmt(clicked[xKey])}, {yLabel.split(" ")[0]}: {fmt(clicked[yKey])}
            {clicked.constraintType && <><br />{clicked.constraintType} &middot; {clicked.constructionType}</>}
          </>
        ) : (
          <span style={{ color: "#aaa" }}>Click a point for details</span>
        )}
      </div>
    </div>
  );
}

/** Standard box-and-whisker (Q1-Q3 box, median line, 1.5*IQR whiskers,
 * outliers as dots), one box per group. */
function BoxPlot({ groups, title, yLabel }) {
  const svgRef = useRef();

  useEffect(() => {
    const svg = d3.select(svgRef.current).attr("width", CHART_W).attr("height", CHART_H);
    svg.selectAll("*").remove();
    const populated = groups.filter(g => g.values.length > 0);
    if (!populated.length) return;

    const allVals = populated.flatMap(g => g.values);
    const yExtent = d3.extent(allVals);
    const yPad = (yExtent[1] - yExtent[0]) * 0.1 || 0.1;
    const y = d3.scaleLinear().domain([yExtent[0] - yPad, yExtent[1] + yPad]).range([CHART_H - MARGIN.bottom, MARGIN.top]);
    const x = d3.scaleBand().domain(populated.map(g => g.label)).range([MARGIN.left, CHART_W - MARGIN.right]).padding(0.35);

    svg.append("g").attr("transform", `translate(0,${CHART_H - MARGIN.bottom})`).call(d3.axisBottom(x))
      .selectAll("text").attr("font-size", AXIS_TICK_FONT).attr("transform", "rotate(-20)").attr("text-anchor", "end");
    svg.append("g").attr("transform", `translate(${MARGIN.left},0)`).call(d3.axisLeft(y).ticks(5))
      .selectAll("text").style("font-size", `${AXIS_TICK_FONT}px`);

    if (yExtent[0] < 0 && yExtent[1] > 0) {
      svg.append("line").attr("x1", MARGIN.left).attr("x2", CHART_W - MARGIN.right).attr("y1", y(0)).attr("y2", y(0))
        .attr("stroke", "#ccc").attr("stroke-width", 1);
    }

    svg.append("text").attr("x", CHART_W / 2).attr("y", 22).attr("text-anchor", "middle").attr("font-size", TITLE_FONT).attr("font-weight", "bold").text(title);
    svg.append("text").attr("transform", "rotate(-90)").attr("x", -CHART_H / 2).attr("y", 18).attr("text-anchor", "middle").attr("font-size", AXIS_LABEL_FONT).attr("fill", "#555").text(yLabel);

    populated.forEach(g => {
      const sorted = [...g.values].sort(d3.ascending);
      const q1 = d3.quantile(sorted, 0.25);
      const median = d3.quantile(sorted, 0.5);
      const q3 = d3.quantile(sorted, 0.75);
      const iqr = q3 - q1;
      const lowFence = q1 - 1.5 * iqr;
      const highFence = q3 + 1.5 * iqr;
      const withinLow = d3.min(sorted.filter(v => v >= lowFence));
      const withinHigh = d3.max(sorted.filter(v => v <= highFence));
      const outliers = sorted.filter(v => v < withinLow || v > withinHigh);

      const bx = x(g.label);
      const bw = x.bandwidth();
      const cx = bx + bw / 2;

      svg.append("line").attr("x1", cx).attr("x2", cx).attr("y1", y(withinLow)).attr("y2", y(q1)).attr("stroke", "#555");
      svg.append("line").attr("x1", cx).attr("x2", cx).attr("y1", y(q3)).attr("y2", y(withinHigh)).attr("stroke", "#555");
      svg.append("line").attr("x1", bx + bw * 0.25).attr("x2", bx + bw * 0.75).attr("y1", y(withinLow)).attr("y2", y(withinLow)).attr("stroke", "#555");
      svg.append("line").attr("x1", bx + bw * 0.25).attr("x2", bx + bw * 0.75).attr("y1", y(withinHigh)).attr("y2", y(withinHigh)).attr("stroke", "#555");

      svg.append("rect")
        .attr("x", bx).attr("width", bw)
        .attr("y", y(q3)).attr("height", Math.max(1, y(q1) - y(q3)))
        .attr("fill", g.color).attr("fill-opacity", 0.55).attr("stroke", g.color).attr("stroke-width", 1.5);

      svg.append("line").attr("x1", bx).attr("x2", bx + bw).attr("y1", y(median)).attr("y2", y(median))
        .attr("stroke", "#222").attr("stroke-width", 2);

      svg.append("g")
        .selectAll("circle")
        .data(outliers)
        .join("circle")
        .attr("cx", cx).attr("cy", v => y(v)).attr("r", 4)
        .attr("fill", "none").attr("stroke", g.color).attr("stroke-width", 1.6);
    });
  }, [groups, title, yLabel]);

  return <svg ref={svgRef} />;
}

function ContinentLegend() {
  return (
    <div style={{ display: "flex", justifyContent: "center", gap: 20, margin: "4px 0 8px", fontSize: 15, color: "#555", flexWrap: "wrap" }}>
      {CONTINENTS.map(name => (
        <span key={name} style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: CONTINENT_COLOR[name], display: "inline-block" }} />
          {name}
        </span>
      ))}
      <span style={{ display: "flex", alignItems: "center", gap: 10, marginLeft: 8, color: "#888" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#888", opacity: YEAR_OPACITY["2016"], display: "inline-block" }} />
          2016
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#888", opacity: YEAR_OPACITY["2023"], display: "inline-block" }} />
          2023
        </span>
      </span>
    </div>
  );
}

function Badge({ text }) {
  const style = CONSTRAINT_BADGE[text] || CONSTRUCTION_BADGE[text] || { bg: "#eee", text: "#555" };
  return (
    <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 4, fontSize: 13.5, fontWeight: 500, background: style.bg, color: style.text }}>
      {text}
    </span>
  );
}

function TypologyLegend({ betaBar, deltaBar }) {
  const row = { display: "flex", alignItems: "center", gap: 6, marginBottom: 3 };
  return (
    <div style={{ maxWidth: 820, margin: "6px auto 14px", fontSize: 14, color: "#555" }}>
      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 10 }}>
        <span style={{ color: "#888", fontWeight: 500 }}>Constraint (α, β), β&#772; = {fmt(betaBar, 3)}:</span>
        {Object.keys(CONSTRAINT_BADGE).map(t => <Badge key={t} text={t} />)}
      </div>
      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <span style={{ color: "#888", fontWeight: 500 }}>Construction (κ, δ), δ&#772; = {fmt(deltaBar, 3)}:</span>
        {Object.keys(CONSTRUCTION_BADGE).map(t => <Badge key={t} text={t} />)}
      </div>
      <div style={{ marginTop: 10, fontSize: 12.5, color: "#999" }}>
        ψ(r) = logistic(α + βr) &middot; π(r) = logistic(κ &minus; δr). Thresholds: α = 0, κ = 0
        (50% at the logit midpoint); β&#772;, δ&#772; are pooled means across all cities and both years.
      </div>
    </div>
  );
}

function SelectedCityCard({ selectedCity, records }) {
  if (!selectedCity) {
    return (
      <div style={{ textAlign: "center", color: "#999", padding: "12px 0 24px", fontSize: 15 }}>
        Select a city on the map above to see its place in the parameter space and its typology.
      </div>
    );
  }

  const own = records.filter(r => r.city === selectedCity.Name);
  if (!own.length) {
    return (
      <div style={{ textAlign: "center", color: "#999", padding: "12px 0 24px", fontSize: 15 }}>
        No fitted parameters for {selectedCity.Name}.
      </div>
    );
  }

  const th = { padding: "6px 14px", textAlign: "left", borderBottom: "1px solid #ccc", fontWeight: "normal", color: "#666" };
  const td = { padding: "6px 14px", borderBottom: "1px solid #eee" };

  return (
    <div style={{ maxWidth: 760, margin: "12px auto 24px" }}>
      <h4 style={{ textAlign: "center", marginBottom: 10, fontSize: 19 }}>{selectedCity.Name} &mdash; typology</h4>
      <table style={{ borderCollapse: "collapse", margin: "0 auto", fontSize: 15 }}>
        <thead>
          <tr>
            <th style={th}>Year</th>
            <th style={th}>Constraint (α, β)</th>
            <th style={th}>Construction (κ, δ)</th>
          </tr>
        </thead>
        <tbody>
          {["2016", "2023"].map(year => {
            const r = own.find(x => x.year === year);
            if (!r) return null;
            return (
              <tr key={year}>
                <td style={{ ...td, fontWeight: "bold" }}>{year}</td>
                <td style={td}><Badge text={r.constraintType} /> <span style={{ color: "#888" }}>(α={fmt(r.alpha, 2)}, β={fmt(r.beta, 2)})</span></td>
                <td style={td}><Badge text={r.constructionType} /> <span style={{ color: "#888" }}>(κ={fmt(r.kappa, 2)}, δ={fmt(r.delta, 2)})</span></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const chartRow = { display: "flex", gap: 20, justifyContent: "center", flexWrap: "wrap", marginTop: 8 };
const section = { maxWidth: 1000, margin: "0 auto", padding: "40px 24px" };

export default function ParameterSpacePage() {
  const { cities, zib, height, selectedCity } = useStore();

  const { records, betaBar, deltaBar } = useMemo(() => buildRecords(cities, zib, height), [cities, zib, height]);
  const deltas = useMemo(() => buildDeltas(records), [records]);

  const aByGroup = useMemo(() => {
    const groups = [];
    CONTINENTS.forEach(cont => {
      ["2016", "2023"].forEach(year => {
        groups.push({
          label: `${cont} '${year.slice(2)}`,
          color: CONTINENT_COLOR[cont],
          values: records.filter(r => r.continent === cont && r.year === year).map(r => r.A),
        });
      });
    });
    return groups;
  }, [records]);

  const dAByGroup = useMemo(() => (
    CONTINENTS.map(cont => ({
      label: cont,
      color: CONTINENT_COLOR[cont],
      values: deltas.filter(d => d.continent === cont).map(d => d.dA),
    }))
  ), [deltas]);

  if (!cities.length || !zib.length || !height.length) {
    return <div style={{ textAlign: "center", color: "#999", padding: "60px 0" }}>Loading parameter data&hellip;</div>;
  }

  const selectedName = selectedCity?.Name;

  return (
    <div style={{ overflowY: "auto", height: "100%", background: "#fff" }}>
      <section style={{ ...section, paddingBottom: 0 }}>
        <h2 style={{ textAlign: "center" }}>Fitted Parameter Space</h2>
        <p style={{ textAlign: "center", color: "#666", maxWidth: 760, margin: "0 auto", fontSize: 15 }}>
          Each point is one city (dot color = continent, opacity = year). Click any point for
          details. Select a city below to highlight it across every chart.
        </p>
        <WorldMapFlat />
        <SelectedCityCard selectedCity={selectedCity} records={records} />
      </section>

      <section style={{ ...section, borderTop: "1px solid #eee", paddingTop: 24 }}>
        <h3 style={{ textAlign: "center", marginBottom: 4 }}>Horizontal Parameters</h3>
        <ContinentLegend />
        <TypologyLegend betaBar={betaBar} deltaBar={deltaBar} />
        <div style={chartRow}>
          <ScatterPlot data={records} xKey="alpha" yKey="beta" xLabel="α (structural zero, center)" yLabel="β (ψ slope)" title="α vs β" byYear selectedCity={selectedName} />
          <ScatterPlot data={records} xKey="kappa" yKey="delta" xLabel="κ (build prob., center)" yLabel="δ (π slope)" title="κ vs δ" byYear selectedCity={selectedName} />
          <ScatterPlot data={deltas} xKey="dAlpha" yKey="dBeta" xLabel="Δα" yLabel="Δβ" title="Δα vs Δβ (2016→2023)" selectedCity={selectedName} />
          <ScatterPlot data={deltas} xKey="dKappa" yKey="dDelta" xLabel="Δκ" yLabel="Δδ" title="Δκ vs Δδ (2016→2023)" selectedCity={selectedName} />
        </div>
      </section>

      <section style={{ ...section, borderTop: "1px solid #eee" }}>
        <h3 style={{ textAlign: "center", marginBottom: 4 }}>Vertical Parameters</h3>
        <ContinentLegend />
        <div style={chartRow}>
          <ScatterPlot data={records} xKey="B" yKey="C" xLabel="B (height decay)" yLabel="C (height curvature)" title="B vs C" byYear selectedCity={selectedName} />
          <BoxPlot groups={aByGroup} title="A distribution by continent" yLabel="A (height amplitude, m)" />
          <ScatterPlot data={deltas} xKey="dB" yKey="dC" xLabel="ΔB" yLabel="ΔC" title="ΔB vs ΔC (2016→2023)" selectedCity={selectedName} />
          <BoxPlot groups={dAByGroup} title="ΔA distribution by continent" yLabel="ΔA (2016→2023, m)" />
        </div>
      </section>
    </div>
  );
}
