import { useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Delete, ScanFace } from 'lucide-react';
import { PIN_LENGTH } from '../services/pin';

interface Props {
  value: string;
  onChange: (value: string) => void;
  /** Called once the 4th digit is entered. */
  onComplete: (pin: string) => void;
  disabled?: boolean;
  /** Shows the Face ID / fingerprint key in the bottom-left corner. */
  onBiometric?: (() => void) | undefined;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

/** Thumb-friendly 4-digit keypad with dots. Also accepts the physical keyboard (desktop). */
export function PinPad({ value, onChange, onComplete, disabled = false, onBiometric }: Props) {
  const { t } = useTranslation();

  const press = useCallback(
    (digit: string) => {
      if (disabled || value.length >= PIN_LENGTH) return;
      const next = value + digit;
      onChange(next);
      if (next.length === PIN_LENGTH) onComplete(next);
    },
    [disabled, value, onChange, onComplete],
  );
  const backspace = useCallback(() => {
    if (!disabled) onChange(value.slice(0, -1));
  }, [disabled, value, onChange]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === 'Backspace') backspace();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [press, backspace]);

  return (
    <div className="pin">
      <div
        className="pin-dots"
        role="status"
        aria-label={t('lock.pinProgress', { n: value.length })}
        title={t('lock.pinProgress', { n: value.length })}
      >
        {Array.from({ length: PIN_LENGTH }, (_, i) => (
          <span key={i} className={`pin-dot${i < value.length ? ' filled' : ''}`} />
        ))}
      </div>
      <div className="pinpad" role="group" aria-label={t('lock.keypad')}>
        {KEYS.map((d) => (
          <button key={d} type="button" className="pin-key" disabled={disabled} onClick={() => press(d)}
            aria-label={t('lock.digit', { d })} title={t('lock.digit', { d })}>
            {d}
          </button>
        ))}
        {onBiometric ? (
          <button type="button" className="pin-key pin-key-ghost" disabled={disabled} onClick={onBiometric}
            aria-label={t('lock.useBiometrics')} title={t('lock.useBiometrics')}>
            <ScanFace size={28} strokeWidth={1.7} />
          </button>
        ) : (
          <span />
        )}
        <button type="button" className="pin-key" disabled={disabled} onClick={() => press('0')}
          aria-label={t('lock.digit', { d: '0' })} title={t('lock.digit', { d: '0' })}>
          0
        </button>
        <button type="button" className="pin-key pin-key-ghost" disabled={disabled || !value} onClick={backspace}
          aria-label={t('lock.backspace')} title={t('lock.backspace')}>
          <Delete size={26} strokeWidth={1.7} />
        </button>
      </div>
    </div>
  );
}
