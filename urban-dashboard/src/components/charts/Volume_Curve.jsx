import { useEffect, useRef } from "react";
import * as d3 from "d3";

const logistic = (x) => 1 / (1 + Math.exp(-x));

export function ExpectedVolumeCurve({ params2016, params2023, maxR = 50 }) {
  const ref = useRef();

  useEffect(() => {
    if (!params2016 && !params2023) return;

    const width = 400, height = 200;
    const margin = { top: 20, right: 20, bottom: 40, left: 50 };
    const svg = d3.select(ref.current);
    svg.selectAll("*").remove();

    const maxRNum = Number(maxR) || 50; // 确保是数字
    const x = d3.scaleLinear().domain([0, maxRNum]).range([margin.left, width - margin.right]);
    const rs = d3.range(0, maxRNum + 0.1, 0.1);

    const computeData = (p) => {
      if (!p) return [];
      return rs.map(r => {
        const alpha = p.alpha ?? 0;
        const beta  = p.beta ?? 0;
        const kappa = p.kappa ?? 0;
        const delta = p.delta ?? 0;
        const A     = p.A ?? 0;
        const B     = p.B ?? 0;
        const C     = p.C ?? 0;

        const psi = logistic(alpha + beta * r);
        const pi  = logistic(kappa + delta * r);
        const H   = A * Math.exp(B * r + C * r * r);
        const V   = (1 - psi) * pi *9 *900 * H;
        return { r, V };
      });
    };

    const data2016 = computeData(params2016);
    const data2023 = computeData(params2023);

    const yMax = Math.max(
      d3.max(data2016, d => d.V) || 0,
      d3.max(data2023, d => d.V) || 0
    );
    const y = d3.scaleLinear().domain([0, yMax * 1.1]).range([height - margin.bottom, margin.top]);

    const line = d3.line().x(d => x(d.r)).y(d => y(d.V));

    if (data2016.length) svg.append("path").datum(data2016).attr("fill","none").attr("stroke","#f93a2e").attr("stroke-width",2).attr("d",line);
    if (data2023.length) svg.append("path").datum(data2023).attr("fill","none").attr("stroke","#2ab421").attr("stroke-width",2).attr("d",line);

    // x轴
    svg.append("g").attr("transform",`translate(0,${height - margin.bottom})`).call(d3.axisBottom(x).ticks(6))
      .append("text").attr("x",(width-margin.left-margin.right)/2 + margin.left).attr("y",30).attr("fill","black").style("text-anchor","middle").text("Remoteness (r)");

    // y轴
    svg.append("g").attr("transform",`translate(${margin.left},0)`).call(d3.axisLeft(y).ticks(5))
      .append("text").attr("transform","rotate(-90)").attr("x",- (height - margin.top - margin.bottom)/2).attr("y",-40)
      .attr("fill","black").style("text-anchor","middle").text("Expected Volume");

  }, [params2016, params2023, maxR]);

  return <svg ref={ref} width={400} height={200} />;
}


export function CumulativeVolumeCurve({ params2016, params2023, maxR = 50 }) {
  const ref = useRef();

  useEffect(() => {
    if (!params2016 && !params2023) return;

    const width = 400, height = 200;
    const margin = { top: 20, right: 20, bottom: 40, left: 50 };
    const svg = d3.select(ref.current);
    svg.selectAll("*").remove();

    const maxRNum = Number(maxR) || 50; // 确保是数字
    const x = d3.scaleLinear().domain([0, maxRNum]).range([margin.left, width - margin.right]);
    const rs = d3.range(0, maxRNum + 0.1, 0.1);

    const computeCumulative = (p) => {
      if (!p) return [];
      let cum = 0;
      return rs.map(r => {
        const alpha = p.alpha ?? 0;
        const beta  = p.beta ?? 0;
        const kappa = p.kappa ?? 0;
        const delta = p.delta ?? 0;
        const A     = p.A ?? 0;
        const B     = p.B ?? 0;
        const C     = p.C ?? 0;

        const psi = logistic(alpha + beta * r);
        const pi  = logistic(kappa + delta * r);
        const H   = A * Math.exp(B * r + C * r * r);
        const V   = (1 - psi) * pi *9 * 900 * H;
        cum += V * 0.1; // Δr
        return { r, Vcum: cum };
      });
    };

    const data2016 = computeCumulative(params2016);
    const data2023 = computeCumulative(params2023);

    const yMax = Math.max(
      d3.max(data2016, d => d.Vcum) || 0,
      d3.max(data2023, d => d.Vcum) || 0
    );
    const y = d3.scaleLinear().domain([0, yMax * 1.1]).range([height - margin.bottom, margin.top]);

    const line = d3.line().x(d => x(d.r)).y(d => y(d.Vcum));

    if (data2016.length) svg.append("path").datum(data2016).attr("fill","none").attr("stroke","#f93a2e").attr("stroke-width",2).attr("d",line);
    if (data2023.length) svg.append("path").datum(data2023).attr("fill","none").attr("stroke","#2ab421").attr("stroke-width",2).attr("d",line);

    // x轴
    svg.append("g").attr("transform",`translate(0,${height - margin.bottom})`).call(d3.axisBottom(x).ticks(6))
      .append("text").attr("x",(width-margin.left-margin.right)/2 + margin.left).attr("y",30).attr("fill","black").style("text-anchor","middle").text("Remoteness (r)");

    // y轴
    svg.append("g").attr("transform",`translate(${margin.left},0)`).call(d3.axisLeft(y).ticks(5))
      .append("text").attr("transform","rotate(-90)").attr("x",- (height - margin.top - margin.bottom)/2).attr("y",-40)
      .attr("fill","black").style("text-anchor","middle").text("Cumulative Volume");

  }, [params2016, params2023, maxR]);

  return <svg ref={ref} width={400} height={200} />;
}
