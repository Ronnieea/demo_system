import React, { useRef, useEffect } from "react";

interface VADPoint {
  valence: number; // 0~1
  arousal: number; // 0~1
  isNew: boolean; // 最新一筆為 true，其它為 false
  timestamp: number;
}

interface VADRadarProps {
  vadPoints: VADPoint[];
}

export const VADRadar: React.FC<VADRadarProps> = ({ vadPoints }) => {
  // SVG 大小
  const width = 300;
  const height = 300;
  // 中心座標
  const cx = width / 2;
  const cy = height / 2;
  // 半徑 (留點邊距)
  const R = 120;

  // 幾道同心虛線圓
  const rings = [0.25, 0.5, 0.75, 1];

  return (
    <svg width={width} height={height}>
      {/* 外層黑色實線圓 */}
      <circle cx={cx} cy={cy} r={R} fill="none" stroke="#333" strokeWidth={2} />

      {/* 同心虛線圓 */}
      {rings.map((ratio) => (
        <circle
          key={ratio}
          cx={cx}
          cy={cy}
          r={R * ratio}
          fill="none"
          stroke="#ccc"
          strokeWidth={1}
          strokeDasharray="4 4"
        />
      ))}

      {/* 垂直中軸 (Arousal) */}
      <line
        x1={cx}
        y1={cy - R}
        x2={cx}
        y2={cy + R}
        stroke="#888"
        strokeWidth={1}
        strokeDasharray="2 4"
      />
      {/* 水平中軸 (Valence) */}
      <line
        x1={cx - R}
        y1={cy}
        x2={cx + R}
        y2={cy}
        stroke="#888"
        strokeWidth={1}
        strokeDasharray="2 4"
      />

      {/* 標記四個象限方向文字 */}
      <text
        x={cx}
        y={cy - R - 10}
        textAnchor="middle"
        fill="#000"
        fontSize="12"
      >
        High A
      </text>
      <text
        x={cx}
        y={cy + R + 15}
        textAnchor="middle"
        fill="#000"
        fontSize="12"
      >
        Low A
      </text>
      <text
        x={cx + R + 10}
        y={cy + 4}
        textAnchor="start"
        fill="#000"
        fontSize="12"
      >
        +V
      </text>
      <text
        x={cx - R - 10}
        y={cy + 4}
        textAnchor="end"
        fill="#000"
        fontSize="12"
      >
        -V
      </text>

      {/* 繪製所有歷史點 + 最新點 */}
      {vadPoints.map((p, idx) => {
        // 把 [0,1] 映射到 [-1,1]
        const normX = p.valence * 2 - 1;
        const normY = p.arousal * 2 - 1;
        // 計算實際的畫素位置
        const px = cx + normX * R;
        const py = cy - normY * R; // SVG y 軸向下為正
        return (
          <circle
            key={idx}
            cx={px}
            cy={py}
            r={6}
            fill={p.isNew ? "red" : "gray"}
            opacity={p.isNew ? 1 : 0.4}
          />
        );
      })}
    </svg>
  );
};
