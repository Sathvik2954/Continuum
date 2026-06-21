import React from 'react';

interface VitalPoint {
  recordedAt: string;
  bpSystolic?: number;
  bpDiastolic?: number;
  weightKg?: number;
  heartRate?: number;
}

interface Props {
  vitals: VitalPoint[];
  metric: 'bp' | 'weight' | 'heartRate';
}

export const VitalsChart: React.FC<Props> = ({ vitals, metric }) => {
  if (vitals.length < 2) {
    return (
      <div className="glass-subtle rounded-md p-4 text-center text-[12px] text-[#78716C]">
        Log at least 2 readings to see a trend
      </div>
    );
  }

  const width = 560;
  const height = 120;
  const padding = 20;

  const getValue = (v: VitalPoint): number | null => {
    if (metric === 'bp') return v.bpSystolic ?? null;
    if (metric === 'weight') return v.weightKg ?? null;
    return v.heartRate ?? null;
  };

  const points = vitals
    .map((v) => ({ value: getValue(v), date: v.recordedAt, secondary: metric === 'bp' ? v.bpDiastolic : undefined }))
    .filter((p) => p.value !== null) as { value: number; date: string; secondary?: number }[];

  if (points.length < 2) {
    return (
      <div className="glass-subtle rounded-md p-4 text-center text-[12px] text-[#78716C]">
        Not enough data for this metric yet
      </div>
    );
  }

  const allValues = points.flatMap((p) => [p.value, p.secondary].filter((v): v is number => v !== undefined));
  const min = Math.min(...allValues) - 5;
  const max = Math.max(...allValues) + 5;
  const range = max - min || 1;

  const xStep = (width - padding * 2) / (points.length - 1);
  const toY = (val: number) => height - padding - ((val - min) / range) * (height - padding * 2);
  const toX = (i: number) => padding + i * xStep;

  const primaryPath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(i)} ${toY(p.value)}`).join(' ');
  const secondaryPath = metric === 'bp'
    ? points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(i)} ${toY(p.secondary ?? p.value)}`).join(' ')
    : null;

  const label = metric === 'bp' ? 'Blood pressure' : metric === 'weight' ? 'Weight (kg)' : 'Heart rate (bpm)';

  return (
    <div className="glass-subtle rounded-md p-4">
      <div className="text-[11px] font-medium text-sky-600 uppercase tracking-wider mb-2">{label}</div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
        <polyline
          fill="none"
          stroke="#38BDF8"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points.map((p, i) => `${toX(i)},${toY(p.value)}`).join(' ')}
        />
        {secondaryPath && (
          <polyline
            fill="none"
            stroke="#7DD4F8"
            strokeWidth="1.5"
            strokeDasharray="3 2"
            strokeLinecap="round"
            points={points.map((p, i) => `${toX(i)},${toY(p.secondary ?? p.value)}`).join(' ')}
          />
        )}
        {points.map((p, i) => (
          <circle key={i} cx={toX(i)} cy={toY(p.value)} r="3" fill="#0EA5E9" />
        ))}
      </svg>
      <div className="flex justify-between text-[10px] text-[#A8A29E] mt-1">
        <span>{new Date(points[0].date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
        <span>{new Date(points[points.length - 1].date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
      </div>
    </div>
  );
};
