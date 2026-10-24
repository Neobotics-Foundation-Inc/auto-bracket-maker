import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

interface Props {
  width: number;
  height: number;
  /** When false, content renders at natural size and the container scrolls. */
  fit: boolean;
  children: ReactNode;
}

const MAX_SCALE = 1.6;

/** Scales fixed-size content to fill the available space, for projector display. */
export function FitToScreen({ width, height, fit, children }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) =>
      setBox({ w: entry.contentRect.width, h: entry.contentRect.height }),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const scale = fit && box.w && box.h ? Math.min(box.w / width, box.h / height, MAX_SCALE) : 1;

  return (
    <div ref={ref} className={fit ? 'fit fit--on' : 'fit'}>
      <div className="fit__sizer" style={{ width: width * scale, height: height * scale }}>
        <div style={{ width, height, transform: `scale(${scale})`, transformOrigin: '0 0' }}>{children}</div>
      </div>
    </div>
  );
}
