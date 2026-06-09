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
};

const catAnimations: Record<CatAnimationId, CatAnimation> = {
  idle: {
    id: "idle",
    src: new URL("./assets/cat-4/Cat-4-Idle.png", import.meta.url).href,
    frames: 10,
    duration: 760
  },
  walk: {
    id: "walk",
    src: new URL("./assets/cat-4/Cat-4-Walk.png", import.meta.url).href,
    frames: 8,
    duration: 560
  },
  run: {
    id: "run",
    src: new URL("./assets/cat-4/Cat-4-Run.png", import.meta.url).href,
    frames: 8,
    duration: 360
  },
  meow: {
    id: "meow",
    src: new URL("./assets/cat-4/Cat-4-Meow.png", import.meta.url).href,
    frames: 4,
    duration: 380
  },
  laying: {
    id: "laying",
    src: new URL("./assets/cat-4/Cat-4-Laying.png", import.meta.url).href,
    frames: 8,
    duration: 780
  },
  itch: {
    id: "itch",
    src: new URL("./assets/cat-4/Cat-4-Itch.png", import.meta.url).href,
    frames: 2,
    duration: 260
  },
  sleeping1: {
    id: "sleeping1",
    src: new URL("./assets/cat-4/Cat-4-Sleeping1.png", import.meta.url).href,
    frames: 1,
    duration: 1200
  },
  sleeping2: {
    id: "sleeping2",
    src: new URL("./assets/cat-4/Cat-4-Sleeping2.png", import.meta.url).href,
    frames: 1,
    duration: 1200
  },
  sitting: {
    id: "sitting",
    src: new URL("./assets/cat-4/Cat-4-Sitting.png", import.meta.url).href,
    frames: 1,
    duration: 1200
  },
  licking1: {
    id: "licking1",
    src: new URL("./assets/cat-4/Cat-4-Licking 1.png", import.meta.url).href,
    frames: 5,
    duration: 520
  },
  licking2: {
    id: "licking2",
    src: new URL("./assets/cat-4/Cat-4-Licking 2.png", import.meta.url).href,
    frames: 5,
    duration: 520
  },
  stretching: {
    id: "stretching",
    src: new URL("./assets/cat-4/Cat-4-Stretching.png", import.meta.url).href,
    frames: 13,
    duration: 980
  }
};

const CAT_WIDTH = 96;
const CAT_HEIGHT = 96;
const CAT_CENTER_X = 48;
const CAT_CENTER_Y = 66;
const CAT_STOP_DISTANCE = 34;
const CAT_WALK_SPEED = 165;
const CAT_RUN_SPEED = 315;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function nowMs() {
  return performance.now();
}

function pickIdleAction() {
  const actions: CatAnimationId[] = ["sitting", "itch", "licking1", "licking2", "stretching", "meow"];
  return actions[Math.floor(Math.random() * actions.length)] || "sitting";
}

function getCatSingletonKey() {
  return "__localtifyCatBuddyPrimaryV402";
}

