// ============================
// Canvas setup
// ============================

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight - 50;
}
window.addEventListener("resize", resize);
resize();

const cx = canvas.width / 2;
const cy = canvas.height / 2;

// ============================
// Hex grid parameters
// ============================

const HEX_SIZE = 10;
const R_MAX = 25;
const GRID = [];

// ============================
// Math helpers
// ============================

function axialToWorld(q, r) {
  const x = HEX_SIZE * (Math.sqrt(3) * q + Math.sqrt(3) / 2 * r);
  const y = HEX_SIZE * (3 / 2 * r);
  return { x, y };
}

function axialDistance(q, r) {
  return (Math.abs(q) + Math.abs(r) + Math.abs(-q - r)) / 2;
}

function hash(q, r) {
  const s = Math.sin(q * 127.1 + r * 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

function psi(r_norm, alpha, beta) {
  return 1 / (1 + Math.exp(-(alpha + beta * r_norm)));
}

// ============================
// Grid generation (once)
// ============================

for (let q = -R_MAX; q <= R_MAX; q++) {
  for (let r = -R_MAX; r <= R_MAX; r++) {
    const d = axialDistance(q, r);
    if (d > R_MAX) continue;

    const { x, y } = axialToWorld(q, r);

    GRID.push({
      q,
      r,
      x,
      y,
      r_norm: d / R_MAX,
      u: hash(q, r),
      buildable: false
    });
  }
}

// ============================
// Rendering
// ============================

function drawHex(x, y, size) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = Math.PI / 180 * (60 * i - 30);
    const px = x + size * Math.cos(angle);
    const py = y + size * Math.sin(angle);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function updateBuildability(alpha, beta) {
  GRID.forEach(hex => {
    const p = psi(hex.r_norm, alpha, beta);
    hex.buildable = hex.u > p;
  });
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  GRID.forEach(hex => {
    drawHex(hex.x + cx, hex.y + cy, HEX_SIZE * 0.95);

    if (hex.buildable) {
      ctx.fillStyle = "#777";
    } else {
      ctx.fillStyle = "#eee";
    }
    ctx.fill();
  });
}

// ============================
// UI wiring
// ============================

const alphaSlider = document.getElementById("alpha");
const betaSlider = document.getElementById("beta");
const alphaVal = document.getElementById("alphaVal");
const betaVal = document.getElementById("betaVal");

let alpha = parseFloat(alphaSlider.value);
let beta = parseFloat(betaSlider.value);

function update() {
  updateBuildability(alpha, beta);
  render();
}

alphaSlider.addEventListener("input", e => {
  alpha = parseFloat(e.target.value);
  alphaVal.textContent = alpha.toFixed(2);
  update();
});

betaSlider.addEventListener("input", e => {
  beta = parseFloat(e.target.value);
  betaVal.textContent = beta.toFixed(2);
  update();
});

// Initial draw
update();
