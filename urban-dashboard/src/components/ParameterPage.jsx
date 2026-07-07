import { useEffect, useRef, useState } from "react";
import { useStore } from "../store";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import * as d3 from "d3";

// Shared note style
const Note = ({ children }) => (
  <div style={{ fontSize:11, color:"#666", marginTop:2, marginBottom:6, lineHeight:1.5 }}>
    {children}
  </div>
);

export default function ParameterPage() {
  const { setActiveView, selectedCity } = useStore();

  // ── Model params ─────────────────────────────────────────────
  const [alpha, setAlpha] = useState(0.5);
  const [beta,  setBeta]  = useState(-0.1);
  const [kappa, setKappa] = useState(0.3);
  const [delta, setDelta] = useState(0.05);
  const [A, setA] = useState(7.58);
  const [B, setB] = useState(-0.08);
  const [C, setC] = useState(0.0);

  // ── Display controls ─────────────────────────────────────────
  const [opacity,     setOpacity]     = useState(0.85);
  const [heightScale, setHeightScale] = useState(2.0);
  const [showRings,   setShowRings]   = useState(true);
  const [showFlat,    setShowFlat]    = useState(false);

  // ── Data ─────────────────────────────────────────────────────
  const [citiesDB, setCitiesDB] = useState([]);
  const [heightDB, setHeightDB] = useState([]);
  const [zibDB,    setZibDB]    = useState([]);

  const [continent,    setContinent]    = useState("");
  const [city,         setCity]         = useState("");
  const [year,         setYear]         = useState("");
  const [continentCity, setContinentCity] = useState("");

  // ── Refs ──────────────────────────────────────────────────────
  const threeRef    = useRef();
  const curveRef    = useRef();
  const probCurveRef = useRef();

  // ── Utility ──────────────────────────────────────────────────
  const logistic = x => 1 / (1 + Math.exp(-x));
  const psi = r => logistic(alpha + beta * r);
  const pi  = r => logistic(kappa + delta * r);

  // ── CSV load ──────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      d3.csv("/data/CitiesDB_new.csv"),
      d3.csv("/data/height_fitting_results_new.csv"),
      d3.csv("/data/zib_fitting_results_new.csv"),
    ]).then(([cities, height, zib]) => {
      setCitiesDB(cities);
      setHeightDB(height);
      setZibDB(zib);
    });
  }, []);

  // ── Derived options ───────────────────────────────────────────
  const continents = Array.from(new Set(citiesDB.map(d => d.continent)));
  const cities = citiesDB
    .filter(d => !continent || d.continent === continent)
    .map(d => d.Name);
  const years = Array.from(
    new Set(heightDB.filter(d => !city || d.city === city).map(d => d.year))
  ).sort();

  // ── Apply params from data ────────────────────────────────────
  const applyParametersFromData = (c, y) => {
    const h = heightDB.find(d => d.city === c && +d.year === +y);
    const z = zibDB.find(d => d.city === c && +d.year === +y);
    if (!h || !z) return;
    setA(+h.A); setB(+h.B); setC(+h.C);
    setAlpha(+z.alpha); setBeta(+z.beta);
    setKappa(+z.kappa); setDelta(+z.delta);
    setContinentCity("");
  };

  // ── Average-city params ───────────────────────────────────────
  const getAverageParameters = cont => {
    const names = citiesDB.filter(c => c.continent === cont).map(c => c.Name);
    const heights = heightDB.filter(d => names.includes(d.city));
    const zibs    = zibDB.filter(d => names.includes(d.city));
    if (!heights.length || !zibs.length) return null;
    return {
      A: d3.mean(heights, d => +d.A), B: d3.mean(heights, d => +d.B), C: d3.mean(heights, d => +d.C),
      alpha: d3.mean(zibs, d => +d.alpha), beta:  d3.mean(zibs, d => +d.beta),
      kappa: d3.mean(zibs, d => +d.kappa), delta: d3.mean(zibs, d => +d.delta),
    };
  };

  // ── H(r) curve ────────────────────────────────────────────────
  useEffect(() => {
    const width = 390, height = 200, margin = { top:16, right:16, bottom:36, left:46 };
    const svg = d3.select(curveRef.current).attr("width", width).attr("height", height);
    svg.selectAll("*").remove();
    const rVals = d3.range(0, 10.01, 0.1);
    const data = rVals.map(r => ({ r, H: A * Math.exp(B*r + C*r*r) }));
    const x = d3.scaleLinear().domain([0,10]).range([margin.left, width-margin.right]);
    const y = d3.scaleLinear().domain([0, d3.max(data, d => d.H)]).nice().range([height-margin.bottom, margin.top]);
    svg.append("g").attr("transform",`translate(0,${height-margin.bottom})`).call(d3.axisBottom(x).ticks(5));
    svg.append("g").attr("transform",`translate(${margin.left},0)`).call(d3.axisLeft(y).ticks(4));
    svg.append("path").datum(data)
      .attr("fill","none").attr("stroke","#D3B472").attr("stroke-width",2)
      .attr("d", d3.line().x(d=>x(d.r)).y(d=>y(d.H)));
  }, [A, B, C]);

  // ── ψ / π curves ─────────────────────────────────────────────
  useEffect(() => {
    const width = 390, height = 200, margin = { top:16, right:16, bottom:36, left:46 };
    const svg = d3.select(probCurveRef.current).attr("width", width).attr("height", height);
    svg.selectAll("*").remove();
    const rVals = d3.range(0, 10.01, 0.1);
    const data = rVals.map(r => ({ r, psi: psi(r), pi: pi(r) }));
    const x = d3.scaleLinear().domain([0,10]).range([margin.left, width-margin.right]);
    const y = d3.scaleLinear().domain([0,1]).range([height-margin.bottom, margin.top]);
    svg.append("g").attr("transform",`translate(0,${height-margin.bottom})`).call(d3.axisBottom(x).ticks(5));
    svg.append("g").attr("transform",`translate(${margin.left},0)`).call(d3.axisLeft(y).ticks(4));
    svg.append("path").datum(data)
      .attr("fill","none").attr("stroke","#8472D3").attr("stroke-dasharray","4 3").attr("stroke-width",2)
      .attr("d", d3.line().x(d=>x(d.r)).y(d=>y(d.psi)));
    svg.append("path").datum(data)
      .attr("fill","none").attr("stroke","#D3B472").attr("stroke-width",2)
      .attr("d", d3.line().x(d=>x(d.r)).y(d=>y(d.pi)));
    // Legend inside chart
    svg.append("line").attr("x1",margin.left+8).attr("x2",margin.left+28).attr("y1",margin.top+8).attr("y2",margin.top+8)
      .attr("stroke","#8472D3").attr("stroke-dasharray","4 3").attr("stroke-width",2);
    svg.append("text").attr("x",margin.left+32).attr("y",margin.top+12).attr("font-size",10).attr("fill","#555").text("ψ (struct. zero)");
    svg.append("line").attr("x1",margin.left+8).attr("x2",margin.left+28).attr("y1",margin.top+22).attr("y2",margin.top+22)
      .attr("stroke","#D3B472").attr("stroke-width",2);
    svg.append("text").attr("x",margin.left+32).attr("y",margin.top+26).attr("font-size",10).attr("fill","#555").text("π (build prob.)");
  }, [alpha, beta, kappa, delta]);

  // ── 3D scene ──────────────────────────────────────────────────
  const cityRandomMapRef = useRef({});
  const getCityRandomMap = (name, N) => {
    if (!cityRandomMapRef.current[name]) {
      cityRandomMapRef.current[name] = {
        psiMap: Array.from({length:N}, () => Array.from({length:N}, () => Math.random())),
        piMap:  Array.from({length:N}, () => Array.from({length:N}, () => Math.random())),
      };
    }
    return cityRandomMapRef.current[name];
  };

  useEffect(() => {
    if (!city && !continentCity) return;

    threeRef.current.innerHTML = "";
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff);

    const container = threeRef.current;
    const w = container.clientWidth  || window.innerWidth - 460;
    const h = container.clientHeight || window.innerHeight;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(w, h);
    container.appendChild(renderer.domElement);

    const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 2000);
    camera.position.set(50, 70, 70);
    camera.lookAt(0, 0, 0);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const sun = new THREE.DirectionalLight(0xffffff, 1.0);
    sun.position.set(50, 100, 40);
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0xffffff, 0.3);
    fill.position.set(-40, 30, -20);
    scene.add(fill);

    // Adaptive rMax: where ψ(r) = 0.95
    const logit95 = Math.log(0.95 / 0.05);
    const rMax = beta > 0.01
      ? Math.min(12, Math.max(5, (logit95 - alpha) / beta))
      : 10;

    const N = 70, size = 1, center = N / 2;

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(N+2, N+2),
      new THREE.MeshStandardMaterial({ color: 0xd6dde6 })
    );
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);

    // Shared random map keyed by city (same layout across years)
    const mapName = continentCity ? "concept_" + continentCity : city;
    const { psiMap, piMap } = getCityRandomMap(mapName, N);

    // Look up 2016 baseline for temporal comparison
    const lg = x => 1 / (1 + Math.exp(-x));
    let isComparing = !continentCity && city && year && +year !== 2016;
    let psi16 = r => lg(alpha + beta * r);
    let pi16  = r => lg(kappa + delta * r);
    if (isComparing) {
      const z16 = zibDB.find(d => d.city === city && +d.year === 2016);
      if (z16) {
        const [a16, b16, k16, d16] = [+z16.alpha, +z16.beta, +z16.kappa, +z16.delta];
        psi16 = r => lg(a16 + b16 * r);
        pi16  = r => lg(k16 + d16 * r);
      } else {
        isComparing = false;
      }
    }

    const Hcenter = A * Math.exp(B*0 + C*0);
    const Hedge   = A * Math.exp(B*rMax + C*rMax*rMax);
    const Hmax = Math.max(Hcenter, Hedge, 0.01);
    const Hmin = Math.min(Hcenter, Hedge);

    // Colors
    const C_STRUCT  = new THREE.Color(0x8472D3); // purple — structural zero
    const C_BUILD_L = new THREE.Color(0xD3B472); // tan/gold — building (low)
    const C_BUILD_H = new THREE.Color(0x7a5c1e); // dark gold — building (tall)
    const C_NEW     = new THREE.Color(0xe07b39); // orange — new since 2016
    const C_BUILDABLE = 0xffffff;                // white — buildable, not built

    const flatTile = (x, z, color, op) => {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(size*0.92, size*0.92),
        new THREE.MeshStandardMaterial({ color, transparent: true, opacity: op })
      );
      m.rotation.x = -Math.PI / 2;
      m.position.set(x, 0.01, z);
      scene.add(m);
    };

    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        const dx = i - center, dz = j - center;
        const r = Math.sqrt(dx*dx + dz*dz) / center * rMax;
        if (r > rMax) continue;

        const isStructZeroNow  = psiMap[i][j] < psi(r);
        const isStructZeroBase = psiMap[i][j] < psi16(r);

        if (isStructZeroNow) {
          flatTile(dx, dz, C_STRUCT, 0.7);
          continue;
        }

        const builtInBase    = !isStructZeroBase && piMap[i][j] < pi16(r);
        const builtInCurrent = piMap[i][j] < pi(r);

        if (!showFlat && (builtInCurrent || builtInBase)) {
          const Hraw  = A * Math.exp(B*r + C*r*r);
          const Hdisp = Hraw * heightScale;
          const isNew = isComparing && !builtInBase;
          const t = Hmax > Hmin ? (Hraw - Hmin) / (Hmax - Hmin) : 0.5;
          const col3 = isNew ? C_NEW.clone() : C_BUILD_L.clone().lerp(C_BUILD_H, t);
          const mesh = new THREE.Mesh(
            new THREE.BoxGeometry(size*0.85, Hdisp, size*0.85),
            new THREE.MeshStandardMaterial({ color: col3, transparent: true, opacity })
          );
          mesh.position.set(dx, Hdisp / 2, dz);
          scene.add(mesh);
        } else {
          flatTile(dx, dz, C_BUILDABLE, 0.9);
        }
      }
    }

    // Radial markers (grey, toggled by showRings)
    if (showRings) {
      const RING_COLOR = 0x111111;

      // Center dot
      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(0.7, 16, 16),
        new THREE.MeshStandardMaterial({ color: RING_COLOR, emissive: RING_COLOR, emissiveIntensity: 0.3 })
      );
      dot.position.set(0, 0.7, 0);
      scene.add(dot);

      // r=3 and r=9 rings
      [3, 9].forEach(r_model => {
        const wr = (r_model / rMax) * center;
        if (wr >= center) return;
        const pts = [];
        for (let a = 0; a <= Math.PI*2 + 0.01; a += 0.04)
          pts.push(new THREE.Vector3(Math.cos(a)*wr, 0.15, Math.sin(a)*wr));
        scene.add(new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(pts),
          new THREE.LineBasicMaterial({ color: RING_COLOR })
        ));
      });
    }

    let animId;
    const animate = () => { animId = requestAnimationFrame(animate); controls.update(); renderer.render(scene, camera); };
    animate();
    return () => { cancelAnimationFrame(animId); renderer.dispose(); };
  }, [alpha, beta, kappa, delta, A, B, C, city, year, continentCity, opacity, heightScale, showRings, showFlat, zibDB]);

  // ── Layout ───────────────────────────────────────────────────
  const swatch = color => (
    <span style={{ display:"inline-block", width:10, height:10, background:color,
      borderRadius:2, border:"1px solid #ccc", marginRight:4, verticalAlign:"middle" }} />
  );

  return (
    <div style={{ display:"flex", gap:0, height:"100vh", overflow:"hidden" }}>

      {/* ── Left panel ── */}
      <div style={{ width:460, minWidth:460, overflowY:"auto", flexShrink:0,
        padding:"12px 16px", boxSizing:"border-box", borderRight:"1px solid #ddd", fontSize:13 }}>

        <button onClick={() => setActiveView("map")}>← Back</button>
        <h3 style={{ margin:"8px 0" }}>Parameter Model – {selectedCity?.Name || continentCity}</h3>

        {/* Display settings */}
        <h4 style={{ marginBottom:4 }}>Display Settings</h4>
        <label>Opacity: {opacity.toFixed(2)}</label>
        <input type="range" min="0" max="1" step="0.05" value={opacity} onChange={e => setOpacity(+e.target.value)} style={{ width:"100%" }} />
        <label>Height Scale (visual): {heightScale.toFixed(1)}×</label>
        <input type="range" min="0.5" max="5" step="0.1" value={heightScale} onChange={e => setHeightScale(+e.target.value)} style={{ width:"100%" }} />

        {/* Toggles */}
        <div style={{ display:"flex", flexDirection:"column", gap:4, margin:"8px 0" }}>
          <label style={{ display:"flex", alignItems:"center", gap:6, cursor:"pointer" }}>
            <input type="checkbox" checked={showRings} onChange={e => setShowRings(e.target.checked)} />
            Show remoteness rings &amp; city center
          </label>
          <label style={{ display:"flex", alignItems:"center", gap:6, cursor:"pointer" }}>
            <input type="checkbox" checked={showFlat} onChange={e => setShowFlat(e.target.checked)} />
            Flat view — structural zero only (hide buildings)
          </label>
        </div>
        <Note>
          Rings: dot = r=0 city center · inner ring = r=3 · outer ring = r=9 city fringe<br/>
          Flat view sets π=0, showing only purple (ψ unbuildable) and white (buildable) tiles.
        </Note>

        {/* Average city */}
        <h4 style={{ marginBottom:4 }}>Average City</h4>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          {["Africa","Asia","Latin America"].map(cont => (
            <button key={cont} onClick={() => {
              const avg = getAverageParameters(cont);
              if (!avg) return;
              setA(avg.A); setB(avg.B); setC(avg.C);
              setAlpha(avg.alpha); setBeta(avg.beta);
              setKappa(avg.kappa); setDelta(avg.delta);
              setCity(""); setYear(""); setContinentCity(cont);
            }}>{cont}</button>
          ))}
        </div>

        {/* Empirical city selector */}
        <h4 style={{ marginBottom:4 }}>Empirical Parameters</h4>
        <label>Continent</label>
        <select value={continent} onChange={e => { setContinent(e.target.value); setCity(""); setYear(""); }} style={{ width:"100%", marginBottom:4 }}>
          <option value="">All</option>
          {continents.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <label>City</label>
        <select value={city} onChange={e => { setCity(e.target.value); setYear(""); }} style={{ width:"100%", marginBottom:4 }}>
          <option value="">Select city</option>
          {cities.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <label>Year</label>
        <select value={year} onChange={e => { setYear(e.target.value); if (city && e.target.value) applyParametersFromData(city, e.target.value); }} style={{ width:"100%", marginBottom:4 }}>
          <option value="">Select year</option>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        {year && +year !== 2016 && (
          <Note>
            {swatch("#D3B472")} Buildings from 2016 &nbsp;·&nbsp; {swatch("#e07b39")} New since 2016
          </Note>
        )}

        {/* ψ section */}
        <h4 style={{ marginBottom:2 }}>Structural Zero (ψ)</h4>
        <Note>{swatch("#8472D3")} Purple tiles = cells permanently unbuildable. Higher ψ → more empty land.</Note>
        <label>α: {alpha.toFixed(2)}</label>
        <input type="range" min="-3" max="2" step="0.01" value={alpha} onChange={e => setAlpha(+e.target.value)} style={{ width:"100%" }} />
        <label>β: {beta.toFixed(2)}</label>
        <input type="range" min="0" max="1" step="0.01" value={beta} onChange={e => setBeta(+e.target.value)} style={{ width:"100%" }} />
        <svg ref={probCurveRef} style={{ marginTop:6, display:"block" }} />
        <Note>Dashed purple = ψ(r). Solid gold = π(r). x-axis = remoteness r.</Note>

        {/* π section */}
        <h4 style={{ marginBottom:2 }}>Non-zero Build Probability (π)</h4>
        <Note>
          {swatch("#ffffff")} White tiles = buildable, not yet developed.&ensp;
          {swatch("#D3B472")} Gold buildings = built (darker = taller).
        </Note>
        <label>κ: {kappa.toFixed(2)}</label>
        <input type="range" min="-2" max="2" step="0.01" value={kappa} onChange={e => setKappa(+e.target.value)} style={{ width:"100%" }} />
        <label>δ: {delta.toFixed(2)}</label>
        <input type="range" min="-1" max="0" step="0.01" value={delta} onChange={e => setDelta(+e.target.value)} style={{ width:"100%" }} />

        {/* H(r) section */}
        <h4 style={{ marginBottom:2 }}>Height Function H(r)</h4>
        <Note>Building display height = H(r) × scale. Gradient from light to dark gold by height.</Note>
        <label>A: {A.toFixed(2)}</label>
        <input type="range" min="0" max="20" step="0.1" value={A} onChange={e => setA(+e.target.value)} style={{ width:"100%" }} />
        <label>B: {B.toFixed(2)}</label>
        <input type="range" min="-0.2" max="0.2" step="0.01" value={B} onChange={e => setB(+e.target.value)} style={{ width:"100%" }} />
        <label>C: {C.toFixed(3)}</label>
        <input type="range" min="-0.05" max="0.05" step="0.001" value={C} onChange={e => setC(+e.target.value)} style={{ width:"100%" }} />
        <svg ref={curveRef} style={{ marginTop:6, display:"block" }} />
        <Note>H(r) = A · exp(B·r + C·r²). x-axis = remoteness r.</Note>

      </div>

      {/* ── 3D view (no legend overlay) ── */}
      <div style={{ flex:1, height:"100vh", position:"relative", overflow:"hidden" }}>
        <div ref={threeRef} style={{ width:"100%", height:"100%" }} />
      </div>

    </div>
  );
}
