import { useCallback, useState } from "react";
import { getRankings, addRanking, RankingEntry } from "@/lib/ranking";

export default function useRankings() {
  const [rankings, setRankings] = useState<RankingEntry[]>(() =>
    getRankings()
  );

  const handlePlayerFinish = useCallback((name: string, score: number) => {
    const updated = addRanking(name, score);
    setRankings(updated);
  }, []);

  return {
    rankings,
    handlePlayerFinish,
  };
}
