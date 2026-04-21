import { useCallback, useEffect, useRef, useState } from "react";
import {
  getRankings,
  addRankings,
  getMillisecondsUntilRankingReset,
  RankingEntry,
} from "@/lib/ranking";

export default function useRankings() {
  const [rankings, setRankings] = useState<RankingEntry[]>([]);
  const lastFinishSignatureRef = useRef("");

  const handlePlayersFinish = useCallback(
    (players: Array<{ name: string; score: number }>) => {
      const latestByName = new Map<string, { name: string; score: number }>();
      players.forEach((player) => {
        latestByName.set(player.name, player);
      });

      const entries = Array.from(latestByName.values());
      const signature = entries
        .map((player) => `${player.name}:${player.score}`)
        .sort()
        .join("|");

      if (!signature || signature === lastFinishSignatureRef.current) return;

      lastFinishSignatureRef.current = signature;
      setRankings(addRankings(entries));
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
