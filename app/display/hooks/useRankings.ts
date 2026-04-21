import { useCallback, useEffect, useState } from "react";
import {
  getRankings,
  addRanking,
  getMillisecondsUntilRankingReset,
  RankingEntry,
} from "@/lib/ranking";

export default function useRankings() {
  const [rankings, setRankings] = useState<RankingEntry[]>(() =>
    getRankings()
  );

  const handlePlayerFinish = useCallback((name: string, score: number) => {
    const updated = addRanking(name, score);
    setRankings(updated);
  }, []);

  useEffect(() => {
    let timerId: number | undefined;

    const scheduleReset = () => {
      timerId = window.setTimeout(() => {
        setRankings(getRankings());
        scheduleReset();
      }, getMillisecondsUntilRankingReset() + 1000);
    };

    scheduleReset();

    return () => {
      if (timerId !== undefined) {
        window.clearTimeout(timerId);
      }
    };
  }, []);

  return {
    rankings,
    handlePlayerFinish,
  };
}
