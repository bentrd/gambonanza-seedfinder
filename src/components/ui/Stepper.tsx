interface StepperProps {
  label?: string;
  value: number;
  min: number;
  max: number;
  onChange: (next: number) => void;
}

export function Stepper({ label, value, min, max, onChange }: StepperProps) {
  const set = (n: number) => {
    if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)));
  };

  return (
    <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-[var(--color-wine-dark)]/80">
      {label && <span>{label}</span>}
      <button
        type="button"
        className="step-btn"
        onClick={() => set(value - 1)}
        disabled={value <= min}
        aria-label={label ? `decrease ${label}` : "decrease"}
      >
        ‹
      </button>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => set(parseInt(e.target.value, 10))}
        className="input-game w-12 text-center"
        aria-label={label}
      />
      <button
        type="button"
        className="step-btn"
        onClick={() => set(value + 1)}
        disabled={value >= max}
        aria-label={label ? `increase ${label}` : "increase"}
      >
        ›
      </button>
    </div>
  );
}
