import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import { useStore } from "../store";
import { dataUrl } from "../dataUrl";

const YEAR_COLOR = { "2016": "#f93a2e", "2023": "#2ab421" };
const RING_LEVELS = [3, 5, 9];
const IMG_SIZE = 380;
const GIF_SIZE = 260;

// All raw rasters are cropped to a fixed 40km x 40km box centered on the
// city, so the farthest cell from center (a corner) is at the half-diagonal.
const DIAG_KM = 20 * Math.sqrt(2);

const TURBO_STOPS = [
  "#30123b", "#4145ab", "#4675ed", "#39a2fc", "#1bcfd4",
  "#24eca6", "#61fc6c", "#a4fc3b", "#d1e834", "#f3c63a",
  "#fb8022", "#e1421f", "#7a0403",
];

function imgSrc(cityName, year) {
  return dataUrl(`raw_images/${cityName}_${year}.png`);
}

const logistic = x => 1 / (1 + Math.exp(-x));

function fmt(v, digits = 3) {
  return v !== undefined && v !== null && !Number.isNaN(v) ? v.toFixed(digits) : "–";
}
function fmtPct(v) {
  return v !== undefined && v !== null && !Number.isNaN(v) ? `${(v * 100).toFixed(1)}%` : "–";
}
function fmtDelta(v, digits = 3, isPct = false) {
  if (v === undefined || v === null || Number.isNaN(v)) return "–";
  const sign = v >= 0 ? "+" : "−";
  const val = Math.abs(v);
  return isPct ? `${sign}${(val * 100).toFixed(1)}` : `${sign}${val.toFixed(digits)}`;
}

/** rMax for a given population: remoteness value at the raster's farthest
 * (corner) cell, per r = 1000 * D_km / sqrt(population). */
function rMaxForPop(popPersons) {
  return popPersons ? (1000 * DIAG_KM) / Math.sqrt(popPersons) : 10;
}

/** White remoteness rings (r = 1000 * D_km / sqrt(population)), drawn to scale
 * using each city's physical extent (image_meta.json) rather than baked into
 * the raster image.
 *
 * The source raster is an equirectangular crop (equal degrees per pixel in
 * both axes), so real-world km/pixel differs slightly between the two axes
 * away from the equator (longitude degrees shrink by cos(lat)). A metrically
 * "correct" ring would therefore be a very slight ellipse; we average the
 * two axis scales instead so rings render as visually clean circles, since
 * the distortion is small for these cities and a circle reads more clearly.
 */
