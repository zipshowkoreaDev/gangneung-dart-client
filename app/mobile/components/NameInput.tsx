import { MAX_PLAYER_NAME_LENGTH } from "../lib/constants";

interface NameInputProps {
  name: string;
  onNameChange: (name: string) => void;
  onStart: () => void;
  errorMessage?: string;
}

export default function NameInput({
  name,
  onNameChange,
  onStart,
  errorMessage,
}: NameInputProps) {
  return (
    <div className="flex flex-col items-center gap-8">
      <div className="text-center text-[28px] font-bold text-neutral-900">
        다트 게임
      </div>

      <div className="flex flex-col items-center gap-4 w-full max-w-[320px]">
        <input
          type="text"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder={`이름 입력 (${MAX_PLAYER_NAME_LENGTH}글자 이내)`}
          maxLength={MAX_PLAYER_NAME_LENGTH}
          className="w-full rounded-xl border-2 border-black/10 bg-white/80 px-5 py-4 text-center text-lg text-neutral-900 placeholder:text-neutral-500 backdrop-blur-sm focus:border-neutral-400 focus:outline-none"
        />
        {errorMessage && (
          <div className="text-center text-sm text-red-600">{errorMessage}</div>
        )}
      </div>

      <button
        onClick={onStart}
        disabled={!name.trim() || Boolean(errorMessage)}
        className="py-5 px-10 text-2xl font-bold rounded-2xl border-none bg-gradient-to-br from-[#FFD700] to-[#FFA500] text-black shadow-[0_8px_32px_rgba(255,215,0,0.4)] disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none transition-all"
      >
        시작하기
      </button>
    </div>
  );
}
