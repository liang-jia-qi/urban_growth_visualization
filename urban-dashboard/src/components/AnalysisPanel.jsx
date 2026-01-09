import { useStore } from "../store";
import ZIB_Curve from "./charts/ZIB_Curve";
import Height_Curve from "./charts/Height_Curve";
import { CumulativeVolumeCurve,ExpectedVolumeCurve } from "./charts/Volume_Curve";

export default function AnalysisPanel() {
  const selectedCity = useStore(state => state.selectedCity);

  if (!selectedCity || !selectedCity.params) return null;

  const params2016 = selectedCity.params["2016"];
  const params2023 = selectedCity.params["2023"];
  const maxR = params2016?.remoteness_range || 50;

  return (
    <div style={{ width: "70%", padding: "20px", overflowY: "auto" }}>
      <h3>Analysis – {selectedCity.Name}</h3>

      {/* ZIB 曲线 */}
      <div style={{ display: "flex", gap: "20px" }}>
        <div style={{ flex: 1 }}>
          <h4>ψ(r) - Structural Zero Probability</h4>
          <ZIB_Curve
            type="psi"
            params2016={params2016}
            params2023={params2023}
            color2016="#f93a2e"
            color2023="#2ab421"
            opacity2016={0.6}
            opacity2023={0.6}
            maxR={maxR}
          />
        </div>
        <div style={{ flex: 1 }}>
          <h4>π(r) - Non-zero Construction Probability</h4>
          <ZIB_Curve
            type="pi"
            params2016={params2016}
            params2023={params2023}
            color2016="#f93a2e"
            color2023="#2ab421"
            opacity2016={0.6}
            opacity2023={0.6}
            maxR={maxR}
          />
        </div>
      </div>

      {/* Height 曲线 */}
      <div style={{ display: "flex", flexDirection: "column", gap: "20px", marginTop: "20px" }}>
        <h4>Average Height H(r) - Polynomial Exponential Model</h4>
        <Height_Curve
          params2016={params2016}
          params2023={params2023}
          color2016="#f93a2e"
          color2023="#2ab421"
          opacity2016={0.6}
          opacity2023={0.6}
          maxR={maxR}
        />
      </div>


      <div style={{ display: "flex", gap: "20px", marginTop: "20px" }}>
        <div style={{ flex: 1 }}>
          <h4>Expected Volume V(r)</h4>
          <ExpectedVolumeCurve
            params2016={params2016}
            params2023={params2023}
            maxR={params2016?.remoteness_range || 50}
          />
        </div>
        <div style={{ flex: 1 }}>
          <h4>Cumulative Volume V_cum(r)</h4>
          <CumulativeVolumeCurve
            params2016={params2016}
            params2023={params2023}
            maxR={params2016?.remoteness_range || 50}
          />
        </div>
      </div>


      <div style={{ height: "260px", background: "#f0f0f0", marginTop: "12px" }}>
        City 3D Cakes
      </div>
    </div>
  );
}
