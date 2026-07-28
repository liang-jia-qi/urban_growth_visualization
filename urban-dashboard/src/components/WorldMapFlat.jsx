import { useEffect, useRef } from "react";
import * as d3 from "d3";
import { feature, mesh } from "topojson-client";
import land110m from "world-atlas/land-110m.json";
import countries110m from "world-atlas/countries-110m.json";
import { useStore } from "../store";

const WIDTH = 960;
const HEIGHT = 480;

const CONTINENT_COLOR = {
  Africa: "#e63946",
  Asia: "#f4c542",
  "Latin America": "#3d7ea6",
};

export default function WorldMapFlat() {
  const svgRef = useRef();
  const cityLayerRef = useRef();
  const zoomRef = useRef();
  const { cities, selectedCity, selectCity } = useStore();

  // Build the static geography + city bubbles + zoom behavior once per
  // `cities` load. Re-running this on every selection would tear down and
  // recreate the zoom behavior, snapping the view back to identity — so
  // selection highlighting is handled by a separate effect below instead.
  useEffect(() => {
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const projection = d3.geoNaturalEarth1().fitSize([WIDTH, HEIGHT], { type: "Sphere" });
    const path = d3.geoPath(projection);

    const zoomLayer = svg.append("g");

    zoomLayer.append("path")
      .datum({ type: "Sphere" })
      .attr("d", path)
      .attr("fill", "#f7f7f7")
      .attr("stroke", "#ddd");

    const land = feature(land110m, land110m.objects.land);
    zoomLayer.append("path")
      .datum(land)
      .attr("d", path)
      .attr("fill", "#e2e2e2")
      .attr("stroke", "none");

    const borders = mesh(countries110m, countries110m.objects.countries, (a, b) => a !== b);
    zoomLayer.append("path")
      .datum(borders)
      .attr("d", path)
      .attr("fill", "none")
      .attr("stroke", "#d0d0d0")
      .attr("stroke-width", 0.5);

    const cityLayer = zoomLayer.append("g");
    cityLayerRef.current = cityLayer;

    if (cities && cities.length > 0) {
      const popExtent = d3.extent(cities, d => +d.pop_2016_UN);
      const rScale = d3.scaleSqrt().domain(popExtent).range([2, 18]);

      const nodes = cityLayer.selectAll("g.city-node")
        .data(cities)
        .join("g")
        .attr("class", "city-node")
        .attr("transform", d => {
          const p = projection([+d["Cx(lon)"], +d["Cy(lat)"]]);
          return p ? `translate(${p[0]},${p[1]})` : null;
        })
        .style("cursor", "pointer")
        .on("click", (_, d) => selectCity(d));

      nodes.append("circle")
        .attr("r", d => rScale(+d.pop_2016_UN))
        .attr("fill", d => CONTINENT_COLOR[d.continent] || "#888")
        .attr("fill-opacity", 0.75)
        .attr("stroke", "#fff")
        .attr("stroke-width", 0.6);

      nodes.append("title").text(d => d.Name);
    }

    const zoom = d3.zoom()
      .scaleExtent([1, 20])
      .translateExtent([[0, 0], [WIDTH, HEIGHT]])
      .on("zoom", (event) => {
        zoomLayer.attr("transform", event.transform);
        cityLayer.selectAll("circle").each(function (d) {
          const isSel = zoomRef.current?.selectedName === d.Name;
          d3.select(this).attr("stroke-width", (isSel ? 1.6 : 0.6) / event.transform.k);
        });
      });

    zoomRef.current = { zoom, k: 1, selectedName: null };
    svg.call(zoom);
  }, [cities]);

  // Highlight the selected city without touching the zoom/pan transform.
  useEffect(() => {
    if (!cityLayerRef.current) return;
    if (zoomRef.current) zoomRef.current.selectedName = selectedCity?.Name ?? null;
    const currentK = d3.zoomTransform(svgRef.current).k || 1;
    cityLayerRef.current.selectAll("circle")
      .attr("stroke", d => (selectedCity?.Name === d.Name ? "#000" : "#fff"))
      .attr("stroke-width", d => (selectedCity?.Name === d.Name ? 1.6 : 0.6) / currentK);
  }, [selectedCity]);

  return (
    <div style={{ display: "flex", gap: 20, maxWidth: 1240, margin: "0 auto", alignItems: "flex-start" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          style={{ width: "100%", height: "auto", background: "#fff", border: "1px solid #eee" }}
        />
        <div style={{ display: "flex", justifyContent: "center", gap: 20, marginTop: 8, fontSize: 12, color: "#555" }}>
          {Object.entries(CONTINENT_COLOR).map(([name, color]) => (
            <span key={name} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: color, display: "inline-block" }} />
              {name}
            </span>
          ))}
        </div>
        <p style={{ textAlign: "center", color: "#888", fontSize: 13, marginTop: 4 }}>
          Click a city to view its raw building images below. Scroll to zoom, drag to pan.
        </p>
      </div>

      <CityInfoCard city={selectedCity} />
    </div>
  );
}

function CityInfoCard({ city }) {
  const box = {
    width: 240,
    minHeight: 260,
    flexShrink: 0,
    border: "1px solid #e0e0e0",
    borderRadius: 6,
    padding: "16px 18px",
    background: "#fafafa",
    fontSize: 13,
  };

  if (!city) {
    return (
      <div style={box}>
        <p style={{ color: "#999", margin: 0 }}>Click a city bubble to see its details here.</p>
      </div>
    );
  }

  const pop2016 = Math.round((+city.pop_2016_UN || 0) * 1000);
  const pop2023 = Math.round((+city.pop_2023_UN || 0) * 1000);
  const row = { display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid #eee" };

  return (
    <div style={box}>
      <h3 style={{ margin: "0 0 10px", fontSize: 17 }}>{city.Name}</h3>
      <div style={row}><span style={{ color: "#666" }}>Country</span><span>{city.Country}</span></div>
      <div style={row}><span style={{ color: "#666" }}>Continent</span><span>{city.continent}</span></div>
      <div style={row}><span style={{ color: "#666" }}>Population 2016</span><span>{pop2016.toLocaleString()}</span></div>
      <div style={{ ...row, borderBottom: "none" }}><span style={{ color: "#666" }}>Population 2023</span><span>{pop2023.toLocaleString()}</span></div>
    </div>
  );
}
