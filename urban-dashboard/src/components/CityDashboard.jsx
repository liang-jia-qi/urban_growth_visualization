import { useStore } from "../store";
import CityInfoPanel from "./CityInfoPanel";
import AnalysisPanel from "./AnalysisPanel";

export default function CityDashboard() {
  const activeView = useStore(state => state.activeView);
  const clearSelectedCity = useStore(state => state.clearSelectedCity);

  if (activeView === "parameter") return null; // ParameterPage 已经由 App 控制渲染

  return (
    <>
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
        {/* 返回地图按钮 */}
        <div
          onClick={clearSelectedCity}
          style={{
            position: "absolute",
            top: 12,
            left: 12,
            cursor: "pointer",
            fontSize: "18px",
            fontWeight: "bold",
            zIndex: 20,
            padding: "6px 10px",
            background: "#fff",
            border: "1px solid #ccc",
            borderRadius: 4
          }}
        >
          ← Back to Map
        </div>

        <CityInfoPanel />
        <AnalysisPanel />
      </div>
    </>
  );
}
