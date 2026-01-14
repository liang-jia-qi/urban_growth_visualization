import { useEffect } from "react";
import * as d3 from "d3";
import { useStore } from "./store";
import MapView from "./components/MapView";
import CityDashboard from "./components/CityDashboard";
import ParameterPage from "./components/ParameterPage";
import "mapbox-gl/dist/mapbox-gl.css";

export default function App() {
  const { setCities, setZib, setHeight, selectedCity, activeView } = useStore();

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
    <>
      {activeView === "map" && <MapView />}
      {activeView === "parameter" && <ParameterPage />}

      {/* 仅在地图视图且有选中城市时显示 CityDashboard */}
      {activeView === "map" && selectedCity && <CityDashboard />}
    </>
  );
}
