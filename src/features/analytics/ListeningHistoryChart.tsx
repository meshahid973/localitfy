import { memo, useId, useMemo, useState } from "react";
import type { ListeningSummary } from "./listeningSummary";
import { formatAnalyticsDuration } from "./formatters";
import { XYInspector } from "./chart/Inspector";
import { linePath, areaPath } from "./chart/path";
import { useElementWidth } from "./chart/useElementWidth";
import { useHoverCapable } from "./chart/useHoverCapable";

type Props = {
  summary: ListeningSummary;
  selectedDay: string;
  onSelectDay: (day: string) => void;
};

const duration = (ms: number) => formatAnalyticsDuration(ms / 1000);
const HEIGHT = 164;
const PAD = 10;

export const ListeningHistoryChart = memo(function ListeningHistoryChart({ summary, selectedDay, onSelectDay }: Props) {
  const { ref, width } = useElementWidth<HTMLDivElement>();
  const canHover = useHoverCapable();
  const [inspecting, setInspecting] = useState(false);
  const readoutId = useId();
  const days = summary.byDay;
  const previous = summary.comparison?.byDay;
  const selected = Math.max(0, days.findIndex(day => day.day === selectedDay));
  const index = selectedDay ? selected : Math.max(0, days.length - 1);
  const shown = days[index];
  const geometry = useMemo(() => {
    const maximum = Math.max(0, ...days.map(day => day.ms), ...(previous || []).map(day => day.ms));
    const x = (i: number) => PAD + (days.length === 1 ? (width - PAD * 2) / 2 : i / Math.max(1, days.length - 1) * (width - PAD * 2));
    const y = (ms: number) => HEIGHT - PAD - ms / (maximum || 1) * (HEIGHT - PAD * 2);
    const current = days.map((day, i) => ({ x: x(i), y: y(day.ms) }));
    return {
      maximum,
      current: linePath(current),
      area: areaPath(current, HEIGHT - PAD),
      previous: previous ? linePath(previous.map((day, i) => ({ x: x(i), y: y(day.ms) }))) : "",
      x: x(index), y: y(days[index]?.ms || 0)
    };
  }, [days, previous, width, index]);

  return <figure className="analyticsHistoryChart">
    <figcaption className="analyticsHistoryChartCaption">
      <span>Recorded time by UTC day</span>
      <span className="analyticsHistoryChartLegend"><span>This period</span>{previous && <span>Previous period</span>}</span>
    </figcaption>
    <div className="analyticsHistoryChartPlot" ref={ref}>
      <svg width={width || undefined} height={HEIGHT} aria-hidden="true">
        <path d={`M${PAD},${HEIGHT - PAD}H${Math.max(PAD, width - PAD)}`} className="analyticsHistoryChartBaseline" />
        {width > PAD * 2 && <>
          <path d={geometry.area} className="analyticsHistoryChartArea" />
          {previous && <path d={geometry.previous} className="analyticsHistoryChartPrevious" />}
          <path d={geometry.current} className="analyticsHistoryChartCurrent" />
          {inspecting && shown && <circle cx={geometry.x} cy={geometry.y} r="4" className="analyticsHistoryChartDot" />}
        </>}
      </svg>
      <XYInspector count={days.length} activeIndex={index} onActive={i => onSelectDay(days[i].day)}
        label="Inspect recorded listening by UTC day" mode="point" canHover={canHover}
        open={inspecting} setOpen={setInspecting} tooltipId={readoutId}
        valueText={i => `${days[i].day}: ${duration(days[i].ms)}${previous?.[i] ? `; ${previous[i].day}: ${duration(previous[i].ms)}` : ""}`} />
    </div>
    <div className="analyticsHistoryChartAxis"><span>{days[0]?.day}</span><span>{duration(geometry.maximum)} maximum</span><span>{days.at(-1)?.day}</span></div>
    <p id={readoutId} className="analyticsHistoryChartReadout">
      {shown ? `${shown.day} · ${duration(shown.ms)}` : "No recorded listening"}
      {previous?.[index] && ` · ${previous[index].day}: ${duration(previous[index].ms)}`}
    </p>
    <details className="analyticsHistoryChartData"><summary>Daily listening data</summary><div><table>
      <caption>Recorded listening, attributed to the UTC day each event began</caption>
      <thead><tr><th scope="col">UTC day</th><th scope="col">Recorded time</th>{previous && <><th scope="col">Previous UTC day</th><th scope="col">Recorded time</th></>}</tr></thead>
      <tbody>{days.map((day, i) => <tr key={day.day}><th scope="row">{day.day}</th><td>{duration(day.ms)}</td>{previous && <><td>{previous[i]?.day || "—"}</td><td>{duration(previous[i]?.ms || 0)}</td></>}</tr>)}</tbody>
    </table></div></details>
  </figure>;
});
