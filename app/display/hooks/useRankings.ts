import { useCallback, useEffect, useState } from "react";
import {
  getRankings,
  addRankings,
  getMillisecondsUntilRankingReset,
  RankingEntry,
} from "@/lib/ranking";

export default function useRankings() {
  const [rankings, setRankings] = useState<RankingEntry[]>([]);

  const handlePlayersFinish = useCallback(
    (players: Array<{ name: string; score: number }>) => {
      setRankings(addRankings(players));
    },
    []
  );

  useEffect(() => {
    const loadTimerId = window.setTimeout(() => {
      setRankings(getRankings());
    }, 0);
    let timerId: number | undefined;

    const scheduleReset = () => {
      timerId = window.setTimeout(() => {
        setRankings(getRankings());
        scheduleReset();
      }, getMillisecondsUntilRankingReset() + 1000);
    };

    scheduleReset();

    return () => {
      window.clearTimeout(loadTimerId);
      if (timerId !== undefined) {
        window.clearTimeout(timerId);
      }
    };
  }, []);

  return {
    rankings,
    handlePlayersFinish,
  };
}
