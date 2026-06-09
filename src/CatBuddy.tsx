// @ts-nocheck
import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import "./cat-buddy.css";

type CatBuddyProps = {
  enabled: boolean;
  reducedMotion?: boolean;
};

type CatAnimationId =
  | "idle"
  | "walk"
  | "run"
  | "meow"
  | "laying"
  | "itch"
  | "sleeping1"
  | "sleeping2"
  | "sitting"
  | "licking1"
  | "licking2"
  | "stretching";

type CatAnimation = {
  id: CatAnimationId;
  src: string;
  frames: number;
  duration: number;
  loop?: boolean;
  holdLastFrame?: boolean;
};

const catAnimations: Record<CatAnimationId, CatAnimation> = {
  idle: {
    id: "idle",
    src: new URL("./assets/cat-4/Cat-4-Idle.png", import.meta.url).href,
    frames: 10,
    duration: 760,
    loop: true
  },
  walk: {
    id: "walk",
    src: new URL("./assets/cat-4/Cat-4-Walk.png", import.meta.url).href,
    frames: 8,
    duration: 560,
    loop: true
  },
  run: {
    id: "run",
    src: new URL("./assets/cat-4/Cat-4-Run.png", import.meta.url).href,
    frames: 8,
    duration: 360,
    loop: true
  },
  meow: {
    id: "meow",
    src: new URL("./assets/cat-4/Cat-4-Meow.png", import.meta.url).href,
    frames: 4,
    duration: 420,
    loop: false,
    holdLastFrame: true
  },
  laying: {
    id: "laying",
    src: new URL("./assets/cat-4/Cat-4-Laying.png", import.meta.url).href,
    frames: 8,
    duration: 780,
    loop: false,
    holdLastFrame: true
  },
  itch: {
    id: "itch",
    src: new URL("./assets/cat-4/Cat-4-Itch.png", import.meta.url).href,
    frames: 2,
    duration: 300,
    loop: false,
    holdLastFrame: true
  },
  sleeping1: {
    id: "sleeping1",
    src: new URL("./assets/cat-4/Cat-4-Sleeping1.png", import.meta.url).href,
    frames: 1,
    duration: 1200,
    loop: true
  },
  sleeping2: {
    id: "sleeping2",
    src: new URL("./assets/cat-4/Cat-4-Sleeping2.png", import.meta.url).href,
    frames: 1,
    duration: 1200,
    loop: true
  },
  sitting: {
    id: "sitting",
    src: new URL("./assets/cat-4/Cat-4-Sitting.png", import.meta.url).href,
    frames: 1,
    duration: 1200,
    loop: true
  },
  licking1: {
    id: "licking1",
    src: new URL("./assets/cat-4/Cat-4-Licking 1.png", import.meta.url).href,
    frames: 5,
    duration: 560,
    loop: false,
    holdLastFrame: true
  },
  licking2: {
    id: "licking2",
    src: new URL("./assets/cat-4/Cat-4-Licking 2.png", import.meta.url).href,
    frames: 5,
    duration: 560,
    loop: false,
    holdLastFrame: true
  },
  stretching: {
    id: "stretching",
    src: new URL("./assets/cat-4/Cat-4-Stretching.png", import.meta.url).href,
    frames: 13,
    duration: 980,
    loop: false,
    holdLastFrame: true
  }
};

const CAT_WIDTH = 96;
const CAT_HEIGHT = 96;
const CAT_CENTER_X = 58;
const CAT_CENTER_Y = 74;
const CAT_STOP_DISTANCE = 34;
const CAT_WALK_SPEED = 165;
const CAT_RUN_SPEED = 315;
const CAT_MAX_DIRECTION_TILT = 78 * Math.PI / 180;
const SINGLE_CLICK_DELAY_MS = 230;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function lerp(from: number, to: number, amount: number) {
  return from + (to - from) * amount;
}

function nowMs() {
  return performance.now();
}

function pickIdleAction() {
  const actions: CatAnimationId[] = ["sitting", "itch", "licking1", "licking2", "stretching", "meow"];
  return actions[Math.floor(Math.random() * actions.length)] || "sitting";
}

function getCatSingletonKey() {
  return "__localtifyCatBuddyPrimaryV405";
}

function actionDuration(animation: CatAnimationId, wantedDuration: number) {
  const definition = catAnimations[animation] || catAnimations.idle;
  return Math.max(wantedDuration, definition.duration + 80);
}

