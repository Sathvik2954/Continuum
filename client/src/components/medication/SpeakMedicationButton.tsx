import React from 'react';
import { useTranslation } from 'react-i18next';
import { useTextToSpeech } from '../../lib/useTextToSpeech';

interface Props {
  medicineName: string;
  dosage: string;
  frequency: string;
  durationDays: number;
  instructions?: string;
}

export const SpeakMedicationButton: React.FC<Props> = ({
  medicineName, dosage, frequency, durationDays, instructions,
}) => {
  const { t, i18n } = useTranslation();
  const { speak, stop, speaking, supported } = useTextToSpeech();

  const buildSpeechText = (): string => {
    const parts = [
      medicineName,
      `${t('medication.dosage')}: ${dosage}`,
      `${t('medication.frequency')}: ${frequency}`,
      `${t('medication.duration')}: ${durationDays} ${i18n.language === 'en' ? 'days' : ''}`,
    ];
    if (instructions) parts.push(instructions);
    return parts.join('. ');
  };

  if (!supported) return null;

  return (
    <button
      type="button"
      onClick={() => (speaking ? stop() : speak(buildSpeechText(), i18n.language))}
      className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-pill"
      style={{
        background: speaking ? 'rgba(239,68,68,0.18)' : 'rgba(14,165,233,0.18)',
        border: `0.5px solid ${speaking ? 'rgba(239,68,68,0.40)' : 'rgba(14,165,233,0.40)'}`,
        color: speaking ? '#991B1B' : '#0284C7',
      }}
      aria-label={t('medication.listenToInstructions')}
    >
      {speaking ? '⏸' : '🔊'} {t('medication.listenToInstructions')}
    </button>
  );
};
