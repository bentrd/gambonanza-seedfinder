// Compat shim: RarityChip used to be its own component. The interactive
// chip behaviour is now folded into RarityBadge (with `onClick`/`active`
// props). Keep this file to avoid breaking any external imports — new
// code should reach for RarityBadge directly.
export { RarityBadge as RarityChip } from "./RarityBadge";
