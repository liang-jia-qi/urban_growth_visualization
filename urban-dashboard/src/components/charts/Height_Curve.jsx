import { useEffect, useRef } from "react";
import * as d3 from "d3";

export default function Height_Curve({
  params2016,
  params2023,
  color2016 = "#f93a2e",
  color2023 = "#2ab421",
  opacity2016 = 0.6,
  opacity2023 = 0.6,
  maxR = 50
}) {
  const ref = useRef();

  useEffect(() => {
    if (!params2016) return;

    const width = 400;
    const height = 200;
    const margin = { top: 20, right: 20, bottom: 40, left: 50 };

    const svg = d3.select(ref.current);
    svg.selectAll("*").remove();

    const x = d3.scaleLinear().domain([0, maxR]).range([margin.left, width - margin.right]);

    // 根据传入参数自动设置 y 轴范围，可以保证两条曲线都在图中
    const yMax = Math.max(params2016.A,params2023?.A);
    const y = d3.scaleLinear().domain([0, yMax]).range([height - margin.bottom, margin.top]);

    const line = d3.line()
      .x(d => x(d.r))
      .y(d => y(d.H));

    const rs = d3.range(0, maxR, 0.5);

    const computeData = (p) => rs.map(r => ({ r, H: p.A * Math.exp(p.B * r + p.C * r * r) }));

    const drawCurve = (params, color, opacity) => {
      if (!params) return;
      const data = computeData(params);
      svg.append("path")
        .datum(data)
        .attr("fill", "none")
        .attr("stroke", color)
        .attr("stroke-width", 2)
        .attr("stroke-opacity", opacity)
        .attr("d", line);
    };

    drawCurve(params2016, color2016, opacity2016);
    drawCurve(params2023, color2023, opacity2023);

    // x 轴
    svg.append("g")
      .attr("transform", `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x).ticks(6))
      .append("text")
      .attr("x", (width - margin.left - margin.right) / 2 + margin.left)
      .attr("y", 30)
      .attr("fill", "black")
      .style("text-anchor", "middle")
      .style("font-size", "12px")
      .text("Remoteness (r)");

    // y 轴
    svg.append("g")
      .attr("transform", `translate(${margin.left},0)`)
      .call(d3.axisLeft(y).ticks(5))
      .append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", - (height - margin.top - margin.bottom) / 2)
      .attr("y", -40)
      .attr("fill", "black")
      .style("text-anchor", "middle")
      .style("font-size", "12px")
      .text("Average Height (H)");

    // 图例
    const legend = svg.append("g").attr("transform", `translate(${width - margin.right - 80},${margin.top})`);
    legend.append("rect").attr("x", 0).attr("y", 0).attr("width", 12).attr("height", 12).attr("fill", color2016).attr("opacity", opacity2016);
    legend.append("text").attr("x", 16).attr("y", 10).text("2016").style("font-size", "12px");
    legend.append("rect").attr("x", 0).attr("y", 18).attr("width", 12).attr("height", 12).attr("fill", color2023).attr("opacity", opacity2023);
    legend.append("text").attr("x", 16).attr("y", 28).text("2023").style("font-size", "12px");

  }, [params2016, params2023, color2016, color2023, opacity2016, opacity2023, maxR]);

  return <svg ref={ref} width={400} height={200} />;
}
