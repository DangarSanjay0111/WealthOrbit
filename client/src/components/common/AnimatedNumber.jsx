import { useEffect, useRef, useState } from 'react';

/**
 * Smoothly tweens a numeric value whenever `value` changes (and counts up
 * from 0 on first mount). `format` turns the current animated number into the
 * displayed string (e.g. formatCurrency / formatPercent).
 */
export default function AnimatedNumber({ value = 0, format = (v) => v, duration = 250, className }) {
  const [display, setDisplay] = useState(0);
  const displayRef = useRef(0);
  const rafRef = useRef();

  useEffect(() => {
    const from = displayRef.current;
    const to = Number(value) || 0;
    if (from === to) {
      setDisplay(to);
      return;
    }

    let start = null;
    const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

    const step = (ts) => {
      if (start === null) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      const current = from + (to - from) * easeOutCubic(progress);
      displayRef.current = current;
      setDisplay(current);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        displayRef.current = to;
        setDisplay(to);
      }
    };

    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value, duration]);

  return <span className={className}>{format(display)}</span>;
}
