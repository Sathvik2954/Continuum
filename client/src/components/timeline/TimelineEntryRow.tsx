import React from 'react';
import { SpeakMedicationButton } from '../medication/SpeakMedicationButton';

interface Props {
  type: 'consultation' | 'condition' | 'medication' | 'vital' | 'document';
  title: string;
  subtitle: string;
  timestamp: string;
  meta: Record<string, unknown>;
  isLast: boolean;
  onClick?: () => void;
}

const DOT_COLOR: Record<string, string> = {
  consultation: '#0EA5E9',
  condition: '#F59E0B',
  medication: '#10B981',
  vital: '#A8A29E',
  document: '#C49A38',
};

const formatRelative = (iso: string): string => {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) {
    const hrs = Math.floor(diff / (1000 * 60 * 60));
    if (hrs === 0) return 'Just now';
    return `${hrs}h ago`;
  }
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
};

export const TimelineEntryRow: React.FC<Props> = ({
  type, title, subtitle, timestamp, meta, isLast, onClick,
}) => {
  const dotColor = DOT_COLOR[type] ?? '#A8A29E';
  const isUrgent = meta.priority === 'URGENT';
  const isHigh = meta.priority === 'HIGH';
  const dotActualColor = isUrgent ? '#EF4444' : isHigh ? '#F59E0B' : dotColor;

  return (
    <div
      onClick={onClick}
      className={`flex gap-3 py-3 ${onClick ? 'cursor-pointer hover:bg-[rgba(255,255,255,0.10)] -mx-2 px-2 rounded-md transition-colors duration-150' : ''}`}
    >
      <div className="flex flex-col items-center flex-shrink-0 pt-0.5">
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: dotActualColor }} />
        {!isLast && (
          <span className="w-[1.5px] flex-1 mt-1" style={{ background: 'rgba(14,165,233,0.25)', minHeight: '20px' }} />
        )}
      </div>

      <div className="flex-1 min-w-0 pb-1">
        <div className="text-[14px] font-medium text-sky-900 capitalize">{title}</div>
        <div className="text-[12px] text-[#78716C] mt-0.5">{subtitle}</div>
        {Boolean(meta.hasAudio) && (
          <div className="text-[11px] text-sky-600 mt-1">🎙 Audio attached</div>
        )}
        {type === 'medication' && (
          <div className="mt-2">
            <SpeakMedicationButton
              medicineName={meta.medicineName as string || title.split(' — ')[0]}
              dosage={meta.dosage as string || title.split(' — ')[1] || ''}
              frequency={meta.frequency as string || subtitle.split(' · ')[0] || ''}
              durationDays={meta.durationDays as number || parseInt(subtitle.split(' · ')[1]) || 1}
              instructions={meta.instructions as string}
            />
          </div>
        )}
      </div>

      <div className="text-[11px] text-[#A8A29E] flex-shrink-0 whitespace-nowrap pt-0.5">
        {formatRelative(timestamp)}
      </div>
    </div>
  );
};
