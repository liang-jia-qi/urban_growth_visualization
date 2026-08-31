import { useEffect, useMemo, useRef } from "react";
import * as d3 from "d3";
import { useStore } from "../store";
import { CONTINENT_COLOR } from "../continentColors";

const CONTINENTS = ["Africa", "Asia", "Latin America"];
const YEAR_OPACITY = { "2016": 0.45, "2023": 0.9 };
const CHART_W = 380;
const CHART_H = 300;
const MARGIN = { top: 36, right: 16, bottom: 44, left: 56 };

/** Joins zib (alpha/beta/kappa/delta) + height (A/B/C) fits with each city's
 * continent, one record per city/year. */
function buildRecords(cities, zib, height) {
  const byCityName = new Map(cities.map(c => [c.Name, c]));
  const records = [];
  zib.forEach(z => {
    const h = height.find(hh => hh.city === z.city && String(hh.year) === String(z.year));
    const c = byCityName.get(z.city);
    if (!h || !c) return;
    records.push({
      city: z.city,
      year: String(z.year),
      continent: c.continent,
      alpha: z.alpha, beta: z.beta, kappa: z.kappa, delta: z.delta,
      A: h.A, B: h.B, C: h.C,
    });
  });
  return records;
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

/** Generic scatter plot: points colored by continent; if `byYear` is true,
 * points also carry a `year` field and are drawn with per-year opacity
 * (lighter = 2016, darker = 2023) so both years show on one chart. */
function ScatterPlot({ data, xKey, yKey, xLabel, yLabel, title, byYear }) {
  const svgRef = useRef();

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

    svg.append("g").attr("transform", `translate(0,${CHART_H - MARGIN.bottom})`).call(d3.axisBottom(x).ticks(5));
    svg.append("g").attr("transform", `translate(${MARGIN.left},0)`).call(d3.axisLeft(y).ticks(5));

    // zero reference lines, since several of these params are signed (deltas, beta, kappa, etc.)
    if (xExtent[0] < 0 && xExtent[1] > 0) {
      svg.append("line").attr("x1", x(0)).attr("x2", x(0)).attr("y1", MARGIN.top).attr("y2", CHART_H - MARGIN.bottom)
        .attr("stroke", "#ccc").attr("stroke-width", 1);
    }
    if (yExtent[0] < 0 && yExtent[1] > 0) {
      svg.append("line").attr("x1", MARGIN.left).attr("x2", CHART_W - MARGIN.right).attr("y1", y(0)).attr("y2", y(0))
        .attr("stroke", "#ccc").attr("stroke-width", 1);
    }

    svg.append("text").attr("x", CHART_W / 2).attr("y", 16).attr("text-anchor", "middle").attr("font-size", 12).attr("font-weight", "bold").text(title);
    svg.append("text").attr("x", CHART_W / 2).attr("y", CHART_H - 6).attr("text-anchor", "middle").attr("font-size", 10).attr("fill", "#555").text(xLabel);
    svg.append("text").attr("transform", "rotate(-90)").attr("x", -CHART_H / 2).attr("y", 14).attr("text-anchor", "middle").attr("font-size", 10).attr("fill", "#555").text(yLabel);

    svg.append("g")
      .selectAll("circle")
      .data(data)
      .join("circle")
      .attr("cx", d => x(d[xKey]))
      .attr("cy", d => y(d[yKey]))
      .attr("r", 3.5)
      .attr("fill", d => CONTINENT_COLOR[d.continent] || "#888")
      .attr("fill-opacity", d => (byYear ? YEAR_OPACITY[d.year] : 0.75))
      .attr("stroke", "none")
      .append("title")
      .text(d => `${d.city}${byYear ? ` (${d.year})` : ""}\n${xLabel}: ${d[xKey].toFixed(4)}\n${yLabel}: ${d[yKey].toFixed(4)}`);
  }, [data, xKey, yKey, xLabel, yLabel, title, byYear]);

  return <svg ref={svgRef} />;
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
      .selectAll("text").attr("font-size", 9).attr("transform", "rotate(-20)").attr("text-anchor", "end");
    svg.append("g").attr("transform", `translate(${MARGIN.left},0)`).call(d3.axisLeft(y).ticks(5));

    if (yExtent[0] < 0 && yExtent[1] > 0) {
      svg.append("line").attr("x1", MARGIN.left).attr("x2", CHART_W - MARGIN.right).attr("y1", y(0)).attr("y2", y(0))
        .attr("stroke", "#ccc").attr("stroke-width", 1);
    }

    svg.append("text").attr("x", CHART_W / 2).attr("y", 16).attr("text-anchor", "middle").attr("font-size", 12).attr("font-weight", "bold").text(title);
    svg.append("text").attr("transform", "rotate(-90)").attr("x", -CHART_H / 2).attr("y", 14).attr("text-anchor", "middle").attr("font-size", 10).attr("fill", "#555").text(yLabel);

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
        .attr("cx", cx).attr("cy", v => y(v)).attr("r", 2.5)
        .attr("fill", "none").attr("stroke", g.color);
    });
  }, [groups, title, yLabel]);

  return <svg ref={svgRef} />;
}

