import { useStore } from "../store";
import { useState, useMemo } from "react";

export default function ParameterPage() {
  const { setActiveView } = useStore();

  // 初始 α、β
  const [alpha, setAlpha] = useState(0.5);
  const [beta, setBeta] = useState(-0.2);

  const gridSize = 20; // 六边形行列数
  const hexRadius = 15; // hex 半径像素

  // ψ 函数: ψ = 1 / (1 + exp(-(α + β*r)))
  const psi = (r) => 1 / (1 + Math.exp(-(alpha + beta * r)));

  // 生成六边形网格坐标
  const hexes = useMemo(() => {
    const result = [];
    for (let row = 0; row < gridSize; row++) {
      for (let col = 0; col < gridSize; col++) {
        // 每行错列半个 hexRadius
        const x = col * hexRadius * 1.5;
        const y = row * Math.sqrt(3) * hexRadius + (col % 2) * Math.sqrt(3) * hexRadius / 2;
        result.push({ x, y });
      }
    }
    return result;
  }, [gridSize, hexRadius]);

  return (
    <div style={{ width: "100%", height: "100%", position: "relative", background: "#f7f7f7", padding: 24 }}>
      {/* 返回按钮 */}
      <button
        onClick={() => setActiveView("map")}
        style={{ position: "absolute", top: 16, left: 16, padding: "8px 12px" }}
      >
        ← Back to Map
      </button>

      <h2>Parameter Model</h2>
      <div style={{ marginTop: 16 }}>
        <label>
          α: {alpha.toFixed(2)}
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={alpha}
            onChange={(e) => setAlpha(parseFloat(e.target.value))}
          />
        </label>
        <br />
        <label>
          β: {beta.toFixed(2)}
          <input
            type="range"
            min="-0.7"
            max="0"
            step="0.01"
            value={beta}
            onChange={(e) => setBeta(parseFloat(e.target.value))}
          />
        </label>
      </div>

      {/* 六边形基底 */}
      <svg width="100%" height="500" style={{ marginTop: 24, border: "1px solid #ccc" }}>
        {hexes.map((hex, idx) => {
          // 计算相对 r 值：中心点在 grid 中心
          const centerX = (gridSize - 1) * hexRadius * 1.5 / 2;
          const centerY = (gridSize - 1) * Math.sqrt(3) * hexRadius / 2;
          const dx = hex.x - centerX;
          const dy = hex.y - centerY;
          const r = Math.sqrt(dx * dx + dy * dy) / 50; // 放缩 r

          // 根据 ψ 决定填色概率
          const fill = Math.random() < psi(r) ? "#3498db" : "#eee";

          // 六边形点
          const points = Array.from({ length: 6 }, (_, i) => {
            const angle = Math.PI / 3 * i;
            const x = hex.x + hexRadius * Math.cos(angle);
            const y = hex.y + hexRadius * Math.sin(angle);
            return `${x},${y}`;
          }).join(" ");

          return <polygon key={idx} points={points} fill={fill} stroke="#ccc" strokeWidth="1" />;
        })}
      </svg>
    </div>
  );
}
