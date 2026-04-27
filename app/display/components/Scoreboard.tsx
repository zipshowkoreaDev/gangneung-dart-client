import { useLayoutEffect, useRef, useState } from "react";
import type { PlayerScore } from "@/app/display/types/player";
import { getPlayerColor } from "@/app/display/lib/playerColors";
import { MAX_PLAYERS, type PlayerSlot } from "@/lib/room";

type ScoreboardProps = {
  players: Map<string, PlayerScore>;
};

type OverflowLevel = "default" | "compact" | "tight";

type ThrowDotMetrics = {
  rowGap: string;
  gap: string;
  dotSize: string;
  containerWidth: string;
};

const THROW_DOT_COUNT = 3;
const SCOREBOARD_CARD_BASE_CLASS =
  "flex min-h-[clamp(5.6rem,10cqh,8rem)] flex-col justify-between gap-[clamp(0.45rem,1.5cqh,0.8rem)] rounded-[clamp(0.75rem,2cqw,1rem)] p-[clamp(0.6rem,1.75cqh,1rem)] transition-all";

function getThrowDotMetrics(level: OverflowLevel): ThrowDotMetrics {
  if (level === "tight") {
    return {
      rowGap: "clamp(0.18rem, 0.45cqh, 0.3rem)",
      gap: "clamp(0.06rem, 0.18cqh, 0.12rem)",
      dotSize: "clamp(0.22rem, 0.52cqh, 0.32rem)",
      containerWidth: "clamp(0.82rem, 1.95cqh, 1.12rem)",
    };
  }

  if (level === "compact") {
    return {
      rowGap: "clamp(0.26rem, 0.62cqh, 0.42rem)",
      gap: "clamp(0.1rem, 0.26cqh, 0.18rem)",
      dotSize: "clamp(0.28rem, 0.68cqh, 0.42rem)",
      containerWidth: "clamp(1.02rem, 2.45cqh, 1.45rem)",
    };
  }

  return {
    rowGap: "clamp(0.4rem, 1cqh, 0.7rem)",
    gap: "clamp(0.18rem, 0.48cqh, 0.32rem)",
    dotSize: "clamp(0.38rem, 0.95cqh, 0.58rem)",
    containerWidth: "clamp(1.5rem, 3.5cqh, 2.1rem)",
  };
}

function getCompactNameStyle(level: OverflowLevel) {
  if (level === "tight") {
    return {
      fontSize: "clamp(0.74rem, 1.9cqh, 1.08rem)",
      letterSpacing: "-0.04em",
    };
  }

  if (level === "compact") {
    return {
      fontSize: "clamp(0.84rem, 2.2cqh, 1.24rem)",
      letterSpacing: "-0.025em",
    };
  }

  return {
    fontSize: "clamp(0.95rem, 2.5cqh, 1.45rem)",
    letterSpacing: "0",
  };
}

