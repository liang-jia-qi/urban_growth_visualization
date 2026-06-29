import { useEffect, useRef, useState } from "react";
import { useStore } from "../store";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import * as d3 from "d3";

export default function ParameterPage() {
  const { setActiveView, selectedCity } = useStore();

  // ============================================================
  // 1️⃣ 模型参数 state
  // ============================================================
  const [alpha, setAlpha] = useState(0.5);
  const [beta, setBeta] = useState(-0.1);
  const [kappa, setKappa] = useState(0.3);
  const [delta, setDelta] = useState(0.05);
  const [A, setA] = useState(7.58);
  const [B, setB] = useState(-0.08);
  const [C, setC] = useState(0.0);

  // 柱状体透明度
  const [opacity, setOpacity] = useState(0.7);
  const [heightScale, setHeightScale] = useState(2.0);

  // ============================================================
  // 2️⃣ 数据 state
  // ============================================================
  const [citiesDB, setCitiesDB] = useState([]);
  const [heightDB, setHeightDB] = useState([]);
  const [zibDB, setZibDB] = useState([]);

  // filter 状态
  const [continent, setContinent] = useState("");
  const [city, setCity] = useState("");
  const [year, setYear] = useState("");

  // 概念城市（大洲平均）
  const [continentCity, setContinentCity] = useState("");

  // ============================================================
  // 3️⃣ 引用
  // ============================================================
  const threeRef = useRef();
  const curveRef = useRef();
  const probCurveRef = useRef();

  // ============================================================
  // 4️⃣ 工具函数
  // ============================================================
  const logistic = x => 1 / (1 + Math.exp(-x));
  const psi = r => logistic(alpha + beta * r);
  const pi = r => logistic(kappa + delta * r);

  // ============================================================
  // 5️⃣ CSV 数据加载
  // ============================================================
  useEffect(() => {
    Promise.all([
      d3.csv("/data/CitiesDB_new.csv"),
      d3.csv("/data/height_fitting_results_new.csv"),
      d3.csv("/data/zib_fitting_results_new.csv")
    ]).then(([cities, height, zib]) => {
      setCitiesDB(cities);
      setHeightDB(height);
      setZibDB(zib);
    });
  }, []);

  // ============================================================
  // 6️⃣ 派生选项
  // ============================================================
  const continents = Array.from(new Set(citiesDB.map(d => d.continent)));
  const cities = citiesDB
    .filter(d => !continent || d.continent === continent)
    .map(d => d.Name);
  const years = Array.from(
    new Set(heightDB.filter(d => !city || d.city === city).map(d => d.year))
  ).sort();

  // ============================================================
  // 7️⃣ 数据填充函数
  // ============================================================
  const applyParametersFromData = (city, year) => {
    const h = heightDB.find(d => d.city === city && +d.year === +year);
    const z = zibDB.find(d => d.city === city && +d.year === +year);

    if (!h || !z) return;

    setA(+h.A);
    setB(+h.B);
    setC(+h.C);
    setAlpha(+z.alpha);
    setBeta(+z.beta);
    setKappa(+z.kappa);
    setDelta(+z.delta);

    // 清空概念城市标记
    setContinentCity("");
  };

  // ============================================================
  // 8️⃣ 计算概念城市平均参数
  // ============================================================
  const getAverageParameters = continent => {
    const continentCities = citiesDB
      .filter(c => c.continent === continent)
      .map(c => c.Name);

    const heights = heightDB.filter(d => continentCities.includes(d.city));
    const zibs = zibDB.filter(d => continentCities.includes(d.city));

    if (heights.length === 0 || zibs.length === 0) return null;

    const avgA = d3.mean(heights, d => +d.A);
    const avgB = d3.mean(heights, d => +d.B);
    const avgC = d3.mean(heights, d => +d.C);
    const avgAlpha = d3.mean(zibs, d => +d.alpha);
    const avgBeta  = d3.mean(zibs, d => +d.beta);
    const avgKappa = d3.mean(zibs, d => +d.kappa);
    const avgDelta = d3.mean(zibs, d => +d.delta);

    return {
      A: avgA, B: avgB, C: avgC,
      alpha: avgAlpha, beta: avgBeta,
      kappa: avgKappa, delta: avgDelta
    };
  };

  // ============================================================
  // 9️⃣ 绘制 H(r) 曲线
  // ============================================================
  useEffect(() => {
    const width = 400, height = 220;
    const margin = { top: 20, right: 20, bottom: 40, left: 50 };

    const svg = d3.select(curveRef.current)
      .attr("width", width)
      .attr("height", height);
    svg.selectAll("*").remove();

    const rVals = d3.range(0, 10.01, 0.1);
    const data = rVals.map(r => ({ r, H: A * Math.exp(B*r + C*r*r) }));

    const x = d3.scaleLinear().domain([0,10]).range([margin.left, width-margin.right]);
    const y = d3.scaleLinear().domain([0, d3.max(data,d=>d.H)]).nice()
      .range([height-margin.bottom, margin.top]);

    svg.append("g").attr("transform", `translate(0,${height-margin.bottom})`).call(d3.axisBottom(x));
    svg.append("g").attr("transform", `translate(${margin.left},0)`).call(d3.axisLeft(y));

    const line = d3.line().x(d=>x(d.r)).y(d=>y(d.H));
    svg.append("path").datum(data).attr("fill","none").attr("stroke","#0b3c5d").attr("stroke-width",2).attr("d",line);
  }, [A,B,C]);

  // ============================================================
  // 10️⃣ 绘制 ψ / π 曲线
  // ============================================================
  useEffect(() => {
    const width=400,height=220,margin={top:20,right:30,bottom:40,left:50};
    const svg = d3.select(probCurveRef.current).attr("width",width).attr("height",height);
    svg.selectAll("*").remove();

    const rVals = d3.range(0,10.01,0.1);
    const data = rVals.map(r => ({ r, psi: psi(r), pi: pi(r) }));

    const x = d3.scaleLinear().domain([0,10]).range([margin.left,width-margin.right]);
    const y = d3.scaleLinear().domain([0,1]).range([height-margin.bottom,margin.top]);

    svg.append("g").attr("transform",`translate(0,${height-margin.bottom})`).call(d3.axisBottom(x));
    svg.append("g").attr("transform",`translate(${margin.left},0)`).call(d3.axisLeft(y));

    const linePsi = d3.line().x(d=>x(d.r)).y(d=>y(d.psi));
    const linePi  = d3.line().x(d=>x(d.r)).y(d=>y(d.pi));

    svg.append("path").datum(data).attr("fill","none").attr("stroke","#999").attr("stroke-dasharray","4 2").attr("stroke-width",2).attr("d",linePsi);
    svg.append("path").datum(data).attr("fill","none").attr("stroke","#0b3c5d").attr("stroke-width",2).attr("d",linePi);
  }, [alpha,beta,kappa,delta]);

  // ============================================================
  // 11️⃣ 3D 可视化 + 固定随机格局
  // ============================================================
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
    scene.background = new THREE.Color(0xf0f4f8);

    const container = threeRef.current;
    const w = container.clientWidth || window.innerWidth - 520;
    const h = container.clientHeight || window.innerHeight;
    const renderer = new THREE.WebGLRenderer({antialias:true});
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(w, h);
    container.appendChild(renderer.domElement);

    const camera = new THREE.PerspectiveCamera(45, w/h, 0.1, 2000);
    camera.position.set(50,70,70); camera.lookAt(0,0,0);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    scene.add(new THREE.AmbientLight(0xffffff,0.7));
    const light = new THREE.DirectionalLight(0xffffff,1.0);
    light.position.set(50,100,40); scene.add(light);
    const fillLight = new THREE.DirectionalLight(0xffffff,0.3);
    fillLight.position.set(-40,30,-20); scene.add(fillLight);

    // ── Adaptive rMax: show up to where ψ(r) = 0.95 ──────────────
    // logit(0.95) ≈ 2.944; ψ = logistic(α + β·r) = 0.95 ↔ r = (2.944−α)/β
    const logit95 = Math.log(0.95 / 0.05);
    const rMax = beta > 0.01
      ? Math.min(12, Math.max(5, (logit95 - alpha) / beta))
      : 10;

    const N = 70, size = 1, center = N / 2;

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(N+2, N+2),
      new THREE.MeshStandardMaterial({color:0xd6dde6})
    );
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);

    // ── Shared random map keyed by city only (same layout across years) ──
    const mapName = continentCity ? "concept_"+continentCity : city;
    const { psiMap, piMap } = getCityRandomMap(mapName, N);

    // ── Look up 2016 baseline params for temporal comparison ──────
    const logistic = x => 1 / (1 + Math.exp(-x));
    let isComparing = !continentCity && city && year && +year !== 2016;
    let psi16 = r => logistic(alpha + beta * r);  // default: same as current
    let pi16  = r => logistic(kappa + delta * r);
    if (isComparing) {
      const z16 = zibDB.find(d => d.city === city && +d.year === 2016);
      if (z16) {
        const [a16, b16, k16, d16] = [+z16.alpha, +z16.beta, +z16.kappa, +z16.delta];
        psi16 = r => logistic(a16 + b16 * r);
        pi16  = r => logistic(k16 + d16 * r);
      } else {
        isComparing = false; // no 2016 data found, show single year
      }
    }

    // ── H range for color mapping ─────────────────────────────────
    const Hcenter = A * Math.exp(B*0 + C*0);
    const Hedge   = A * Math.exp(B*rMax + C*rMax*rMax);
    const Hmax = Math.max(Hcenter, Hedge, 0.01);
    const Hmin = Math.min(Hcenter, Hedge);

    const colorLow  = new THREE.Color(0x89cff0);
    const colorHigh = new THREE.Color(0x0b3c5d);
    const colorNew  = new THREE.Color(0xe07b39);

    const flatTile = (x, z, color, op) => {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(size*0.9, size*0.9),
        new THREE.MeshStandardMaterial({color, transparent:true, opacity:op})
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

        // Use CURRENT year's ψ for what is empty now
        const isStructZeroNow  = psiMap[i][j] < psi(r);
        const isStructZeroBase = psiMap[i][j] < psi16(r);

        if (isStructZeroNow) {
          flatTile(dx, dz, 0xb8c4ce, 0.55); // currently unbuildable → gray
          continue;
        }

        // "built in baseline" = was not a structural zero AND above π threshold in 2016
        const builtInBase    = !isStructZeroBase && piMap[i][j] < pi16(r);
        const builtInCurrent = piMap[i][j] < pi(r);

        if (builtInCurrent || builtInBase) {
          const Hraw  = A * Math.exp(B*r + C*r*r);
          const Hdisp = Hraw * heightScale;
          // "new" = currently built but NOT built in 2016 (either was struct zero then, or below pi16)
          const isNew = isComparing && !builtInBase;
          const col3 = isNew
            ? colorNew.clone()
            : colorLow.clone().lerp(colorHigh, Hmax > Hmin ? (Hraw-Hmin)/(Hmax-Hmin) : 0.5);
          const mesh = new THREE.Mesh(
            new THREE.BoxGeometry(size*0.85, Hdisp, size*0.85),
            new THREE.MeshStandardMaterial({color:col3, transparent:true, opacity})
          );
          mesh.position.set(dx, Hdisp/2, dz);
          scene.add(mesh);
        } else {
          flatTile(dx, dz, 0xe8c97a, 0.85); // buildable but not built → amber
        }
      }
    }

    // ── Radial markers: center dot + r=3 and r=9 rings (no labels) ──
    const addMarker = (r_model, color) => {
      if (r_model === 0) {
        const dot = new THREE.Mesh(
          new THREE.SphereGeometry(0.7, 16, 16),
          new THREE.MeshStandardMaterial({color, emissive:color, emissiveIntensity:0.4})
        );
        dot.position.set(0, 0.7, 0);
        scene.add(dot);
      } else {
        const wr = (r_model / rMax) * center;
        if (wr >= center) return;
        const pts = [];
        for (let a = 0; a <= Math.PI*2+0.01; a += 0.04)
          pts.push(new THREE.Vector3(Math.cos(a)*wr, 0.15, Math.sin(a)*wr));
        scene.add(new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(pts),
          new THREE.LineBasicMaterial({color})
        ));
      }
    };

    addMarker(0, 0xcc2222);
    addMarker(3, 0x228833);
    addMarker(9, 0x334488);

    let animId;
    const animate = () => { animId = requestAnimationFrame(animate); controls.update(); renderer.render(scene, camera); };
    animate();
    return () => { cancelAnimationFrame(animId); renderer.dispose(); };
  }, [alpha,beta,kappa,delta,A,B,C,city,year,continentCity,opacity,heightScale,zibDB]);

  // ============================================================
  // 12️⃣ 页面布局：左右两栏
  // ============================================================
  return (
    <div style={{ display:"flex", gap:0, height:"100vh", overflow:"hidden" }}>
      <div style={{ width:460, minWidth:460, overflowY:"auto", flexShrink:0, padding:"12px 16px", boxSizing:"border-box", borderRight:"1px solid #ddd" }}>
        <button onClick={()=>setActiveView("map")}>← Back</button>
        <h3>Parameter Model – {selectedCity?.Name || continentCity}</h3>

        <h4>Display Settings</h4>
        <label>Opacity: {opacity.toFixed(2)}</label>
        <input type="range" min="0" max="1" step="0.1" value={opacity} onChange={e=>setOpacity(+e.target.value)}/>
        <label>Height Scale (visual): {heightScale.toFixed(1)}×</label>
        <input type="range" min="0.5" max="5" step="0.1" value={heightScale} onChange={e=>setHeightScale(+e.target.value)}/>

        {/* 概念城市按钮 */}
        <h4>Average City</h4>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          {["Africa","Asia","Latin America"].map(cont=>(
            <button key={cont} onClick={()=>{
              const avg = getAverageParameters(cont);
              if(!avg) return;
              setA(avg.A); setB(avg.B); setC(avg.C);
              setAlpha(avg.alpha); setBeta(avg.beta);
              setKappa(avg.kappa); setDelta(avg.delta);
              setCity(""); setYear(""); setContinentCity(cont);
            }}>{cont}</button>
          ))}
        </div>

        {/* 真实城市 filter */}
        <h4>Empirical parameters</h4>
        <label>Continent</label>
        <select value={continent} onChange={e=>{setContinent(e.target.value); setCity(""); setYear("");}}>
          <option value="">All</option>
          {continents.map(c=><option key={c} value={c}>{c}</option>)}
        </select>

        <label>City</label>
        <select value={city} onChange={e=>{setCity(e.target.value); setYear("");}}>
          <option value="">Select city</option>
          {cities.map(c=><option key={c} value={c}>{c}</option>)}
        </select>

        <label>Year</label>
        <select value={year} onChange={e=>{setYear(e.target.value); if(city && e.target.value) applyParametersFromData(city,e.target.value);}}>
          <option value="">Select year</option>
          {years.map(y=><option key={y} value={y}>{y}</option>)}
        </select>

        <h4>Structural zero (ψ)</h4>
        <label>α: {alpha.toFixed(2)}</label>
        <input type="range" min="-3" max="2" step="0.01" value={alpha} onChange={e=>setAlpha(+e.target.value)}/>
        <label>β: {beta.toFixed(2)}</label>
        <input type="range" min="0" max="1" step="0.01" value={beta} onChange={e=>setBeta(+e.target.value)}/>

        <h4>Non-zero build probability (π)</h4>
        <label>κ: {kappa.toFixed(2)}</label>
        <input type="range" min="-2" max="2" step="0.01" value={kappa} onChange={e=>setKappa(+e.target.value)}/>
        <label>δ: {delta.toFixed(2)}</label>
        <input type="range" min="-1" max="0" step="0.01" value={delta} onChange={e=>setDelta(+e.target.value)}/>

        <svg ref={probCurveRef} style={{ marginTop:12 }} />

        <h4>Height function H(r)</h4>
        <label>A: {A.toFixed(2)}</label>
        <input type="range" min="0" max="20" step="0.1" value={A} onChange={e=>setA(+e.target.value)}/>
        <label>B: {B.toFixed(2)}</label>
        <input type="range" min="-0.2" max="0.2" step="0.01" value={B} onChange={e=>setB(+e.target.value)}/>
        <label>C: {C.toFixed(3)}</label>
        <input type="range" min="-0.05" max="0.05" step="0.001" value={C} onChange={e=>setC(+e.target.value)}/>

        <svg ref={curveRef} style={{ marginTop:12 }} />
      </div>

      <div style={{ flex:1, height:"100vh", position:"relative", overflow:"hidden" }}>
        <div ref={threeRef} style={{ width:"100%", height:"100%" }} />
        {/* Legend */}
        <div style={{
          position:"absolute", bottom:16, left:16,
          background:"rgba(255,255,255,0.88)", borderRadius:8,
          padding:"8px 12px", fontSize:12, lineHeight:1.8
        }}>
          {[
            ["#b8c4ce","Structural zero (ψ) — unbuildable"],
            ["#e8c97a","Buildable, not yet built"],
            ["#89cff0","Building — lower height"],
            ["#0b3c5d","Building — taller height"],
            ...(year && +year !== 2016 ? [["#e07b39","New building since 2016 ↑"]] : []),
            ["#cc2222","● r = 0  city center"],
            ["#228833","— r = 3  central area"],
            ["#334488","— r = 9  city fringe"],
          ].map(([color, label]) => (
            <div key={label} style={{display:"flex", alignItems:"center", gap:6}}>
              <div style={{width:14,height:14,background:color,borderRadius:2,flexShrink:0}}/>
              <span>{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
