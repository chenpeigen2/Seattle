import { useEffect, useRef, useState } from "react";

interface Props {
  breaths: { x: number; y: number }[];
}

interface Bloom {
  id: number;
  x: number;
  y: number;
  delay: number;
  size: number;
}

export default function Breaths({ breaths }: Props) {
  const [blooms, setBlooms] = useState<Bloom[]>([]);
  const idRef = useRef(0);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const created = breaths.slice(0, 5).map((breath) => ({
      id: idRef.current++,
      x: Math.min(92, Math.max(8, breath.x + (Math.random() * 6 - 3))),
      y: Math.min(88, Math.max(12, breath.y + (Math.random() * 6 - 3))),
      delay: Math.random() * 1.6,
      size: 130 + Math.random() * 130,
    }));
    if (created.length === 0) return;
    setBlooms((current) => [...current, ...created].slice(-7));
    for (const bloom of created) {
      const timeout = window.setTimeout(() => {
        setBlooms((current) => current.filter((entry) => entry.id !== bloom.id));
      }, 9_500);
      timers.current.push(timeout);
    }
  }, [breaths]);

  useEffect(() => () => timers.current.forEach((timer) => window.clearTimeout(timer)), []);

  return (
    <div className="breaths" aria-hidden="true">
      {blooms.map((bloom) => (
        <span
          key={bloom.id}
          className="breath"
          style={{
            left: `${bloom.x}%`,
            top: `${bloom.y}%`,
            width: `${bloom.size}px`,
            height: `${bloom.size}px`,
            animationDelay: `${bloom.delay}s`,
          }}
        />
      ))}
    </div>
  );
}
