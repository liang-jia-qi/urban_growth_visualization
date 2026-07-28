import { useEffect } from "react";
import * as d3 from "d3";
import { useStore } from "./store";
import RawImagesPage from "./components/RawImagesPage";
import ParameterPage from "./components/ParameterPage";

const tabBarStyle = {
  display: "flex",
  gap: 8,
  padding: "10px 16px",
  borderBottom: "1px solid #ddd",
  background: "#fafafa",
};

function tabButtonStyle(active) {
  return {
    padding: "8px 16px",
    border: "1px solid #ccc",
    borderRadius: 6,
    background: active ? "#333" : "#fff",
    color: active ? "#fff" : "#333",
    cursor: "pointer",
    fontWeight: active ? "bold" : "normal",
  };
}

export default function App() {
  const { setCities, setZib, setHeight, activeTab, setActiveTab } = useStore();

  useEffect(() => {
    d3.csv("/data/CitiesDB_new.csv").then(data => {
      data.forEach(d => {
        d["Cx(lon)"] = +d["Cx(lon)"];
        d["Cy(lat)"] = +d["Cy(lat)"];
        d.pop_2016_UN = +d.pop_2016_UN;
        d.pop_2023_UN = +d.pop_2023_UN;
      });
      console.log("Cities loaded:", data.length);
      setCities(data);
    });

    d3.csv("/data/zib_fitting_results_new.csv").then(data => {
      data.forEach(d => {
        d.alpha = +d.alpha;
        d.beta = +d.beta;
        d.kappa = +d.kappa;
        d.delta = +d.delta;
        d.psi_at_center = +d.psi_at_center;
        d.p_at_center = +d.p_at_center;
      });
      setZib(data);
    });

    d3.csv("/data/height_fitting_results_new.csv").then(data => {
      data.forEach(d => {
        d.A = +d.A;
        d.B = +d.B;
        d.C = +d.C;
      });
      setHeight(data);
    });
  }, []);

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      <div style={tabBarStyle}>
        <button style={tabButtonStyle(activeTab === "raw")} onClick={() => setActiveTab("raw")}>
          Raw Images & Comparison
        </button>
        <button style={tabButtonStyle(activeTab === "model")} onClick={() => setActiveTab("model")}>
          City Parameter 3D Model
        </button>
      </div>

      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        {activeTab === "raw" && <RawImagesPage />}
        {activeTab === "model" && <ParameterPage />}
      </div>
    </div>
  );
}
