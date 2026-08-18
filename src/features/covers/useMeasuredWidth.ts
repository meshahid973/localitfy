import { useLayoutEffect, useRef, useState } from "react";

export function useMeasuredWidth<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    let frame = 0;
    let lastWidth = 0;
    const update = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const nextWidth = element.clientWidth || 0;
        if (Math.abs(nextWidth - lastWidth) < 8) return;
        lastWidth = nextWidth;
        setWidth(nextWidth);
      });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => { window.cancelAnimationFrame(frame); observer.disconnect(); };
  }, []);
  return [ref, width] as const;
}
