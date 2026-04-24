export type ScoreEntry = {
  socketId: string;
  name: string;
  score: number;
};

export type ControllerGameResult = {
  result: "win" | "lose" | "tie";
  score: number;
  rank: number;
  totalPlayers: number;
};
