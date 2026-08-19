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

export function applyBoundaryResistance(value: number, bounds: PhysicalDragBounds, resistance = 0.18) {
  if (value < bounds.min) return bounds.min + (value - bounds.min) * resistance;
  if (value > bounds.max) return bounds.max + (value - bounds.max) * resistance;
  return value;
}

export function nearestSnapPoint(value: number, points: readonly PhysicalSnapPoint[]) {
  if (!points.length) return null;

  return points.reduce((best, point) => {
    return Math.abs(point.value - value) < Math.abs(best.value - value) ? point : best;
  }, points[0]);
}

export function snapValue(value: number, points: readonly PhysicalSnapPoint[], bounds?: PhysicalDragBounds) {
  const point = nearestSnapPoint(bounds ? clampToBounds(value, bounds) : value, points);
  return point?.value ?? value;
}

export function snapId(value: number, points: readonly PhysicalSnapPoint[], bounds?: PhysicalDragBounds) {
  const point = nearestSnapPoint(bounds ? clampToBounds(value, bounds) : value, points);
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

export function createMotionDragProps(bounds: PhysicalDragBounds) {
  return {
    dragConstraints: { left: bounds.min, right: bounds.max, top: bounds.min, bottom: bounds.max },
    dragElastic: physicalDragDefaults.dragElastic,
    dragMomentum: physicalDragDefaults.dragMomentum
  } as const;
}

