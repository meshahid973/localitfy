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

export function createVerticalDragConstraints(bounds: PhysicalVerticalDragBounds) {
  return {
    top: bounds.top,
    bottom: bounds.bottom,
    left: 0,
    right: 0
  };
}

