import { useStore } from "../store";
import CityInfoPanel from "./CityInfoPanel";
import AnalysisPanel from "./AnalysisPanel";
import MapView from "./MapView";
import ParameterPage from "./ParameterPage";

export default function CityDashboard() {
  const activeView = useStore(state => state.activeView); // 🔹 修正这里

  if (activeView === "parameter") return <ParameterPage />;

  return (
    <>
      <MapView />
      <div
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          width: "80%",
          height: "100%",
          display: "flex",
          background: "white",
          boxShadow: "-2px 0 6px rgba(0,0,0,0.15)",
          zIndex: 10
        }}
      >
        <CityInfoPanel />
        <AnalysisPanel />
      </div>
    </>
  );
}
