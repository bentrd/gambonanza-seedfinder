import { useEffect, useState } from "react";
import { ChipButton } from "./ui/Chip";

const STORAGE_KEY = "gambonanza.crt.intensity";
const DEFAULT_INTENSITY = 0.6;

function readStoredIntensity(): number {
  if (typeof window === "undefined") return DEFAULT_INTENSITY;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw === null) return DEFAULT_INTENSITY;
  const parsed = Number.parseFloat(raw);
  if (!Number.isFinite(parsed)) return DEFAULT_INTENSITY;
  return Math.min(1, Math.max(0, parsed));
}

interface CRTOverlayProps {
  className?: string;
}

export function CRTOverlay({ className = "" }: CRTOverlayProps) {
  const [intensity, setIntensity] = useState<number>(readStoredIntensity);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, intensity.toFixed(3));
    document.documentElement.style.setProperty(
      "--crt-intensity",
      intensity.toFixed(3),
    );
  }, [intensity]);

  return (
    <div className={`relative ${className}`}>
      <div
        aria-hidden
        className="crt-overlay"
        style={{ opacity: intensity }}
      />

      <ChipButton onClick={() => setOpen((v) => !v)}>
        CRT {Math.round(intensity * 100)}%
      </ChipButton>

      {open && (
        <div className="absolute right-0 top-full z-[10000] mt-2 w-56 card-cream p-3">
          <label className="block text-[11px] uppercase tracking-wider text-[var(--color-wine-dark)]">
            CRT Intensity
          </label>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={intensity}
            onChange={(e) => setIntensity(Number.parseFloat(e.target.value))}
            className="mt-2 w-full accent-[var(--color-wine)]"
          />
          <div className="mt-1 flex justify-between text-[10px] uppercase tracking-wider text-[var(--color-wine-dark)]/70">
            <span>off</span>
            <span>{Math.round(intensity * 100)}%</span>
            <span>full</span>
          </div>
        </div>
      )}
    </div>
  );
}
