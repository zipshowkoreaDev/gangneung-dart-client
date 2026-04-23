export const PLAYER_COLORS = ["#4da3ff", "#ff4d4d", "#66bb6a", "#ffd54f"];

export function getPlayerColor(index: number) {
  return PLAYER_COLORS[index] ?? "#ffffff";
}
