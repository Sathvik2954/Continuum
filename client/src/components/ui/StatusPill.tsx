import React from 'react';

type PillVariant =
  | 'urgent' | 'high' | 'normal'
  | 'active' | 'pending' | 'declined' | 'revoked' | 'expired'
  | 'synced' | 'verified' | 'unverified';

interface Props {
  variant: PillVariant;
  label?: string;
}

const STYLES: Record<PillVariant, { bg: string; border: string; text: string; dot: string }> = {
  urgent:    { bg: 'rgba(239,68,68,0.16)',    border: 'rgba(239,68,68,0.40)',    text: '#991B1B', dot: '#EF4444' },
  high:      { bg: 'rgba(245,158,11,0.16)',   border: 'rgba(245,158,11,0.40)',   text: '#78350F', dot: '#F59E0B' },
  normal:    { bg: 'rgba(168,162,158,0.16)',  border: 'rgba(168,162,158,0.35)', text: '#57534E', dot: '#A8A29E' },
  active:    { bg: 'rgba(16,185,129,0.16)',   border: 'rgba(16,185,129,0.40)',   text: '#065F46', dot: '#10B981' },
  pending:   { bg: 'rgba(245,158,11,0.16)',   border: 'rgba(245,158,11,0.40)',   text: '#78350F', dot: '#F59E0B' },
  declined:  { bg: 'rgba(168,162,158,0.16)',  border: 'rgba(168,162,158,0.35)', text: '#57534E', dot: '#A8A29E' },
  revoked:   { bg: 'rgba(239,68,68,0.12)',    border: 'rgba(239,68,68,0.30)',    text: '#991B1B', dot: '#EF4444' },
  expired:   { bg: 'rgba(168,162,158,0.16)',  border: 'rgba(168,162,158,0.35)', text: '#57534E', dot: '#A8A29E' },
  synced:    { bg: 'rgba(16,185,129,0.16)',   border: 'rgba(16,185,129,0.40)',   text: '#065F46', dot: '#10B981' },
  verified:  { bg: 'rgba(16,185,129,0.16)',   border: 'rgba(16,185,129,0.40)',   text: '#065F46', dot: '#10B981' },
  unverified:{ bg: 'rgba(245,158,11,0.16)',   border: 'rgba(245,158,11,0.40)',   text: '#78350F', dot: '#F59E0B' },
};

const LABELS: Record<PillVariant, string> = {
  urgent: 'Urgent', high: 'High', normal: 'Normal',
  active: 'Active', pending: 'Pending', declined: 'Declined',
  revoked: 'Revoked', expired: 'Expired', synced: 'Synced',
  verified: 'Verified', unverified: 'Pending verification',
};

export const StatusPill: React.FC<Props> = ({ variant, label }) => {
  const s = STYLES[variant];
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-pill backdrop-blur-sm"
      style={{ background: s.bg, border: `0.5px solid ${s.border}`, color: s.text }}
    >
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: s.dot }} />
      {label ?? LABELS[variant]}
    </span>
  );
};