export default function CatBuddy({ enabled, reducedMotion = false }: CatBuddyProps) {
  const instanceIdRef = useRef(`cat-${Math.random().toString(36).slice(2)}`);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageCacheRef = useRef<Record<string, HTMLImageElement>>({});
  const movementFrameRef = useRef<number | null>(null);
  const drawFrameRef = useRef<number | null>(null);

  const [isPrimary, setIsPrimary] = useState(true);
  const [animationId, setAnimationId] = useState<CatAnimationId>("idle");
  const [following, setFollowing] = useState(true);
  const [facingLeft, setFacingLeft] = useState(true);

  const positionRef = useRef({ x: 0, y: 0 });
  const targetRef = useRef({ x: 0, y: 0, hasTarget: false });
  const followingRef = useRef(true);
  const frameClockRef = useRef(nowMs());
  const lastPointerAtRef = useRef(Date.now());
  const lastMovedAtRef = useRef(Date.now());
  const actionUntilRef = useRef(0);
  const nextRandomActionAtRef = useRef(Date.now() + 7000);
  const animationIdRef = useRef<CatAnimationId>("idle");
  const animationStartedAtRef = useRef(nowMs());

  const canvasSize = useMemo(() => {
    if (animationId === "laying" || animationId === "sleeping1" || animationId === "sleeping2") {
      return { width: 112, height: 88 };
    }

    return { width: 96, height: 96 };
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
    if (!enabled || !isPrimary) return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const draw = (time: number) => {
      const currentAnimation = catAnimations[animationIdRef.current] || catAnimations.idle;
      const image = imageCacheRef.current[currentAnimation.id];

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.imageSmoothingEnabled = false;

      if (image?.complete && image.naturalWidth > 0 && image.naturalHeight > 0) {
        const frameCount = Math.max(1, currentAnimation.frames);
        const frameWidth = Math.max(1, Math.floor(image.naturalWidth / frameCount));
        const frameHeight = image.naturalHeight;
        const duration = reducedMotion ? Math.max(currentAnimation.duration, 1200) : currentAnimation.duration;
        const frameIndex = frameCount <= 1
          ? 0
          : Math.floor(((time - animationStartedAtRef.current) % duration) / duration * frameCount);

        ctx.save();

        if (!facingLeft) {
          ctx.translate(canvas.width, 0);
          ctx.scale(-1, 1);
        }

        ctx.drawImage(
          image,
          clamp(frameIndex, 0, frameCount - 1) * frameWidth,
          0,
          frameWidth,
          frameHeight,
          0,
          0,
          canvas.width,
          canvas.height
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
  }, [enabled, isPrimary, reducedMotion, facingLeft]);

  useEffect(() => {
    if (!enabled || !isPrimary) return;

    const startX = clamp(window.innerWidth - 160, 16, window.innerWidth - 120);
    const startY = clamp(window.innerHeight - 210, 42, window.innerHeight - 132);

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

    const setAnimationSafe = (next: CatAnimationId) => {
      if (animationIdRef.current === next) return;
      animationIdRef.current = next;
      animationStartedAtRef.current = nowMs();
      setAnimationId(next);
    };

    const moveTowardTarget = (dtSeconds: number) => {
      const target = targetRef.current;
      const position = positionRef.current;

      if (!followingRef.current || !target.hasTarget) return 0;

      const catCenterX = position.x + CAT_CENTER_X;
      const catCenterY = position.y + CAT_CENTER_Y;
      const dx = target.x - catCenterX;
      const dy = target.y - catCenterY;
      const distance = Math.hypot(dx, dy);

      if (distance <= CAT_STOP_DISTANCE) return distance;

      const speed = distance > 180 ? CAT_RUN_SPEED : CAT_WALK_SPEED;
      const maxStep = speed * dtSeconds;
      const step = Math.min(maxStep, distance - CAT_STOP_DISTANCE);
      const nx = dx / distance;
      const ny = dy / distance;

      position.x += nx * step;
      position.y += ny * step;

      position.x = clamp(position.x, 8, window.innerWidth - CAT_WIDTH - 10);
      position.y = clamp(position.y, 42, window.innerHeight - CAT_HEIGHT - 106);

      if (Math.abs(dx) > 1.5) {
        setFacingLeft(dx < 0);
      }

      lastMovedAtRef.current = Date.now();
      return distance;
    };

    const tick = () => {
      const currentTime = nowMs();
      const dtSeconds = clamp((currentTime - frameClockRef.current) / 1000, 0.001, 0.05);
      frameClockRef.current = currentTime;

      const distance = moveTowardTarget(dtSeconds);
      const root = rootRef.current;
      const position = positionRef.current;

      if (root) {
        root.style.transform = `translate3d(${position.x.toFixed(2)}px, ${position.y.toFixed(2)}px, 0)`;
      }

      const realNow = Date.now();
      const hasAction = actionUntilRef.current > realNow;
      const idleFor = realNow - Math.max(lastPointerAtRef.current, lastMovedAtRef.current);

      if (!hasAction) {
        if (followingRef.current && targetRef.current.hasTarget && distance > 180) {
          setAnimationSafe("run");
        } else if (followingRef.current && targetRef.current.hasTarget && distance > CAT_STOP_DISTANCE + 5) {
          setAnimationSafe("walk");
        } else if (idleFor > 18000) {
          setAnimationSafe(realNow % 5200 > 2600 ? "sleeping1" : "sleeping2");
        } else if (idleFor > 8500) {
          setAnimationSafe("sitting");
        } else {
          setAnimationSafe("idle");
        }

        if (idleFor > 5200 && realNow > nextRandomActionAtRef.current) {
          const action = pickIdleAction();
          setAnimationSafe(action);
          actionUntilRef.current = realNow + (action === "stretching" ? 1400 : 900);
          nextRandomActionAtRef.current = realNow + 6500 + Math.random() * 9500;
        }
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
    actionUntilRef.current = time + durationMs;
    nextRandomActionAtRef.current = time + 7500;
    animationIdRef.current = next;
    animationStartedAtRef.current = nowMs();
    setAnimationId(next);
  };

  const handleCatClick = () => {
    if (actionUntilRef.current > Date.now()) return;
    forceAction("meow", 700);
  };

  const handleCatDoubleClick = () => {
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
