import mapboxgl from "mapbox-gl";
import { useEffect, useRef } from "react";
import { useStore } from "../store";

mapboxgl.accessToken = "pk.eyJ1IjoiYXByaWwtbGlhbmciLCJhIjoiY21rMWJyNmFrMDR3ODNmcXl2NHhzdm1iMCJ9.AhbROgGnJrE06BP0dOt0Tg";

export default function MapView() {
  const mapRef = useRef();
  const { cities, selectCity, setActiveView } = useStore();

  useEffect(() => {
    const map = new mapboxgl.Map({
      container: mapRef.current,
      style: "mapbox://styles/mapbox/light-v11",
      center: [0, 20],
      zoom: 1.5,
    });

    map.on("load", () => {
      if (!cities || cities.length === 0) return;

      map.getStyle().layers.forEach(layer => {
        if (layer.type === "symbol") map.setLayoutProperty(layer.id, "visibility", "none");
      });

      const geojson = {
        type: "FeatureCollection",
        features: cities.map(d => ({
          type: "Feature",
          properties: { ...d, pop_2016_UN: +d.pop_2016_UN },
          geometry: { type: "Point", coordinates: [+d["Cx(lon)"], +d["Cy(lat)"]] }
        }))
      };

      map.addSource("cities", { type: "geojson", data: geojson });

      const pops = geojson.features.map(f => f.properties.pop_2016_UN);
      const popMin = Math.min(...pops);
      const popMax = Math.max(...pops);

      map.addLayer({
        id: "city-points",
        type: "circle",
        source: "cities",
        paint: {
          "circle-color": "#678",
          "circle-opacity": 0.7,
          "circle-radius": ["interpolate", ["linear"], ["get", "pop_2016_UN"], popMin, 4, popMax, 20]
        }
      });

      map.addLayer({
        id: "city-labels",
        type: "symbol",
        source: "cities",
        layout: { "text-field": ["get", "Name"], "text-size": 12, "text-anchor": "top", "text-offset": [0, 0.8] },
        paint: { "text-color": "#222" }
      });

      map.on("click", "city-points", e => selectCity(e.features[0].properties));
    });

    return () => map.remove();
  }, [cities]);

  return (
    <>
      <div ref={mapRef} style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }} />

      {/* Parameter Model 按钮 */}
      <button
        style={{
          position: "absolute",
          top: 16,
          right: 16,
          zIndex: 2000,
          padding: "8px 12px",
          background: "#fff",
          border: "1px solid #ccc",
          cursor: "pointer"
        }}
        onClick={() => setActiveView("parameter")}
      >
        Parameter Model
      </button>
    </>
  );
}