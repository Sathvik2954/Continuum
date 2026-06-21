import React from 'react';
import { GlassCard } from '../ui/GlassCard';

interface Condition {
  _id: string;
  conditionName: string;
  severity: 'MILD' | 'MODERATE' | 'SEVERE';
  status: 'ACTIVE' | 'RESOLVED';
}

interface Medication {
  _id: string;
  medicineName: string;
  dosage: string;
  frequency: string;
}

interface Props {
  activeConditions: Condition[];
  activeMedications: Medication[];
}

const SEVERITY_COLOR: Record<string, { bg: string; border: string; text: string }> = {
  MILD:     { bg: 'rgba(168,162,158,0.16)', border: 'rgba(168,162,158,0.35)', text: '#57534E' },
  MODERATE: { bg: 'rgba(245,158,11,0.16)',  border: 'rgba(245,158,11,0.40)',  text: '#78350F' },
  SEVERE:   { bg: 'rgba(239,68,68,0.16)',   border: 'rgba(239,68,68,0.40)',   text: '#991B1B' },
};

export const HealthSummaryCard: React.FC<Props> = ({ activeConditions, activeMedications }) => {
  if (activeConditions.length === 0 && activeMedications.length === 0) return null;

  return (
    <GlassCard className="p-5 mb-5">
      {activeConditions.length > 0 && (
        <div className="mb-4">
          <div className="text-[11px] font-medium text-[#7A5C14] uppercase tracking-wider mb-2">
            Active conditions
          </div>
          <div className="flex flex-wrap gap-2">
            {activeConditions.map((c) => {
              const colors = SEVERITY_COLOR[c.severity];
              return (
                <span
                  key={c._id}
                  className="text-[12px] font-medium px-3 py-1.5 rounded-pill"
                  style={{ background: colors.bg, border: `0.5px solid ${colors.border}`, color: colors.text }}
                >
                  {c.conditionName}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {activeMedications.length > 0 && (
        <div>
          <div className="text-[11px] font-medium text-[#7A5C14] uppercase tracking-wider mb-2">
            Active medications
          </div>
          <div className="space-y-1.5">
            {activeMedications.map((m) => (
              <div key={m._id} className="text-[13px] text-sky-900">
                <span className="font-medium">{m.medicineName}</span>
                <span className="text-[#78716C]"> · {m.dosage} · {m.frequency}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </GlassCard>
  );
};
