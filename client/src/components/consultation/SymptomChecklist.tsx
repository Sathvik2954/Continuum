import React from 'react';

export interface SymptomsState {
  fever: boolean;
  cough: boolean;
  breathlessness: boolean;
  chestPain: boolean;
  headache: boolean;
  fatigue: boolean;
  nausea: boolean;
  dizziness: boolean;
  swelling: boolean;
  other: string;
}

export const EMPTY_SYMPTOMS: SymptomsState = {
  fever: false, cough: false, breathlessness: false, chestPain: false,
  headache: false, fatigue: false, nausea: false, dizziness: false,
  swelling: false, other: '',
};

const SYMPTOM_OPTIONS: { key: keyof Omit<SymptomsState, 'other'>; label: string }[] = [
  { key: 'fever', label: 'Fever' },
  { key: 'cough', label: 'Cough' },
  { key: 'breathlessness', label: 'Breathlessness' },
  { key: 'chestPain', label: 'Chest pain' },
  { key: 'headache', label: 'Headache' },
  { key: 'fatigue', label: 'Fatigue' },
  { key: 'nausea', label: 'Nausea' },
  { key: 'dizziness', label: 'Dizziness' },
  { key: 'swelling', label: 'Swelling' },
];

interface Props {
  value: SymptomsState;
  onChange: (next: SymptomsState) => void;
}

export const SymptomChecklist: React.FC<Props> = ({ value, onChange }) => {
  const toggle = (key: keyof Omit<SymptomsState, 'other'>) => {
    onChange({ ...value, [key]: !value[key] });
  };

  return (
    <div>
      <label className="block text-[12px] font-medium text-sky-600 mb-2">
        Symptoms - select all that apply
      </label>
      <div className="flex flex-wrap gap-2 mb-3">
        {SYMPTOM_OPTIONS.map((opt) => {
          const active = value[opt.key];
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => toggle(opt.key)}
              className="text-[13px] font-medium px-3.5 py-1.5 rounded-pill transition-all duration-150"
              style={
                active
                  ? { background: 'rgba(14,165,233,0.22)', border: '0.5px solid rgba(14,165,233,0.50)', color: '#0284C7' }
                  : { background: 'rgba(255,255,255,0.14)', border: '0.5px solid rgba(255,255,255,0.35)', color: '#78716C' }
              }
            >
              {opt.label}
            </button>
          );
        })}
      </div>
      <textarea
        value={value.other}
        onChange={(e) => onChange({ ...value, other: e.target.value })}
        placeholder="Other symptoms or details (optional)"
        rows={2}
        className="glass-input w-full px-3 py-2 text-[14px] text-sky-900 placeholder:text-[#A8A29E] resize-none"
      />
    </div>
  );
};
