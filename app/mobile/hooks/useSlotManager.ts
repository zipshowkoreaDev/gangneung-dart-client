import { useState, useCallback, useRef, useEffect } from "react";

interface SlotState {
  playerName: string | null;
  isActive: boolean;
}

interface UseSlotManagerProps {
  onLog?: (msg: string) => void;
}

/**
 * Display 전용 슬롯 관리 Hook
 * - 플레이어 슬롯 할당/해제
 * - 순서대로 player1, player2에 할당
 * - 나가면 그 자리만 비워짐 (재배치 없음)
 */
export function useSlotManager({ onLog }: UseSlotManagerProps) {
  const [slots, setSlots] = useState<[SlotState, SlotState]>([
    { playerName: null, isActive: false },
    { playerName: null, isActive: false },
  ]);

  const slotsRef = useRef(slots);

  useEffect(() => {
    slotsRef.current = slots;
  }, [slots]);

  const findEmptySlot = useCallback((): 1 | 2 | null => {
    if (!slotsRef.current[0].isActive) return 1;
    if (!slotsRef.current[1].isActive) return 2;
    return null;
  }, []);

  const assignSlot = useCallback(
    (playerName: string): 1 | 2 | null => {
      const emptySlot = findEmptySlot();
      if (!emptySlot) {
        onLog?.(`❌ 슬롯 만원: ${playerName} 입장 거부`);
        return null;
      }

      setSlots((prev) => {
        const next: [SlotState, SlotState] = [...prev];
        next[emptySlot - 1] = {
          playerName,
          isActive: true,
        };
        return next;
      });

      onLog?.(`✅ 슬롯 할당: ${playerName} → player${emptySlot}`);
      return emptySlot;
    },
    [findEmptySlot, onLog]
  );

  const releaseSlot = useCallback(
    (playerName: string) => {
      setSlots((prev) => {
        const slotIndex = prev.findIndex((s) => s.playerName === playerName);

        if (slotIndex === -1) return prev;

        const next: [SlotState, SlotState] = [...prev];
        next[slotIndex] = {
          playerName: null,
          isActive: false,
        };

        onLog?.(`🚪 슬롯 해제: ${playerName} (player${slotIndex + 1} 자리 비워짐)`);
        return next;
      });
    },
    [onLog]
  );

  const resetSlots = useCallback(() => {
    setSlots([
      { playerName: null, isActive: false },
      { playerName: null, isActive: false },
    ]);
    onLog?.("🔄 모든 슬롯 초기화");
  }, [onLog]);

  const getSlotInfo = useCallback(
    (slot: 1 | 2): SlotState => {
      return slotsRef.current[slot - 1];
    },
    []
  );

  const findSlotByPlayer = useCallback(
    (playerName: string): 1 | 2 | null => {
      const index = slotsRef.current.findIndex(
        (s) => s.playerName === playerName
      );
      return index === -1 ? null : ((index + 1) as 1 | 2);
    },
    []
  );

  return {
    slots,
    assignSlot,
    releaseSlot,
    resetSlots,
    getSlotInfo,
    findSlotByPlayer,
    findEmptySlot,
  };
}
