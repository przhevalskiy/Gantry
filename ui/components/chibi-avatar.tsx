'use client';

// Individual chibi avatar PNGs — sliced from the 5×5 construction crew sheet.
// Numbers map to /public/avatars/avatar-XX.png (01–25).

export type SwarmRole =
  | 'foreman' | 'pm' | 'architect' | 'builder'
  | 'inspector' | 'security' | 'devops'
  | 'scout' | 'analyst' | 'verifier' | 'critic';

const ROLE_TO_AVATAR: Record<SwarmRole, number> = {
  foreman:   1,  // bearded man
  pm:        4,  // ponytail girl
  architect: 7,  // goggles
  builder:   10, // braided girl
  inspector: 18, // plain young man
  security:  22, // long-hair woman
  devops:    25, // curly hair
  scout:     13, // plain man (row 3 col 3)
  analyst:   15, // woman glasses (row 3 col 5)
  verifier:  19, // girl glasses (row 4 col 4)
  critic:    23, // man glasses (row 5 col 3)
};

function avatarSrc(n: number): string {
  return `/avatars/avatar-${String(n).padStart(2, '0')}.png`;
}

export function ChibiAvatar({
  role,
  size = 32,
  avatarN,
  // legacy prop name kept for callers that pass spriteIdx — treat as avatarN
  spriteIdx,
  style,
}: {
  role?: SwarmRole;
  size?: number;
  avatarN?: number;
  spriteIdx?: number;
  style?: React.CSSProperties;
}) {
  const n = avatarN ?? spriteIdx ?? (role ? ROLE_TO_AVATAR[role] : 1) ?? 1;
  return (
    <img
      src={avatarSrc(n)}
      alt={role ?? ''}
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: '50%',
        objectFit: 'cover',
        ...style,
      }}
    />
  );
}

export function spriteStyleForIdx(idx: number, size = 32): React.CSSProperties {
  return {
    width: size,
    height: size,
    flexShrink: 0,
    borderRadius: '50%',
    objectFit: 'cover' as const,
    content: `url(${avatarSrc(idx)})`,
  };
}

export { ROLE_TO_AVATAR as ROLE_TO_SPRITE };

export const BUILDER_RING_COLORS = [
  '#10b981', // emerald
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#f97316', // orange
  '#ec4899', // pink
  '#f59e0b', // amber
];
