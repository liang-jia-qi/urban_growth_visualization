import { useStore } from "../store";

export default function CityInfoPanel() {
  const { selectedCity } = useStore();
  if (!selectedCity) return null;

  // 按年份组织的参数
  const params2016 = selectedCity.params?.["2016"] || {};
  const params2023 = selectedCity.params?.["2023"] || {};

  // 参数顺序和标签
  const paramNames = ["alpha", "beta", "kappa", "delta", "A", "B", "C"];
  const paramLabels = { alpha: "α", beta: "β", kappa: "κ", delta: "δ", A: "A", B: "B", C: "C" };


  // 辅助函数：四舍五入三位
  const round3 = (v) => (v !== undefined ? v.toFixed(3) : "-");

  return (
    <div style={{ width: "30%", padding: "20px", borderRight: "1px solid #ccc" }}>
      <h2>{selectedCity.Name}</h2>
      <p><strong>Country:</strong> {selectedCity.Country}</p>
      <p><strong>Continent:</strong> {selectedCity.continent}</p>
      <p><strong>Population 2016 (million):</strong> {round3(selectedCity.pop_2016_UN/1000)}</p>
      <p><strong>Population 2023 (million):</strong> {round3(selectedCity.pop_2023_UN/1000)}</p>
      <hr/>
      <h3>Parameters</h3>

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ borderBottom: "1px solid #ccc", textAlign: "left" }}>Parameter</th>
            <th style={{ borderBottom: "1px solid #ccc", color: "#f93a2e", fontWeight: "bold" }}>2016</th>
            <th style={{ borderBottom: "1px solid #ccc", color: "#2ab421", fontWeight: "bold" }}>2023</th>
          </tr>
        </thead>
        <tbody>
          {paramNames.map((key) => (
            <tr key={key}>
              <td style={{ padding: "4px 8px", borderBottom: "1px solid #eee" }}>
                {paramLabels[key]}
              </td>
              <td style={{ textAlign: "center", borderBottom: "1px solid #eee" }}>
                {round3(params2016[key])}
              </td>
              <td style={{ textAlign: "center", borderBottom: "1px solid #eee" }}>
                {round3(params2023[key])}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