function RemotenessRings({ meta, popPersons, size }) {
  if (!meta || !popPersons) return null;
  const sqrtPop = Math.sqrt(popPersons);
  const cx = size / 2, cy = size / 2;
  const pxPerKm = size / ((meta.total_km_x + meta.total_km_y) / 2);

  return (
    <svg width={size} height={size} style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none" }}>
      {RING_LEVELS.map(r => {
        const dKm = (r * sqrtPop) / 1000;
        const radius = dKm * pxPerKm;
        return (
          <g key={r}>
            <circle cx={cx} cy={cy} r={radius} fill="none" stroke="#fff" strokeWidth={1.4} opacity={0.85} />
            <text x={cx} y={cy - radius - 3} fill="#fff" fontSize={11} textAnchor="middle" style={{ paintOrder: "stroke", stroke: "#000", strokeWidth: 2 }}>
              r={r}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** Alternates between the 2016 and 2023 raw images every ~800ms (a GIF-like
 * toggle), with remoteness rings recomputed per frame so they stay accurate
 * to each year's population — a baked .gif couldn't do that without also
 * duplicating the ring math in Python at generation time. */
function AnimatedCityCompare({ cityName, meta, pop2016, pop2023, size }) {
  const [year, setYear] = useState("2016");

  useEffect(() => {
    setYear("2016");
    const id = setInterval(() => {
      setYear(y => (y === "2016" ? "2023" : "2016"));
    }, 800);
    return () => clearInterval(id);
  }, [cityName]);

  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontWeight: "bold", marginBottom: 6, color: YEAR_COLOR[year], transition: "color 0.15s" }}>{year}</div>
      <div style={{ position: "relative", width: size, height: size, background: "#000", margin: "0 auto" }}>
        <img
          src={imgSrc(cityName, year)}
          alt={`${cityName} ${year}`}
          style={{ width: size, height: size, objectFit: "contain" }}
          onError={e => { e.target.style.opacity = 0.15; }}
        />
        <RemotenessRings meta={meta} popPersons={year === "2016" ? pop2016 : pop2023} size={size} />
      </div>
    </div>
  );
}

function ColorBandLegend() {
  return (
    <div style={{ maxWidth: 420, margin: "10px auto 0", fontSize: 11, color: "#666" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ width: 18, height: 14, background: "#000", border: "1px solid #ccc", flexShrink: 0 }} />
        <span>no data / not built</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
        <div
          style={{
            width: 220,
            height: 14,
            background: `linear-gradient(to right, ${TURBO_STOPS.join(",")})`,
            border: "1px solid #ccc",
            flexShrink: 0,
          }}
        />
        <span>building height: low &rarr; high (per-image 2nd&ndash;98th percentile stretch)</span>
      </div>
    </div>
  );
}

function CurveChart({ svgRef }) {
  return <svg ref={svgRef} />;
}

export default function CityRawCompare() {
  const selectedCity = useStore(s => s.selectedCity);
  const [imageMeta, setImageMeta] = useState(null);
  const probRef = useRef();
  const heightRef = useRef();

  useEffect(() => {
    d3.json(dataUrl("image_meta.json")).then(setImageMeta).catch(() => setImageMeta({}));
  }, []);

  const p2016 = selectedCity?.params?.["2016"] || {};
  const p2023 = selectedCity?.params?.["2023"] || {};
  const pop2016 = (+selectedCity?.pop_2016_UN || 0) * 1000;
  const pop2023 = (+selectedCity?.pop_2023_UN || 0) * 1000;
  const rMax = Math.max(rMaxForPop(pop2016), rMaxForPop(pop2023), 5);

  function drawRingLines(svg, x, height, margin) {
    RING_LEVELS.forEach(r => {
      if (r > rMax) return;
      svg.append("line")
        .attr("x1", x(r)).attr("x2", x(r))
        .attr("y1", margin.top).attr("y2", height - margin.bottom)
        .attr("stroke", "#aaa").attr("stroke-dasharray", "2 2").attr("stroke-width", 1);
      svg.append("text")
        .attr("x", x(r)).attr("y", height - margin.bottom + 12)
        .attr("text-anchor", "middle").attr("font-size", 9).attr("fill", "#888")
        .text(`r=${r}`);
    });
  }

  // ψ / π curves, 2016 vs 2023 overlaid
  useEffect(() => {
    const width = 390, height = 200, margin = { top: 16, right: 16, bottom: 36, left: 46 };
    const svg = d3.select(probRef.current).attr("width", width).attr("height", height);
    svg.selectAll("*").remove();
    if (!selectedCity) return;

    const rVals = d3.range(0, rMax + 0.01, rMax / 100);
    const x = d3.scaleLinear().domain([0, rMax]).range([margin.left, width - margin.right]);
    const y = d3.scaleLinear().domain([0, 1]).range([height - margin.bottom, margin.top]);
    svg.append("g").attr("transform", `translate(0,${height - margin.bottom})`).call(d3.axisBottom(x).ticks(5));
    svg.append("g").attr("transform", `translate(${margin.left},0)`).call(d3.axisLeft(y).ticks(4));
    drawRingLines(svg, x, height, margin);

    ["2016", "2023"].forEach(year => {
      const p = year === "2016" ? p2016 : p2023;
      if (p.alpha === undefined) return;
      const psiData = rVals.map(r => ({ r, v: logistic(p.alpha + p.beta * r) }));
      const piData = rVals.map(r => ({ r, v: logistic(p.kappa + p.delta * r) }));
      svg.append("path").datum(psiData)
        .attr("fill", "none").attr("stroke", YEAR_COLOR[year]).attr("stroke-dasharray", "4 3").attr("stroke-width", 2)
        .attr("d", d3.line().x(d => x(d.r)).y(d => y(d.v)));
      svg.append("path").datum(piData)
        .attr("fill", "none").attr("stroke", YEAR_COLOR[year]).attr("stroke-width", 2)
        .attr("d", d3.line().x(d => x(d.r)).y(d => y(d.v)));
    });

    svg.append("line").attr("x1", margin.left + 8).attr("x2", margin.left + 28).attr("y1", margin.top).attr("y2", margin.top)
      .attr("stroke", "#666").attr("stroke-dasharray", "4 3").attr("stroke-width", 2);
    svg.append("text").attr("x", margin.left + 32).attr("y", margin.top + 4).attr("font-size", 10).attr("fill", "#555").text("ψ (dashed)");
    svg.append("line").attr("x1", margin.left + 8).attr("x2", margin.left + 28).attr("y1", margin.top + 14).attr("y2", margin.top + 14)
      .attr("stroke", "#666").attr("stroke-width", 2);
    svg.append("text").attr("x", margin.left + 32).attr("y", margin.top + 18).attr("font-size", 10).attr("fill", "#555").text("π (solid)");
  }, [selectedCity, rMax]);

  // H(r) curve, 2016 vs 2023 overlaid
  useEffect(() => {
    const width = 390, height = 200, margin = { top: 16, right: 16, bottom: 36, left: 46 };
    const svg = d3.select(heightRef.current).attr("width", width).attr("height", height);
    svg.selectAll("*").remove();
    if (!selectedCity) return;

    const rVals = d3.range(0, rMax + 0.01, rMax / 100);
    const series = ["2016", "2023"].map(year => {
      const p = year === "2016" ? p2016 : p2023;
      if (p.A === undefined) return null;
      return { year, data: rVals.map(r => ({ r, H: p.A * Math.exp(p.B * r + p.C * r * r) })) };
    }).filter(Boolean);

    const x = d3.scaleLinear().domain([0, rMax]).range([margin.left, width - margin.right]);
    const maxH = d3.max(series.flatMap(s => s.data.map(d => d.H))) || 1;
    const y = d3.scaleLinear().domain([0, maxH]).nice().range([height - margin.bottom, margin.top]);
    svg.append("g").attr("transform", `translate(0,${height - margin.bottom})`).call(d3.axisBottom(x).ticks(5));
    svg.append("g").attr("transform", `translate(${margin.left},0)`).call(d3.axisLeft(y).ticks(4));
    drawRingLines(svg, x, height, margin);

    series.forEach(s => {
      svg.append("path").datum(s.data)
        .attr("fill", "none").attr("stroke", YEAR_COLOR[s.year]).attr("stroke-width", 2)
        .attr("d", d3.line().x(d => x(d.r)).y(d => y(d.H)));
    });
  }, [selectedCity, rMax]);

  if (!selectedCity) {
    return (
      <div style={{ textAlign: "center", color: "#999", padding: "40px 0" }}>
        Select a city on the map above to see its raw images and parameters.
      </div>
    );
  }

  const meta = imageMeta?.[selectedCity.Name];

  const delta = {
    p_alpha: p2023.psi_at_center - p2016.psi_at_center,
    beta: p2023.beta - p2016.beta,
    p_kappa: p2023.p_at_center - p2016.p_at_center,
    delta: p2023.delta - p2016.delta,
    A: p2023.A - p2016.A,
    B: p2023.B - p2016.B,
    C: p2023.C - p2016.C,
  };

  const th = { borderBottom: "1px solid #333", padding: "4px 8px", fontWeight: "normal" };
  const td = { padding: "3px 8px", textAlign: "center", borderBottom: "1px solid #eee" };

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto" }}>
      <h2 style={{ textAlign: "center" }}>{selectedCity.Name}</h2>
      <p style={{ textAlign: "center", color: "#666" }}>
        {selectedCity.Country} &middot; White rings mark remoteness r = 3, 5, 9 (r = 1000&middot;D<sub>km</sub>/&radic;population)
      </p>

      <div style={{ display: "flex", gap: 32, justifyContent: "center", flexWrap: "wrap", marginTop: 16, alignItems: "flex-start" }}>
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          {["2016", "2023"].map(year => (
            <div key={year} style={{ textAlign: "center" }}>
              <div style={{ fontWeight: "bold", marginBottom: 6, color: YEAR_COLOR[year] }}>{year}</div>
              <div style={{ position: "relative", width: IMG_SIZE, height: IMG_SIZE, background: "#000" }}>
                <img
                  src={imgSrc(selectedCity.Name, year)}
                  alt={`${selectedCity.Name} ${year}`}
                  style={{ width: IMG_SIZE, height: IMG_SIZE, objectFit: "contain" }}
                  onError={e => { e.target.style.opacity = 0.15; }}
                />
                <RemotenessRings meta={meta} popPersons={year === "2016" ? pop2016 : pop2023} size={IMG_SIZE} />
              </div>
            </div>
          ))}
        </div>

        <div style={{ borderLeft: "1px solid #eee", paddingLeft: 32 }}>
          <div style={{ textAlign: "center", fontSize: 12, color: "#666", marginBottom: 6 }}>2016 &harr; 2023</div>
          <AnimatedCityCompare
            cityName={selectedCity.Name}
            meta={meta}
            pop2016={pop2016}
            pop2023={pop2023}
            size={GIF_SIZE}
          />
        </div>
      </div>

      <ColorBandLegend />

      <div style={{ maxWidth: 720, margin: "20px auto 0", fontSize: 12.5, color: "#555", lineHeight: 1.6, textAlign: "left" }}>
        <p style={{ margin: 0 }}>
          Using this remoteness metric, we define the <strong>central area</strong> as r &le; 3,
          the <strong>internal part</strong> as 3 &lt; r &le; 5, the <strong>distant zone</strong> as
          5 &lt; r &le; 9, and the <strong>peri-urban fringe</strong> as r &gt; 9 (Prieto et al., 2025).
          Because population is indexed by year, the same physical distance maps to a different
          remoteness value in 2016 and 2023, in proportion to &radic;(P<sub>2016</sub>/P<sub>2023</sub>).
        </p>
      </div>

      <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap", marginTop: 24 }}>
        <div>
          <div style={{ textAlign: "center", fontSize: 12, color: "#666", marginBottom: 4 }}>ψ / π vs remoteness</div>
          <CurveChart svgRef={probRef} />
        </div>
        <div>
          <div style={{ textAlign: "center", fontSize: 12, color: "#666", marginBottom: 4 }}>H(r) vs remoteness</div>
          <CurveChart svgRef={heightRef} />
        </div>
      </div>

      <div style={{ overflowX: "auto", marginTop: 28 }}>
        <table style={{ borderCollapse: "collapse", margin: "0 auto", fontSize: 13 }}>
          <thead>
            <tr>
              <th style={{ ...th, borderBottom: "none" }}></th>
              <th colSpan={2} style={{ ...th, textAlign: "center", borderBottom: "1px solid #ccc" }}>Horizontal Constraint</th>
              <th colSpan={2} style={{ ...th, textAlign: "center", borderBottom: "1px solid #ccc" }}>Horizontal Construction</th>
              <th colSpan={3} style={{ ...th, textAlign: "center", borderBottom: "1px solid #ccc" }}>Vertical Profile</th>
            </tr>
            <tr>
              <th style={th}>Year</th>
              <th style={th}>p<sub>α</sub></th>
              <th style={th}>β</th>
              <th style={th}>p<sub>κ</sub></th>
              <th style={th}>δ</th>
              <th style={th}>A</th>
              <th style={th}>B</th>
              <th style={th}>C</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ ...td, fontWeight: "bold", color: YEAR_COLOR["2016"] }}>2016</td>
              <td style={td}>{fmtPct(p2016.psi_at_center)}</td>
              <td style={td}>{fmt(p2016.beta)}</td>
              <td style={td}>{fmtPct(p2016.p_at_center)}</td>
              <td style={td}>{fmt(p2016.delta)}</td>
              <td style={td}>{fmt(p2016.A, 2)}</td>
              <td style={td}>{fmt(p2016.B)}</td>
              <td style={td}>{fmt(p2016.C, 4)}</td>
            </tr>
            <tr>
              <td style={{ ...td, fontWeight: "bold", color: YEAR_COLOR["2023"] }}>2023</td>
              <td style={td}>{fmtPct(p2023.psi_at_center)}</td>
              <td style={td}>{fmt(p2023.beta)}</td>
              <td style={td}>{fmtPct(p2023.p_at_center)}</td>
              <td style={td}>{fmt(p2023.delta)}</td>
              <td style={td}>{fmt(p2023.A, 2)}</td>
              <td style={td}>{fmt(p2023.B)}</td>
              <td style={td}>{fmt(p2023.C, 4)}</td>
            </tr>
            <tr>
              <td style={{ ...td, fontWeight: "bold", borderTop: "1px solid #ccc" }}>&Delta;</td>
              <td style={{ ...td, borderTop: "1px solid #ccc" }}>{fmtDelta(delta.p_alpha, 1, true)}</td>
              <td style={{ ...td, borderTop: "1px solid #ccc" }}>{fmtDelta(delta.beta)}</td>
              <td style={{ ...td, borderTop: "1px solid #ccc" }}>{fmtDelta(delta.p_kappa, 1, true)}</td>
              <td style={{ ...td, borderTop: "1px solid #ccc" }}>{fmtDelta(delta.delta)}</td>
              <td style={{ ...td, borderTop: "1px solid #ccc" }}>{fmtDelta(delta.A, 2)}</td>
              <td style={{ ...td, borderTop: "1px solid #ccc" }}>{fmtDelta(delta.B)}</td>
              <td style={{ ...td, borderTop: "1px solid #ccc" }}>{fmtDelta(delta.C, 4)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
