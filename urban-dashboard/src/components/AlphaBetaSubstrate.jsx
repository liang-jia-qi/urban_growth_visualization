import { useEffect, useRef } from "react";

const HEX_SIZE = 10;
const R_MAX = 25;

function axialToWorld(q, r) {
  return {
    x: HEX_SIZE * (Math.sqrt(3) * q + Math.sqrt(3) / 2 * r),
    y: HEX_SIZE * (3 / 2 * r)
  };
}

function axialDistance(q, r) {
  return (Math.abs(q) + Math.abs(r) + Math.abs(-q - r)) / 2;
}

function hash(q, r) {
  const s = Math.sin(q * 127.1 + r * 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

function psi(r, alpha, beta) {
  return 1 / (1 + Math.exp(-(alpha + beta * r)));
}

export default function AlphaBetaSubstrate({ alpha, beta }) {
  const canvasRef = useRef();
  const gridRef = useRef([]);

  // 初始化网格（只一次）
  useEffect(() => {
    const grid = [];
    for (let q = -R_MAX; q <= R_MAX; q++) {
      for (let r = -R_MAX; r <= R_MAX; r++) {
        const d = axialDistance(q, r);
        if (d > R_MAX) continue;

        const { x, y } = axialToWorld(q, r);
        grid.push({
          x,
          y,
          r_norm: d / R_MAX,
          u: hash(q, r)
        });
      }
    }
    gridRef.current = grid;
  }, []);

  // 每次 α β 变化 → 重画
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;

    const cx = canvas.width / 2;
    const cy = canvas.height / 2;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    gridRef.current.forEach(h => {
      const p = psi(h.r_norm, alpha, beta);
      const buildable = h.u > p;

      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = Math.PI / 180 * (60 * i - 30);
        const px = cx + h.x + HEX_SIZE * Math.cos(angle);
        const py = cy + h.y + HEX_SIZE * Math.sin(angle);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();

      ctx.fillStyle = buildable ? "#777" : "#eee";
      ctx.fill();
    });
  }, [alpha, beta]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: "100%", height: "100%" }}
    />
  );
}
