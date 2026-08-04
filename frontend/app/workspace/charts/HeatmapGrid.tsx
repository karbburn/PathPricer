"use client";

interface HoveredCell {
  x: number;
  y: number;
  val: number;
  i: number;
  j: number;
}

interface HeatmapGridProps {
  xValues: number[];
  yValues: number[];
  grid: number[][];
  xLabel: string;
  yLabel: string;
  xTickFormat: (v: number) => string;
  yTickFormat: (v: number) => string;
  cellColor: (val: number) => string;
  minVal: number;
  maxVal: number;
  metricLabel: string;
  hoveredCell: HoveredCell | null;
  onHoverCell: (c: HoveredCell) => void;
  onLeaveCell: () => void;
  hoverText: (c: HoveredCell) => string;
  metricText: (val: number) => string;
  cellTitle?: (x: number, y: number, val: number) => string;
}

const TICK_FRACTIONS = [0, 0.25, 0.5, 0.75, 1];

export function HeatmapGrid(props: HeatmapGridProps) {
  const { xValues, yValues, grid, xLabel, yLabel, xTickFormat, yTickFormat } = props;
  const { cellColor, minVal, maxVal, metricLabel } = props;
  const { hoveredCell, onHoverCell, onLeaveCell, hoverText, metricText, cellTitle } = props;

  return (
    <div className="flex flex-col gap-3">
      {/* Hover Tooltip — inline bar above heatmap */}
      <div className="bg-[#0d1117] border border-[#21262d] px-4 py-2 rounded-lg flex items-center justify-between text-xs font-mono min-h-[36px]">
        <span className="text-[#8b949e]">
          {hoveredCell ? hoverText(hoveredCell) : "Hover over any grid cell to inspect"}
        </span>
        <span className="text-[#58a6ff] font-bold tabular-nums">
          {hoveredCell ? metricText(hoveredCell.val) : ""}
        </span>
      </div>

      {/* Heatmap + Colorbar row */}
      <div className="flex gap-3 items-stretch">
        {/* Y-axis label */}
        <div className="flex flex-col items-center justify-center min-w-[28px]">
          <span className="text-[10px] font-mono font-bold text-[#8b949e] whitespace-nowrap" style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}>
            {yLabel}
          </span>
        </div>

        {/* Y tick labels + Grid */}
        <div className="flex-1 min-w-0 overflow-x-auto">
          <div className="flex min-w-[500px]">
            {/* Y-axis tick labels — 5 ticks aligned to grid rows */}
            <div className="flex flex-col justify-between py-[3px] text-[10px] font-mono text-[#8b949e] text-right w-14 shrink-0 select-none">
              {TICK_FRACTIONS.map((frac) => {
                const idx = Math.round(frac * (yValues.length - 1));
                return <span key={frac}>{yTickFormat(yValues[idx])}</span>;
              })}
            </div>

            {/* Grid cells */}
            <div className="flex-1 min-w-0">
              <div
                className="grid gap-[1px] bg-[#0d1117] p-[3px] rounded-lg border border-[#21262d] w-full"
                style={{ gridTemplateColumns: `repeat(${xValues.length}, minmax(0, 1fr))`, aspectRatio: "1.6" }}
              >
                {grid
                  .slice()
                  .reverse()
                  .map((row, rowRevIdx) => {
                    const j = grid.length - 1 - rowRevIdx;
                    const yVal = yValues[j];
                    return row.map((cellVal, i) => {
                      const xVal = xValues[i];
                      return (
                        <div
                          key={`${j}-${i}`}
                          onMouseEnter={() => onHoverCell({ x: xVal, y: yVal, val: cellVal, i, j })}
                          onMouseLeave={onLeaveCell}
                          style={{ backgroundColor: cellColor(cellVal) }}
                          className="w-full h-full rounded-[1px] transition-transform hover:scale-[1.3] hover:z-10 hover:shadow-lg cursor-pointer min-h-[8px]"
                          title={cellTitle ? cellTitle(xVal, yVal, cellVal) : undefined}
                        />
                      );
                    });
                  })}
              </div>

              {/* X-axis tick labels — 5 ticks below grid */}
              <div className="flex justify-between px-[3px] mt-1 text-[10px] font-mono text-[#8b949e] select-none">
                {TICK_FRACTIONS.map((frac) => {
                  const idx = Math.round(frac * (xValues.length - 1));
                  return <span key={frac}>{xTickFormat(xValues[idx])}</span>;
                })}
              </div>

              {/* X-axis title */}
              <div className="text-center text-[10px] font-mono font-bold text-[#8b949e] mt-1 select-none">
                {xLabel}
              </div>
            </div>
          </div>
        </div>

        {/* Vertical Colorbar */}
        <div className="flex flex-col items-center shrink-0 w-10 select-none">
          <span className="text-[10px] font-mono text-[#58a6ff] font-bold mb-1">{maxVal.toFixed(2)}</span>
          <div className="flex-1 w-3 rounded-full border border-[#21262d] overflow-hidden"
               style={{ background: `linear-gradient(to bottom, hsl(0,80%,60%), hsl(60,80%,50%), hsl(120,80%,45%), hsl(180,80%,35%), hsl(240,80%,25%))` }}>
          </div>
          <span className="text-[10px] font-mono text-[#8b949e] mt-1">{minVal.toFixed(2)}</span>
          <span className="text-[10px] font-mono text-[#8b949e] mt-0.5">{metricLabel}</span>
        </div>
      </div>
    </div>
  );
}
