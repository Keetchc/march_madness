/**
 * NCAA Division I **men's** court (94′×50′), top-down.
 * Paint is a true rectangle; FT line is straight across 16′. FT *circle* is drawn as
 * two semicircular arcs only (inside lane + outside lane) — no full circle on the FT line.
 * Four lane-space blocks per sideline (solid), restricted arc under the hoop.
 */
const FEET = {
  courtL: 94,
  courtW: 50,
  hoopInset: 5.25,
  threePtR: 22 + 1.75 / 12,
  laneW: 16,
  laneDepth: 19,
  ftCircleR: 6,
  restrictedR: 4,
  centerCircleR: 6,
  sidelineOffset: 3,
} as const;

/** Lane-space blocks (~NCAA 2″×8″); width nudged up slightly so they read when the court is scaled */
const BLOCK_W = 2.75 / 12;
const BLOCK_D = 8 / 12;

/** Four block centers from baseline (ft) along each lane sideline */
const LANE_BLOCK_X = [4.25, 8.75, 13.25, 16.75] as const;

function n(v: number, d = 3) {
  return Number(v.toFixed(d));
}

/** Where the 3PT arc meets a horizontal y = const (toward midcourt from that end). */
function threePtMeetXFromLeftEnd(hoopX: number, cy: number, r: number, y: number) {
  const dy = cy - y;
  return hoopX + Math.sqrt(r * r - dy * dy);
}

function laneBlocksLeft(laneY0: number, laneY1: number, fill: string) {
  const hw = BLOCK_W / 2;
  return (
    <>
      {LANE_BLOCK_X.map((xc) => (
        <g key={`LB-${xc}`}>
          <rect
            x={xc - hw}
            y={laneY0}
            width={BLOCK_W}
            height={BLOCK_D}
            fill={fill}
            stroke="none"
          />
          <rect
            x={xc - hw}
            y={laneY1 - BLOCK_D}
            width={BLOCK_W}
            height={BLOCK_D}
            fill={fill}
            stroke="none"
          />
        </g>
      ))}
    </>
  );
}

function laneBlocksRight(courtL: number, laneY0: number, laneY1: number, fill: string) {
  const hw = BLOCK_W / 2;
  return (
    <>
      {LANE_BLOCK_X.map((dFromBase) => {
        const xc = courtL - dFromBase;
        return (
          <g key={`RB-${dFromBase}`}>
            <rect x={xc - hw} y={laneY0} width={BLOCK_W} height={BLOCK_D} fill={fill} stroke="none" />
            <rect x={xc - hw} y={laneY1 - BLOCK_D} width={BLOCK_W} height={BLOCK_D} fill={fill} stroke="none" />
          </g>
        );
      })}
    </>
  );
}