function PlayerNameRow({ player }: { player: PlayerScore }) {
  const nameRef = useRef<HTMLSpanElement | null>(null);
  const [overflowLevel, setOverflowLevel] = useState<OverflowLevel>("default");

  useLayoutEffect(() => {
    const element = nameRef.current;
    if (!element) return;

    const updateOverflowLevel = () => {
      const hasOverflow = element.scrollWidth > element.clientWidth + 1;

      if (!hasOverflow) {
        setOverflowLevel("default");
        return;
      }

      const tightOverflow = element.scrollWidth - element.clientWidth > 18;
      setOverflowLevel(tightOverflow ? "tight" : "compact");
    };

    updateOverflowLevel();

    const resizeObserver = new ResizeObserver(() => {
      updateOverflowLevel();
    });

    resizeObserver.observe(element);
    if (element.parentElement) {
      resizeObserver.observe(element.parentElement);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [player.name]);

  const color = player.slot ? getPlayerColor(player.slot - 1) : "#ffffff";
  const remainingThrows = Math.max(0, THROW_DOT_COUNT - player.totalThrows);
  const throwDotMetrics = getThrowDotMetrics(overflowLevel);
  const nameStyle = getCompactNameStyle(overflowLevel);

  return (
    <div
      className="flex min-w-0 items-center justify-between"
      style={{ columnGap: throwDotMetrics.rowGap }}
    >
      <span
        ref={nameRef}
        className="min-w-0 flex-1 truncate text-left font-bold leading-none"
        style={nameStyle}
      >
        {player.name}
      </span>
      <div
        className="flex shrink-0 items-center justify-end"
        style={{
          gap: throwDotMetrics.gap,
          width: throwDotMetrics.containerWidth,
          minWidth: throwDotMetrics.containerWidth,
        }}
        aria-label={`남은 투척 횟수 ${remainingThrows}/${THROW_DOT_COUNT}`}
      >
        {Array.from({ length: THROW_DOT_COUNT }, (_, index) => (
          <span
            key={index}
            className="block rounded-full border"
            style={{
              width: throwDotMetrics.dotSize,
              height: throwDotMetrics.dotSize,
              backgroundColor:
                index < remainingThrows ? color : "rgba(255, 255, 255, 0.14)",
              borderColor:
                index < remainingThrows ? color : "rgba(255, 255, 255, 0.35)",
              boxShadow:
                index < remainingThrows ? `0 0 10px ${color}99` : "none",
            }}
          />
        ))}
      </div>
    </div>
  );
}

export default function Scoreboard({ players }: ScoreboardProps) {
  const sortedPlayers = Array.from(players.values()).sort(
    (a, b) =>
      (a.slot ?? Number.MAX_SAFE_INTEGER) - (b.slot ?? Number.MAX_SAFE_INTEGER),
  );
  const hasGameStarted = sortedPlayers.some(
    (player) => !player.isWaiting && (player.isReady || player.totalThrows > 0),
  );
  const playersBySlot = new Map(
    sortedPlayers
      .filter((player): player is PlayerScore & { slot: PlayerSlot } => Boolean(player.slot))
      .map((player) => [player.slot, player]),
  );

  const renderEmptyCard = (slot: PlayerSlot) => {
    const color = getPlayerColor(slot - 1);

    return (
      <div
        className={`${SCOREBOARD_CARD_BASE_CLASS} border border-white/15 bg-white/5`}
        style={{ boxShadow: `inset 0 0 0 1px ${color}33` }}
      >
        <div className="flex min-w-0 items-center justify-between gap-[clamp(0.55rem,1.6cqw,1rem)]">
          <span
            className={[
              "min-w-0 flex-1 truncate text-left text-[clamp(0.8rem,2.2cqh,1.25rem)] font-bold leading-none text-white/35 transition-opacity",
              hasGameStarted ? "opacity-0" : "opacity-100",
            ].join(" ")}
          >
            PLAYER {slot}
          </span>
          <div
            className="flex shrink-0 items-center gap-[clamp(0.3rem,0.75cqh,0.55rem)]"
            aria-hidden="true"
          >
            {Array.from({ length: THROW_DOT_COUNT }, (_, index) => (
              <span
                key={index}
                className="block h-[clamp(0.5rem,1.35cqh,0.8rem)] w-[clamp(0.5rem,1.35cqh,0.8rem)] rounded-full border border-white/15 bg-white/8"
              />
            ))}
          </div>
        </div>

        <div className="flex min-h-[clamp(1.2rem,2.8cqh,1.8rem)] items-center justify-between gap-[clamp(0.35rem,1.2cqh,0.8rem)] text-[clamp(0.95rem,2.8cqh,1.45rem)] font-bold leading-none text-white/20">
          <div className="flex min-w-0 items-center gap-[clamp(0.35rem,1.5cqw,0.75rem)] text-left" />
          <div
            className={[
              "shrink-0 text-right text-white/20 transition-opacity",
              hasGameStarted ? "opacity-0" : "opacity-100",
            ].join(" ")}
          >
            READY
          </div>
        </div>
      </div>
    );
  };

  const renderPlayerCard = (player: PlayerScore) => {
    const throwScores = player.throwScores ?? [];

    return (
      <div
        className={SCOREBOARD_CARD_BASE_CLASS}
        style={{
          background: player.isWaiting
            ? "rgba(255, 255, 255, 0.12)"
            : player.isReady
              ? "rgba(255, 255, 255, 0.08)"
              : "rgba(255, 255, 255, 0.05)",
          opacity: 1,
        }}
      >
        <PlayerNameRow player={player} />

        <div className="flex min-h-[clamp(1.2rem,2.8cqh,1.8rem)] items-center justify-between gap-[clamp(0.35rem,1.2cqh,0.8rem)] font-bold leading-none text-[#FFD700]">
          <div className="flex min-w-0 items-center gap-[clamp(0.25rem,0.8cqh,0.5rem)] text-left text-[clamp(0.75rem,2.1cqh,1.2rem)]">
            {throwScores.map((score, index) => (
              <span key={`${index}-${score}`} className="shrink-0">
                {score}
              </span>
            ))}
          </div>
          <div className="shrink-0 text-right text-[clamp(0.9rem,2.4cqh,1.35rem)]">
            {throwScores.length > 0 ? `${player.score}점` : "READY"}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="absolute top-0 left-0 z-10 w-full bg-white/20 px-[clamp(0.5rem,1.75cqh,1.1rem)] py-[clamp(0.5rem,1.5cqh,1rem)] shadow-md backdrop-blur-md">
      <div className="grid grid-cols-4 gap-[clamp(0.35rem,1cqh,0.75rem)]">
        {Array.from({ length: MAX_PLAYERS }, (_, index) => {
          const slot = (index + 1) as PlayerSlot;
          const player = playersBySlot.get(slot);

          return (
            <div
              key={`slot-${slot}`}
              className="rounded-[clamp(0.75rem,2cqw,1rem)] bg-white/40"
            >
              {player ? renderPlayerCard(player) : renderEmptyCard(slot)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
