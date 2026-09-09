import {
  User, Cat, Dog, Bird, Fish, Bug, Rabbit, Squirrel, Turtle,
  Star, Heart, Smile, Sun, Moon, Flame, Zap, Crown,
  Leaf, TreePine, Flower2, Mountain, Waves,
  Rocket, Globe, Compass as CompassIcon, Anchor,
  Music, Palette, Camera, Gamepad2, BookOpen,
  Snowflake, Ghost, Gem, Shield, Coffee,
} from 'lucide-react';
import { ComponentType } from 'react';

export interface AvatarIcon {
  id: string;
  label: string;
  icon: ComponentType<{ size?: number }>;
}

export const AVATAR_ICONS: AvatarIcon[] = [
  { id: 'user', label: 'Person', icon: User },
  { id: 'smile', label: 'Smile', icon: Smile },
  { id: 'star', label: 'Star', icon: Star },
  { id: 'heart', label: 'Heart', icon: Heart },
  { id: 'crown', label: 'Crown', icon: Crown },
  { id: 'flame', label: 'Flame', icon: Flame },
  { id: 'zap', label: 'Zap', icon: Zap },
  { id: 'sun', label: 'Sun', icon: Sun },
  { id: 'moon', label: 'Moon', icon: Moon },
  { id: 'cat', label: 'Cat', icon: Cat },
  { id: 'dog', label: 'Dog', icon: Dog },
  { id: 'bird', label: 'Bird', icon: Bird },
  { id: 'fish', label: 'Fish', icon: Fish },
  { id: 'rabbit', label: 'Rabbit', icon: Rabbit },
  { id: 'squirrel', label: 'Squirrel', icon: Squirrel },
  { id: 'turtle', label: 'Turtle', icon: Turtle },
  { id: 'bug', label: 'Bug', icon: Bug },
  { id: 'leaf', label: 'Leaf', icon: Leaf },
  { id: 'tree', label: 'Tree', icon: TreePine },
  { id: 'flower', label: 'Flower', icon: Flower2 },
  { id: 'mountain', label: 'Mountain', icon: Mountain },
  { id: 'waves', label: 'Waves', icon: Waves },
  { id: 'rocket', label: 'Rocket', icon: Rocket },
  { id: 'globe', label: 'Globe', icon: Globe },
  { id: 'compass', label: 'Compass', icon: CompassIcon },
  { id: 'anchor', label: 'Anchor', icon: Anchor },
  { id: 'music', label: 'Music', icon: Music },
  { id: 'palette', label: 'Palette', icon: Palette },
  { id: 'camera', label: 'Camera', icon: Camera },
  { id: 'gamepad', label: 'Gamepad', icon: Gamepad2 },
  { id: 'book', label: 'Book', icon: BookOpen },
  { id: 'snowflake', label: 'Snowflake', icon: Snowflake },
  { id: 'ghost', label: 'Ghost', icon: Ghost },
  { id: 'gem', label: 'Gem', icon: Gem },
  { id: 'shield', label: 'Shield', icon: Shield },
  { id: 'coffee', label: 'Coffee', icon: Coffee },
];

const iconMap = new Map(AVATAR_ICONS.map((a) => [a.id, a.icon]));

/** Returns the lucide icon component for a given avatar ID, defaults to User. */
export function getAvatarIcon(avatarId?: string | null): ComponentType<{ size?: number }> {
  return iconMap.get(avatarId || 'user') || User;
}
