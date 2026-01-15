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
      cityRandomMapRef.current[name] = Array.from({length:N},()=>Array.from({length:N},()=>Math.random()));
    }
    return cityRandomMapRef.current[name];
  };

  useEffect(() => {
    if (!city && !continentCity) return;

    threeRef.current.innerHTML = "";
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf7f7f7);

    const renderer = new THREE.WebGLRenderer({antialias:true});
    renderer.setSize(800,800);
    threeRef.current.appendChild(renderer.domElement);

    const camera = new THREE.PerspectiveCamera(45,1,0.1,1000);
    camera.position.set(30,45,45); camera.lookAt(0,0,0);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    scene.add(new THREE.AmbientLight(0xffffff,0.6));
    const light = new THREE.DirectionalLight(0xffffff,0.8);
    light.position.set(30,50,20); scene.add(light);

    const N=40, size=1, center=N/2, rMax=10;
    const mapName = continentCity ? "concept_"+continentCity : city;
    const cityMap = getCityRandomMap(mapName,N);

    for(let i=0;i<N;i++){
      for(let j=0;j<N;j++){
        const dx = i-center, dz=j-center;
        const r = Math.sqrt(dx*dx+dz*dz)/center*rMax;
        if(r>rMax) continue;

        const randVal = cityMap[i][j];

        // structural zero
        if(randVal < psi(r)){
          const base = new THREE.Mesh(
            new THREE.BoxGeometry(size,0.1,size),
            new THREE.MeshStandardMaterial({color:0xcccccc, transparent:true, opacity:0.5})
          );
          base.position.set(dx,0.05,dz); scene.add(base);
          continue;
        }

        // non-zero
        if(randVal < psi(r)+pi(r)){
          const H = A*Math.exp(B*r + C*r*r);
          const col = new THREE.Mesh(
            new THREE.BoxGeometry(size*0.9,H,size*0.9),
            new THREE.MeshStandardMaterial({color:0x00b8ff, transparent:true, opacity:opacity})
          );
          col.position.set(dx,H/2,dz); scene.add(col);
        }
      }
    }

    const animate = () => { requestAnimationFrame(animate); controls.update(); renderer.render(scene,camera); };
    animate();
  }, [alpha,beta,kappa,delta,A,B,C,city,continentCity,opacity]);

  // ============================================================
  // 12️⃣ 页面布局：左右两栏
  // ============================================================
  return (
    <div style={{ display:"flex", gap:16, height:"100vh", padding:16, boxSizing:"border-box" }}>
      <div style={{ width:500, overflowY:"auto", flexShrink:0 }}>
        <button onClick={()=>setActiveView("map")}>← Back</button>
        <h3>Parameter Model – {selectedCity?.Name || continentCity}</h3>

        {/* 新增柱状体透明度 slider */}
        <h4>Building Opacity</h4>
        <label>Opacity: {opacity.toFixed(2)}</label>
        <input type="range" min="0" max="1" step="0.1" value={opacity} onChange={e=>setOpacity(+e.target.value)}/>

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

      <div style={{ flex:1, height:"100%" }}>
        <div ref={threeRef} style={{ width:"100%", height:"100%" }} />
      </div>
    </div>
  );
}
