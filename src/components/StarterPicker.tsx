import { PIECES } from "../rng";
import type { StarterFilter, StarterSlot } from "../search/types";
import { PieceIcon } from "./PieceIcon";
import { PixelToggle } from "./ui/PixelToggle";
import { SectionHeader } from "./ui/SectionHeader";

interface StarterPickerProps {
  value: StarterFilter;
  onChange: (next: StarterFilter) => void;
}

const OPTIONS: StarterSlot[] = ["ANY", ...PIECES];

export function StarterPicker({ value, onChange }: StarterPickerProps) {
  const setSlot = (idx: number, slot: StarterSlot) => {
    const slots: [StarterSlot, StarterSlot, StarterSlot] = [...value.slots];
    slots[idx] = slot;
    onChange({ ...value, slots });
  };

  return (
    <section className="space-y-3">
      <SectionHeader title="Starter pieces" caption="slots are interchangeable" />
      <div className="space-y-2">
        {[0, 1, 2].map((idx) => (
          <SlotRow
            key={idx}
            value={value.slots[idx]}
            onChange={(slot) => setSlot(idx, slot)}
          />
        ))}
      </div>
    </section>
  );
}

interface SlotRowProps {
  value: StarterSlot;
  onChange: (slot: StarterSlot) => void;
}

function SlotRow({ value, onChange }: SlotRowProps) {
  return (
    <div className="inset-row">
      <div className="flex flex-1 gap-1.5">
        {OPTIONS.map((opt) => (
          <PixelToggle
            key={opt}
            active={opt === value}
            onClick={() => onChange(opt)}
            title={opt}
            className="flex aspect-square flex-1 items-center justify-center"
          >
            {opt === "ANY" ? (
              <span className="font-display text-xs uppercase tracking-wider sm:text-sm">
                any
              </span>
            ) : (
              <PieceIcon
                piece={opt}
                variant="w"
                size={null}
                className="h-6 sm:h-9"
              />
            )}
          </PixelToggle>
        ))}
      </div>
    </div>
  );
}
