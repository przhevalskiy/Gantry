import type { MatterSummary } from '@/modules/matters';
import type { Practice } from '@/modules/practices';
import type { Brief } from '@/modules/briefs';
import type { OperatorSeat } from '@/modules/operators';

/** Data bundle for Home first paint — assembler fills from domain APIs. */
export type HomeSurfaceModel = {
  foremanSnippet?: string;
  floorPreview: OperatorSeat[];
  activeMatters: MatterSummary[];
  practiceIdeas: Practice[];
  briefIdeas: Brief[];
};
