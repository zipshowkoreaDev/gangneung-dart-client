import { useMemo, useState } from "react";
import useProfanityCheck from "./useProfanityCheck";

type UseNameInputFlowReturn = {
  name: string;
  setName: (value: string) => void;
  socketName: string;
  errorMessage: string;
  reset: () => void;
};

export default function useNameInputFlow(): UseNameInputFlowReturn {
  const [name, setNameState] = useState("");
  const [nameSuffix, setNameSuffix] = useState("");
  const { validateInput } = useProfanityCheck();

  const setName = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) {
      setNameState("");
      setNameSuffix("");
      return;
    }
    if (!nameSuffix) {
      setNameSuffix(Math.random().toString(36).slice(2, 6));
    }
    setNameState(value);
  };

  const socketName = useMemo(() => {
    const trimmed = name.trim();
    return trimmed ? `${trimmed}#${nameSuffix}` : "";
  }, [name, nameSuffix]);

  const errorMessage = useMemo(() => {
    if (!name.trim()) return "";
    const validation = validateInput(name);
    return validation.isValid ? "" : validation.message;
  }, [name, validateInput]);

  const reset = () => {
    setNameState("");
    setNameSuffix("");
  };

  return {
    name,
    setName,
    socketName,
    errorMessage,
    reset,
  };
}
