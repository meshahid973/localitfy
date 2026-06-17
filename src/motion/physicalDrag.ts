export type PhysicalSnapPoint = {
  id: string;
  value: number;
};

export type PhysicalDragBounds = {
  min: number;
  max: number;
};

export type PhysicalVerticalDragBounds = {
  top: number;
  bottom: number;
};

export const physicalDragDefaults = {
  dragElastic: 0.08,
  dragMomentum: false,
  spring: {
    type: "spring",
    stiffness: 420,
    damping: 36,
    mass: 0.86
  }
} as const;

export const updateIslandDragBounds: PhysicalVerticalDragBounds = {
  top: -10,
  bottom: 18
};

export function clampToBounds(value: number, bounds: PhysicalDragBounds) {
  if (!Number.isFinite(value)) return bounds.min;
  return Math.min(bounds.max, Math.max(bounds.min, value));
}

export function normalizeDragBounds(bounds: PhysicalDragBounds): PhysicalDragBounds {
  const min = Number(bounds.min);
  const max = Number(bounds.max);

  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return { min: 0, max: 0 };
  }

  if (min <= max) return { min, max };
  return { min: max, max: min };
}

export function applyBoundaryResistance(value: number, bounds: PhysicalDragBounds, resistance = 0.18) {
  const safeBounds = normalizeDragBounds(bounds);
  const safeResistance = clampToBounds(Number(resistance), { min: 0, max: 1 });

  if (!Number.isFinite(value)) return safeBounds.min;
  if (value < safeBounds.min) return safeBounds.min + (value - safeBounds.min) * safeResistance;
  if (value > safeBounds.max) return safeBounds.max + (value - safeBounds.max) * safeResistance;
  return value;
}

export function nearestSnapPoint(value: number, points: readonly PhysicalSnapPoint[]) {
  if (!points.length) return null;

  return points.reduce((best, point) => {
    return Math.abs(point.value - value) < Math.abs(best.value - value) ? point : best;
  }, points[0]);
}

export function snapValue(value: number, points: readonly PhysicalSnapPoint[], bounds?: PhysicalDragBounds) {
  const safeValue = bounds ? clampToBounds(value, normalizeDragBounds(bounds)) : value;
  const point = nearestSnapPoint(safeValue, points);
  return point?.value ?? safeValue;
}

export function snapId(value: number, points: readonly PhysicalSnapPoint[], bounds?: PhysicalDragBounds) {
  const safeValue = bounds ? clampToBounds(value, normalizeDragBounds(bounds)) : value;
  const point = nearestSnapPoint(safeValue, points);
  return point?.id ?? "";
}

export function createCenterOpenSnapPoints(center: number, open: number): PhysicalSnapPoint[] {
  return [
    { id: "center", value: center },
    { id: "open", value: open }
  ];
}

export function createVerticalDragConstraints(bounds: PhysicalVerticalDragBounds) {
  return {
    top: bounds.top,
    bottom: bounds.bottom,
    left: 0,
    right: 0
  };
}

export function createHorizontalDragProps(bounds: PhysicalDragBounds) {
  const safeBounds = normalizeDragBounds(bounds);

  return {
    drag: "x",
    dragConstraints: { left: safeBounds.min, right: safeBounds.max, top: 0, bottom: 0 },
    dragElastic: physicalDragDefaults.dragElastic,
    dragMomentum: physicalDragDefaults.dragMomentum
  } as const;
}

export function createVerticalDragProps(bounds: PhysicalDragBounds) {
  const safeBounds = normalizeDragBounds(bounds);

  return {
    drag: "y",
    dragConstraints: { left: 0, right: 0, top: safeBounds.min, bottom: safeBounds.max },
    dragElastic: physicalDragDefaults.dragElastic,
    dragMomentum: physicalDragDefaults.dragMomentum
  } as const;
}

export function createMotionDragProps(bounds: PhysicalDragBounds) {
  const safeBounds = normalizeDragBounds(bounds);

  return {
    dragConstraints: { left: safeBounds.min, right: safeBounds.max, top: safeBounds.min, bottom: safeBounds.max },
    dragElastic: physicalDragDefaults.dragElastic,
    dragMomentum: physicalDragDefaults.dragMomentum
  } as const;
}
