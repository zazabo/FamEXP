interface Option {
  value: string;
  label: string;
}

interface Props {
  options: Option[];
  value: string | null;
  onChange: (value: string) => void;
  ariaLabel: string;
  hint?: string;
}

/** Single-choice, single-tap pills (For whom / Paid by). */
export function Pills({ options, value, onChange, ariaLabel, hint }: Props) {
  return (
    <div className="pills" role="radiogroup" aria-label={ariaLabel} title={hint ?? ariaLabel}>
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value}
          className={`pill${value === o.value ? ' selected' : ''}`} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
