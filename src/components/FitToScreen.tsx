import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

export interface Box {
  w: number;
  h: number;
}

interface Props {
  width: number;
  height: number;
  /** When false, content renders at natural size and the container scrolls. */
  fit: boolean;
  /** Largest enlargement; present mode allows more, so a projected screen is filled. */
  maxScale?: number;
  /** Reports the space available, so content can arrange itself to fill it. */
  onBox?: (box: Box) => void;
  children: ReactNode;
}

const MAX_SCALE = 1.6;

/** Scales fixed-size content to fill the available space, for projector display. */
export function FitToScreen({ width, height, fit, maxScale = MAX_SCALE, onBox, children }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<Box>({ w: 0, h: 0 });
  const report = useRef(onBox);
  report.current = onBox;

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const next = { w: entry.contentRect.width, h: entry.contentRect.height };
      setBox(next);
      report.current?.(next);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const scale = fit && box.w && box.h ? Math.min(box.w / width, box.h / height, maxScale) : 1;

  return (
    <div ref={ref} className={fit ? 'fit fit--on' : 'fit'}>
      <div className="fit__sizer" style={{ width: width * scale, height: height * scale }}>
        <div style={{ width, height, transform: `scale(${scale})`, transformOrigin: '0 0' }}>{children}</div>
      </div>
    </div>
  );
}
