// Renders an 8x8 pixel sprite as inline SVG. crispEdges keeps the pixels
// hard at every size — no blur, no platform emoji roulette.

import { PLAYER_TOKENS, spriteById, type PixelSprite } from "@/lib/tokens";

interface PixelTokenProps {
  id: string | undefined;
  size?: number;
  pool?: PixelSprite[];
  className?: string;
  title?: string;
}

export default function PixelToken({
  id,
  size = 16,
  pool = PLAYER_TOKENS,
  className,
  title,
}: PixelTokenProps) {
  const sprite = spriteById(id, pool);
  // Sprites can be any square grid — player pieces are 8x8, prize badges
  // 12x12 for the extra detail they need at poster size.
  const grid = sprite.pixels.length;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${grid} ${grid}`}
      shapeRendering="crispEdges"
      className={className}
      role={title ? "img" : "presentation"}
      aria-label={title}
    >
      {title && <title>{title}</title>}
      {sprite.pixels.map((row, y) =>
        row.split("").map((ch, x) =>
          ch === "." ? null : (
            <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={sprite.palette[ch]} />
          ),
        ),
      )}
    </svg>
  );
}