function ContinentLegend() {
  return (
    <div style={{ display: "flex", justifyContent: "center", gap: 20, margin: "4px 0 8px", fontSize: 12, color: "#555" }}>
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

const chartRow = { display: "flex", gap: 20, justifyContent: "center", flexWrap: "wrap", marginTop: 8 };
const section = { maxWidth: 1000, margin: "0 auto", padding: "40px 24px" };

export default function ParameterSpacePage() {
  const { cities, zib, height } = useStore();

  const records = useMemo(() => buildRecords(cities, zib, height), [cities, zib, height]);
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

  return (
    <div style={{ overflowY: "auto", height: "100%", background: "#fff" }}>
      <section style={{ ...section, paddingBottom: 20 }}>
        <h2 style={{ textAlign: "center" }}>Fitted Parameter Space</h2>
        <p style={{ textAlign: "center", color: "#666", maxWidth: 700, margin: "0 auto" }}>
          Each point is one city (dot = continent, opacity = year). "Change" plots show each
          city's 2016&rarr;2023 shift (&Delta; = 2023 &minus; 2016), one point per city.
        </p>
      </section>

      <section style={section}>
        <h3 style={{ textAlign: "center", marginBottom: 4 }}>Horizontal Parameters</h3>
        <ContinentLegend />
        <div style={chartRow}>
          <ScatterPlot data={records} xKey="alpha" yKey="beta" xLabel="α (structural zero, center)" yLabel="β (ψ slope)" title="α vs β" byYear />
          <ScatterPlot data={records} xKey="kappa" yKey="delta" xLabel="κ (build prob., center)" yLabel="δ (π slope)" title="κ vs δ" byYear />
          <ScatterPlot data={deltas} xKey="dAlpha" yKey="dBeta" xLabel="Δα" yLabel="Δβ" title="Δα vs Δβ (2016→2023)" />
          <ScatterPlot data={deltas} xKey="dKappa" yKey="dDelta" xLabel="Δκ" yLabel="Δδ" title="Δκ vs Δδ (2016→2023)" />
        </div>
      </section>

      <section style={{ ...section, borderTop: "1px solid #eee" }}>
        <h3 style={{ textAlign: "center", marginBottom: 4 }}>Vertical Parameters</h3>
        <ContinentLegend />
        <div style={chartRow}>
          <ScatterPlot data={records} xKey="B" yKey="C" xLabel="B (height decay)" yLabel="C (height curvature)" title="B vs C" byYear />
          <BoxPlot groups={aByGroup} title="A distribution by continent" yLabel="A (height amplitude, m)" />
          <ScatterPlot data={deltas} xKey="dB" yKey="dC" xLabel="ΔB" yLabel="ΔC" title="ΔB vs ΔC (2016→2023)" />
          <BoxPlot groups={dAByGroup} title="ΔA distribution by continent" yLabel="ΔA (2016→2023, m)" />
        </div>
      </section>
    </div>
  );
}
