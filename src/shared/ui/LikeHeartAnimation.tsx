import type { CSSProperties } from "react";
import "./LikeHeartAnimation.css";

const LIKE_BURST_PARTICLES_V443 = [
  { rotate: 0, color: "#fe5064", size: "5px", translateY: "-28px", delay: "0s" },
  { rotate: 36, color: "#8eb539", size: "4px", translateY: "-27px", delay: "0.06s" },
  { rotate: 72, color: "#3e9be7", size: "3px", translateY: "-26px", delay: "0.12s" },
  { rotate: 108, color: "#f5ce50", size: "5px", translateY: "-28px", delay: "0s" },
  { rotate: 144, color: "#fe5064", size: "4px", translateY: "-27px", delay: "0.06s" },
  { rotate: 180, color: "#8eb539", size: "3px", translateY: "-26px", delay: "0.12s" },
  { rotate: 216, color: "#3e9be7", size: "5px", translateY: "-28px", delay: "0s" },
  { rotate: 252, color: "#f5ce50", size: "4px", translateY: "-27px", delay: "0.06s" },
  { rotate: 288, color: "#fe5064", size: "3px", translateY: "-26px", delay: "0.12s" },
  { rotate: 324, color: "#8eb539", size: "5px", translateY: "-28px", delay: "0s" }
];

export function LikeHeartAnimationV443({ liked }: { liked: boolean }) {
  return (
    <span className="likeHeartAnimationV443" aria-hidden="true" data-liked={liked ? "true" : "false"}>
      <span className="likeHeartShellV443">
        <span className="likeBurstRingV443" />
        {LIKE_BURST_PARTICLES_V443.map((particle) => (
          <span
            key={particle.rotate}
            className="likeBurstParticleV443"
            style={{
              "--rotate": `${particle.rotate}deg`,
              "--particle-color": particle.color,
              "--particle-size": particle.size,
              "--particle-translate-y": particle.translateY,
              "--particle-delay": particle.delay
            } as CSSProperties}
          />
        ))}
        <span className="likeHeartFillV443" />
      </span>
    </span>
  );
}

