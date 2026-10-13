export type { OperatorPresence, OperatorSeat, FloorRoleId } from './types';
export { DEFAULT_FLOOR_ORDER } from './types';
export { loadOperatorCatalog, catalogToGhostSeats } from './api';
export { buildFloorSeats, inferActiveRole } from './presence';
export { OperatorPortrait } from './components/OperatorPortrait';
export { EngagementFloor } from './components/EngagementFloor';