export function LoginCourtBackground() {
  const { courtL, courtW, hoopInset, threePtR, laneW, laneDepth, ftCircleR, restrictedR, centerCircleR, sidelineOffset } =
    FEET;

  const midX = courtL / 2;
  const cy = courtW / 2;
  const hoopLx = hoopInset;
  const hoopRx = courtL - hoopInset;

  const laneY0 = (courtW - laneW) / 2;
  const laneY1 = laneY0 + laneW;

  const yBottom = sidelineOffset;
  const yTop = courtW - sidelineOffset;

  const x3Left = n(threePtMeetXFromLeftEnd(hoopLx, cy, threePtR, yBottom));
  /** Mirror of left so both ends match (right basket uses −dx, not +dx). */
  const x3Right = n(courtL - x3Left);

  const strokeMain = "rgba(180, 172, 158, 0.24)";
  const strokeKey = "rgba(180, 172, 158, 0.34)";
  const blockFill = "rgba(180, 172, 158, 0.26)";
  const strokeFt = "rgba(200, 192, 178, 0.42)";

  const xFtL = laneDepth;
  const xFtR = courtL - laneDepth;
  const r = ftCircleR;

  const leftPaintPath = `M 0 ${laneY0} L 0 ${laneY1} L ${xFtL} ${laneY1} L ${xFtL} ${laneY0} Z`;
  const rightPaintPath = `M ${courtL} ${laneY0} L ${courtL} ${laneY1} L ${xFtR} ${laneY1} L ${xFtR} ${laneY0} Z`;

  /** FT semicircle inside paint (toward basket) */
  const leftFtInside = `M ${xFtL} ${cy - r} A ${r} ${r} 0 0 0 ${xFtL - r} ${cy} A ${r} ${r} 0 0 0 ${xFtL} ${cy + r}`;
  /** FT semicircle outside paint (toward midcourt) */
  const leftFtOutside = `M ${xFtL} ${cy - r} A ${r} ${r} 0 0 1 ${xFtL + r} ${cy} A ${r} ${r} 0 0 1 ${xFtL} ${cy + r}`;

  const rightFtInside = `M ${xFtR} ${cy - r} A ${r} ${r} 0 0 1 ${xFtR + r} ${cy} A ${r} ${r} 0 0 1 ${xFtR} ${cy + r}`;
  const rightFtOutside = `M ${xFtR} ${cy - r} A ${r} ${r} 0 0 0 ${xFtR - r} ${cy} A ${r} ${r} 0 0 0 ${xFtR} ${cy + r}`;

  return (
    <div
      className="pointer-events-none absolute inset-0 select-none"
      aria-hidden
    >
      <svg
        className="h-full w-full min-h-[100dvh] opacity-90"
        viewBox={`0 0 ${courtL} ${courtW}`}
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
        shapeRendering="geometricPrecision"
      >
        <rect
          x="0"
          y="0"
          width={courtL}
          height={courtW}
          fill="none"
          stroke={strokeMain}
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
        />

        <line
          x1={midX}
          y1="0"
          x2={midX}
          y2={courtW}
          stroke={strokeMain}
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
        />
        <circle
          cx={midX}
          cy={cy}
          r={centerCircleR}
          fill="none"
          stroke={strokeMain}
          strokeWidth={1.75}
          vectorEffect="non-scaling-stroke"
        />

        {/* Left key */}
        <path
          d={leftPaintPath}
          fill="none"
          stroke={strokeKey}
          strokeWidth={1.85}
          strokeLinejoin="miter"
          strokeLinecap="butt"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d={leftFtInside}
          fill="none"
          stroke={strokeKey}
          strokeWidth={1.65}
          vectorEffect="non-scaling-stroke"
        />
        <path
          d={leftFtOutside}
          fill="none"
          stroke={strokeKey}
          strokeWidth={1.65}
          vectorEffect="non-scaling-stroke"
        />
        {/* Straight FT line on top — full 16′ chord (reads clearly vs arcs) */}
        <line
          x1={xFtL}
          y1={laneY0}
          x2={xFtL}
          y2={laneY1}
          stroke={strokeFt}
          strokeWidth={2.35}
          strokeLinecap="square"
          vectorEffect="non-scaling-stroke"
        />
        {laneBlocksLeft(laneY0, laneY1, blockFill)}
        <path
          d={`M ${hoopLx} ${cy - restrictedR} A ${restrictedR} ${restrictedR} 0 0 1 ${hoopLx + restrictedR} ${cy} A ${restrictedR} ${restrictedR} 0 0 1 ${hoopLx} ${cy + restrictedR}`}
          fill="none"
          stroke={strokeMain}
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
        />
        <path
          d={`M 0 ${yBottom} L ${x3Left} ${yBottom} M 0 ${yTop} L ${x3Left} ${yTop} M ${x3Left} ${yBottom} A ${threePtR} ${threePtR} 0 0 1 ${x3Left} ${yTop}`}
          fill="none"
          stroke={strokeMain}
          strokeWidth={1.75}
          vectorEffect="non-scaling-stroke"
        />

        {/* Right key */}
        <path
          d={rightPaintPath}
          fill="none"
          stroke={strokeKey}
          strokeWidth={1.85}
          strokeLinejoin="miter"
          strokeLinecap="butt"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d={rightFtInside}
          fill="none"
          stroke={strokeKey}
          strokeWidth={1.65}
          vectorEffect="non-scaling-stroke"
        />
        <path
          d={rightFtOutside}
          fill="none"
          stroke={strokeKey}
          strokeWidth={1.65}
          vectorEffect="non-scaling-stroke"
        />
        <line
          x1={xFtR}
          y1={laneY0}
          x2={xFtR}
          y2={laneY1}
          stroke={strokeFt}
          strokeWidth={2.35}
          strokeLinecap="square"
          vectorEffect="non-scaling-stroke"
        />
        {laneBlocksRight(courtL, laneY0, laneY1, blockFill)}
        <path
          d={`M ${hoopRx} ${cy - restrictedR} A ${restrictedR} ${restrictedR} 0 0 0 ${hoopRx - restrictedR} ${cy} A ${restrictedR} ${restrictedR} 0 0 0 ${hoopRx} ${cy + restrictedR}`}
          fill="none"
          stroke={strokeMain}
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
        />
        <path
          d={`M ${courtL} ${yBottom} L ${x3Right} ${yBottom} M ${courtL} ${yTop} L ${x3Right} ${yTop} M ${x3Right} ${yBottom} A ${threePtR} ${threePtR} 0 0 0 ${x3Right} ${yTop}`}
          fill="none"
          stroke={strokeMain}
          strokeWidth={1.75}
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      <div
        className="absolute inset-0 bg-gradient-to-b from-hardwood-900/50 via-transparent to-hardwood-900/60"
        aria-hidden
      />
    </div>
  );
}