export default function CatBuddy({ enabled, reducedMotion = false }: CatBuddyProps) {
  const instanceIdRef = useRef(`cat-${Math.random().toString(36).slice(2)}`);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageCacheRef = useRef<Record<string, HTMLImageElement>>({});
  const movementFrameRef = useRef<number | null>(null);
  const drawFrameRef = useRef<number | null>(null);
  const clickTimerRef = useRef<number | null>(null);

  const [isPrimary, setIsPrimary] = useState(true);
  const [animationId, setAnimationId] = useState<CatAnimationId>("idle");
  const [following, setFollowing] = useState(true);

  const positionRef = useRef({ x: 0, y: 0 });
  const targetRef = useRef({ x: 0, y: 0, hasTarget: false });
  const followingRef = useRef(true);
  const facingLeftRef = useRef(false);
  const directionTiltRef = useRef(0);
  const targetDirectionTiltRef = useRef(0);
  const frameClockRef = useRef(nowMs());
  const lastPointerAtRef = useRef(Date.now());
  const lastMovedAtRef = useRef(Date.now());
  const actionUntilRef = useRef(0);
  const actionAnimationRef = useRef<CatAnimationId | null>(null);
  const nextRandomActionAtRef = useRef(Date.now() + 7000);
  const animationIdRef = useRef<CatAnimationId>("idle");
  const animationStartedAtRef = useRef(nowMs());

  const canvasSize = useMemo(() => {
    if (animationId === "laying" || animationId === "sleeping1" || animationId === "sleeping2") {
      return { width: 144, height: 122 };
    }

    return { width: 132, height: 132 };
  }, [animationId]);

  useEffect(() => {
    if (!enabled) return;

    const key = getCatSingletonKey();
    const ownId = instanceIdRef.current;
    const existing = (window as any)[key];

    if (existing && existing !== ownId) {
      setIsPrimary(false);
      return;
    }

    (window as any)[key] = ownId;
    setIsPrimary(true);

    return () => {
      if ((window as any)[key] === ownId) {
        delete (window as any)[key];
      }
    };
  }, [enabled]);

  useEffect(() => {
    followingRef.current = following;
  }, [following]);

  useEffect(() => {
    animationIdRef.current = animationId;
    animationStartedAtRef.current = nowMs();
  }, [animationId]);

  useEffect(() => {
    Object.values(catAnimations).forEach((animation) => {
      if (imageCacheRef.current[animation.id]) return;

      const image = new Image();
      image.src = animation.src;
      image.decoding = "async";
      imageCacheRef.current[animation.id] = image;
    });
  }, []);

  useEffect(() => {
    return () => {
      if (clickTimerRef.current !== null) {
        window.clearTimeout(clickTimerRef.current);
        clickTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!enabled || !isPrimary) return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const draw = (time: number) => {
      const currentAnimation = catAnimations[animationIdRef.current] || catAnimations.idle;
      const image = imageCacheRef.current[currentAnimation.id];
      const isResting = currentAnimation.id === "laying" || currentAnimation.id === "sleeping1" || currentAnimation.id === "sleeping2";

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.imageSmoothingEnabled = false;

      directionTiltRef.current = lerp(directionTiltRef.current, targetDirectionTiltRef.current, 0.18);

      if (image?.complete && image.naturalWidth > 0 && image.naturalHeight > 0) {
        const frameCount = Math.max(1, currentAnimation.frames);
        const frameWidth = Math.max(1, Math.floor(image.naturalWidth / frameCount));
        const frameHeight = image.naturalHeight;
        const duration = reducedMotion ? Math.max(currentAnimation.duration, 1200) : currentAnimation.duration;
        const elapsed = Math.max(0, time - animationStartedAtRef.current);
        const progress = duration <= 0 ? 1 : elapsed / duration;

        let frameIndex = 0;
        if (frameCount > 1) {
          if (currentAnimation.loop !== false) {
            frameIndex = Math.floor((elapsed % duration) / duration * frameCount);
          } else if (progress >= 1 && currentAnimation.holdLastFrame) {
            frameIndex = frameCount - 1;
          } else {
            frameIndex = Math.floor(clamp(progress, 0, 0.999) * frameCount);
          }
        }

        const drawWidth = isResting ? 112 : 96;
        const drawHeight = isResting ? 88 : 96;

        ctx.save();
        ctx.translate(canvas.width / 2, canvas.height / 2);

        if (!isResting) {
          ctx.rotate(directionTiltRef.current);
        }

        if (facingLeftRef.current) {
          ctx.scale(-1, 1);
        }

        ctx.drawImage(
          image,
          clamp(frameIndex, 0, frameCount - 1) * frameWidth,
          0,
          frameWidth,
          frameHeight,
          -drawWidth / 2,
          -drawHeight / 2,
          drawWidth,
          drawHeight
        );

        ctx.restore();
      }

      drawFrameRef.current = window.requestAnimationFrame(draw);
    };

    drawFrameRef.current = window.requestAnimationFrame(draw);

    return () => {
      if (drawFrameRef.current !== null) {
        window.cancelAnimationFrame(drawFrameRef.current);
        drawFrameRef.current = null;
      }
    };
  }, [enabled, isPrimary, reducedMotion]);

  useEffect(() => {
    if (!enabled || !isPrimary) return;

    const startX = clamp(window.innerWidth - 164, 16, window.innerWidth - 128);
    const startY = clamp(window.innerHeight - 220, 42, window.innerHeight - 142);

    positionRef.current = { x: startX, y: startY };
    targetRef.current = {
      x: startX + CAT_CENTER_X,
      y: startY + CAT_CENTER_Y,
      hasTarget: false
    };

    const root = rootRef.current;
    if (root) {
      root.style.transform = `translate3d(${startX}px, ${startY}px, 0)`;
    }
  }, [enabled, isPrimary]);

  useEffect(() => {
    if (!enabled || !isPrimary) {
      if (movementFrameRef.current !== null) {
        window.cancelAnimationFrame(movementFrameRef.current);
        movementFrameRef.current = null;
      }

      return;
    }

    const setAnimationSafe = (next: CatAnimationId, restart = false) => {
      if (!restart && animationIdRef.current === next) return;
      animationIdRef.current = next;
      animationStartedAtRef.current = nowMs();
      setAnimationId(next);
    };

    const updateDirection = (dx: number, dy: number) => {
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) {
        targetDirectionTiltRef.current = 0;
        return;
      }

      const absX = Math.abs(dx);
      const absY = Math.abs(dy);

      if (absX > Math.max(10, absY * 0.18)) {
        facingLeftRef.current = dx < 0;
      }

      const safeX = Math.max(absX, 1);
      const rawTilt = Math.atan2(dy, safeX);
      const nextTilt = facingLeftRef.current ? -rawTilt : rawTilt;

      targetDirectionTiltRef.current = clamp(nextTilt, -CAT_MAX_DIRECTION_TILT, CAT_MAX_DIRECTION_TILT);
    };

    const moveTowardTarget = (dtSeconds: number, lockedAction: boolean) => {
      const target = targetRef.current;
      const position = positionRef.current;

      if (lockedAction || !followingRef.current || !target.hasTarget) {
        targetDirectionTiltRef.current = lockedAction ? 0 : targetDirectionTiltRef.current;
        return 0;
      }

      const catCenterX = position.x + CAT_CENTER_X;
      const catCenterY = position.y + CAT_CENTER_Y;
      const dx = target.x - catCenterX;
      const dy = target.y - catCenterY;
      const distance = Math.hypot(dx, dy);

      updateDirection(dx, dy);

      if (distance <= CAT_STOP_DISTANCE) {
        targetDirectionTiltRef.current = lerp(targetDirectionTiltRef.current, 0, 0.08);
        return distance;
      }

      const speed = distance > 180 ? CAT_RUN_SPEED : CAT_WALK_SPEED;
      const maxStep = speed * dtSeconds;
      const step = Math.min(maxStep, distance - CAT_STOP_DISTANCE);
      const nx = dx / distance;
      const ny = dy / distance;

      position.x += nx * step;
      position.y += ny * step;

      position.x = clamp(position.x, 8, window.innerWidth - CAT_WIDTH - 10);
      position.y = clamp(position.y, 42, window.innerHeight - CAT_HEIGHT - 106);

      lastMovedAtRef.current = Date.now();
      return distance;
    };

    const tick = () => {
      const currentTime = nowMs();
      const dtSeconds = clamp((currentTime - frameClockRef.current) / 1000, 0.001, 0.05);
      frameClockRef.current = currentTime;

      const realNow = Date.now();
      const lockedAction = actionUntilRef.current > realNow && actionAnimationRef.current !== null;
      const lockedAnimation = actionAnimationRef.current;

      if (!lockedAction && actionAnimationRef.current !== null) {
        actionAnimationRef.current = null;
      }

      const distance = moveTowardTarget(dtSeconds, lockedAction);
      const root = rootRef.current;
      const position = positionRef.current;

      if (root) {
        root.style.transform = `translate3d(${position.x.toFixed(2)}px, ${position.y.toFixed(2)}px, 0)`;
      }

      if (lockedAction && lockedAnimation) {
        setAnimationSafe(lockedAnimation);
        movementFrameRef.current = window.requestAnimationFrame(tick);
        return;
      }

      const idleFor = realNow - Math.max(lastPointerAtRef.current, lastMovedAtRef.current);

      if (followingRef.current && targetRef.current.hasTarget && distance > 180) {
        setAnimationSafe("run");
      } else if (followingRef.current && targetRef.current.hasTarget && distance > CAT_STOP_DISTANCE + 5) {
        setAnimationSafe("walk");
      } else if (idleFor > 18000) {
        targetDirectionTiltRef.current = 0;
        setAnimationSafe(realNow % 5200 > 2600 ? "sleeping1" : "sleeping2");
      } else if (idleFor > 8500) {
        targetDirectionTiltRef.current = 0;
        setAnimationSafe("sitting");
      } else {
        targetDirectionTiltRef.current = lerp(targetDirectionTiltRef.current, 0, 0.05);
        setAnimationSafe("idle");
      }

      if (idleFor > 5200 && realNow > nextRandomActionAtRef.current) {
        const action = pickIdleAction();
        targetDirectionTiltRef.current = 0;
        actionAnimationRef.current = action;
        actionUntilRef.current = realNow + actionDuration(action, action === "stretching" ? 1400 : 900);
        setAnimationSafe(action, true);
        nextRandomActionAtRef.current = realNow + 6500 + Math.random() * 9500;
      }

      movementFrameRef.current = window.requestAnimationFrame(tick);
    };

    frameClockRef.current = nowMs();
    movementFrameRef.current = window.requestAnimationFrame(tick);

    return () => {
      if (movementFrameRef.current !== null) {
        window.cancelAnimationFrame(movementFrameRef.current);
        movementFrameRef.current = null;
      }
    };
  }, [enabled, isPrimary]);

  useEffect(() => {
    if (!enabled || !isPrimary) return;

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;

      targetRef.current = {
        x: event.clientX,
        y: event.clientY,
        hasTarget: true
      };

      lastPointerAtRef.current = Date.now();
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;

      targetRef.current = {
        x: event.clientX,
        y: event.clientY,
        hasTarget: true
      };

      lastPointerAtRef.current = Date.now();
    };

    const handleResize = () => {
      const position = positionRef.current;
      position.x = clamp(position.x, 8, window.innerWidth - CAT_WIDTH - 10);
      position.y = clamp(position.y, 42, window.innerHeight - CAT_HEIGHT - 106);
      targetRef.current.x = clamp(targetRef.current.x, 0, window.innerWidth);
      targetRef.current.y = clamp(targetRef.current.y, 0, window.innerHeight);
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("pointerdown", handlePointerDown, { passive: true });
    window.addEventListener("resize", handleResize, { passive: true });

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("resize", handleResize);
    };
  }, [enabled, isPrimary]);

  const forceAction = (next: CatAnimationId, durationMs: number) => {
    const time = Date.now();

    if (clickTimerRef.current !== null) {
      window.clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
    }

    targetDirectionTiltRef.current = 0;
    directionTiltRef.current = 0;
    actionAnimationRef.current = next;
    actionUntilRef.current = time + actionDuration(next, durationMs);
    nextRandomActionAtRef.current = time + 7600;
    animationIdRef.current = next;
    animationStartedAtRef.current = nowMs();
    setAnimationId(next);
  };

  const handleCatClick = () => {
    if (clickTimerRef.current !== null) {
      window.clearTimeout(clickTimerRef.current);
    }

    clickTimerRef.current = window.setTimeout(() => {
      clickTimerRef.current = null;
      if (actionUntilRef.current > Date.now()) return;
      forceAction("meow", 700);
    }, SINGLE_CLICK_DELAY_MS);
  };

  const handleCatDoubleClick = () => {
    if (clickTimerRef.current !== null) {
      window.clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
    }

    forceAction("laying", 6500);
  };

  const handleCatMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    if (event.button !== 1) return;

    event.preventDefault();

    const nextFollowing = !followingRef.current;
    followingRef.current = nextFollowing;
    setFollowing(nextFollowing);
    forceAction(nextFollowing ? "run" : "sitting", 850);
  };

  if (!enabled || !isPrimary) return null;

  return (
    <div
      ref={rootRef}
      className={`localtifyCatBuddy localtifyCatBuddy-${animationId} ${following ? "isFollowing" : "isParked"}`}
      data-cat-state={animationId}
      data-following={following ? "on" : "off"}
      title={following ? "cat..... walks to your cursor. double-click to lie down. middle-click to park." : "cat..... parked. middle-click to follow again."}
      onClick={handleCatClick}
      onDoubleClick={handleCatDoubleClick}
      onMouseDown={handleCatMouseDown}
      onAuxClick={(event) => event.preventDefault()}
      role="button"
      tabIndex={0}
      aria-label={following ? "cat buddy walking to the cursor" : "cat buddy parked"}
    >
      <canvas
        ref={canvasRef}
        className="localtifyCatBuddyCanvas"
        width={canvasSize.width}
        height={canvasSize.height}
        aria-hidden="true"
      />
      <span className="localtifyCatBuddyShadow" aria-hidden="true" />
      <span className="localtifyCatBuddyHint" aria-hidden="true">{following ? "cat....." : "parked"}</span>
    </div>
  );
}
