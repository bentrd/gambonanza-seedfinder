import { useEffect, useRef, useState } from "react";
import { IconButton } from "./IconButton";

interface CopyButtonProps {
  /** The string to copy to the clipboard. */
  value: string;
  /** Default label (shown when idle). Defaults to "copy". */
  label?: string;
  /** Label shown for `feedbackMs` after a successful copy. Defaults to "copied!". */
  successLabel?: string;
  feedbackMs?: number;
  className?: string;
}

export function CopyButton({
  value,
  label = "copy",
  successLabel = "copied!",
  feedbackMs = 1200,
  className = "",
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, []);

  const onClick = () => {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    void navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => setCopied(false), feedbackMs);
    });
  };

  return (
    <IconButton
      onClick={onClick}
      size="md"
      // Fixed min width so the label swap doesn't shift layout.
      className={`min-w-[78px] ${className}`}
      aria-live="polite"
    >
      {copied ? successLabel : label}
    </IconButton>
  );
}
