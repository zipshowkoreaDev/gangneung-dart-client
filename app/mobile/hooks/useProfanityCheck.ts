import { useCallback } from "react";
import profanityList from "@/lib/constants/profanity.json";
import { createProfanityChecker } from "@/lib/profanityCheckCore.js";

const checker = createProfanityChecker(profanityList);

const useProfanityCheck = () => {
  const containsProfanity = useCallback(
    (text: string): boolean => checker.containsProfanity(text),
    []
  );

  const findProfanities = useCallback(
    (text: string): string[] => checker.findProfanities(text),
    []
  );

  const replaceProfanity = useCallback(
    (text: string, replaceChar: string = "*"): string =>
      checker.replaceProfanity(text, replaceChar),
    []
  );

  const validateInput = useCallback(
    (text: string): { isValid: boolean; message: string } =>
      checker.validateInput(text),
    []
  );

  return {
    containsProfanity,
    findProfanities,
    replaceProfanity,
    validateInput,
  };
};

export default useProfanityCheck;
