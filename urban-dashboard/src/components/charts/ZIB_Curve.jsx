import { useEffect, useRef } from "react";
import * as d3 from "d3";

// logistic 函数
const logistic = (x) => 1 / (1 + Math.exp(-x));

export default function ZIB_Curve({
  params2016,
  params2023,
  type,
  color2016 = "#f93a2e",
  color2023 = "#2ab421",
  opacity2016 = 0.6,   // 透明度
  opacity2023 = 0.6,
  maxR = 50             // 横轴最大值，可传入每个城市 remoteness_range
}) {
  const ref = useRef();

  useEffect(() => {
    if (!params2016) return;

    // SVG 尺寸
    const width = 400;
    const height = 200;
    const margin = { top: 20, right: 20, bottom: 30, left: 40 };

    const svg = d3.select(ref.current);
    svg.selectAll("*").remove();

    const x = d3.scaleLinear().domain([0, maxR]).range([margin.left, width - margin.right]);
    const y = d3.scaleLinear().domain([0, 1]).range([height - margin.bottom, margin.top]);

    const line = d3.line()
      .x(d => x(d.r))
      .y(d => y(d.y));

    // r 步长 0.5
    const rs = d3.range(0, maxR, 0.5);

    const computeData = (p) => {
      return rs.map(r => {
        let yVal = 0;
        if (type === "psi") yVal = logistic(p.alpha + p.beta * r);
        else if (type === "pi") yVal = logistic(p.kappa + p.delta * r);
        return { r, y: yVal };
      });
    };

    const drawCurve = (params, color, opacity) => {
      if (!params) return;
      const data = computeData(params);
      svg.append("path")
        .datum(data)
        .attr("fill", "none")
        .attr("stroke", color)
        .attr("stroke-width", 2)
        .attr("stroke-opacity", opacity)   // 设置透明度
        .attr("d", line);
    };

    // 画曲线
    drawCurve(params2016, color2016, opacity2016);
    drawCurve(params2023, color2023, opacity2023);

    // x 轴
    svg.append("g")
      .attr("transform", `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x).ticks(6))
      .append("text")                // 添加文本标签
      .attr("x", (width - margin.left - margin.right) / 2 + margin.left) // 居中
      .attr("y", 30)                // 轴下方的位置
      .attr("fill", "black")
      .style("font-size", "12px")
      .style("text-anchor", "middle")
      .text("Remoteness (r)");

    // y 轴
    svg.append("g")
      .attr("transform", `translate(${margin.left},0)`)
      .call(d3.axisLeft(y).ticks(5));

    // 图例
    const legend = svg.append("g").attr("transform", `translate(${width - margin.right - 80},${margin.top})`);
    legend.append("rect").attr("x", 0).attr("y", 0).attr("width", 12).attr("height", 12).attr("fill", color2016).attr("opacity", opacity2016);
    legend.append("text").attr("x", 16).attr("y", 10).text("2016").style("font-size", "12px");
    legend.append("rect").attr("x", 0).attr("y", 18).attr("width", 12).attr("height", 12).attr("fill", color2023).attr("opacity", opacity2023);
    legend.append("text").attr("x", 16).attr("y", 28).text("2023").style("font-size", "12px");

  }, [params2016, params2023, type, color2016, color2023, opacity2016, opacity2023, maxR]);

  return <svg ref={ref} width={400} height={200} />;
}
