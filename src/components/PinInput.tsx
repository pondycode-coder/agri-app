import { useRef } from "react";
import { Input } from "@/components/ui/input";

export const PinInput: React.FC<{
  value: string;
  onChange: (pin: string) => void;
  disabled?: boolean;
  length?: number;
}> = ({ value, onChange, disabled, length = 4 }) => {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleChange = (index: number, digit: string) => {
    if (!/^\d*$/.test(digit)) return;
    const newPin = value.split('');
    newPin[index] = digit;
    const pin = newPin.join('').slice(0, length);
    onChange(pin);
    if (digit && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !value[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    onChange(pasted);
    if (pasted.length > 0) {
      inputRefs.current[Math.min(pasted.length, length - 1)]?.focus();
    }
  };

  return (
    <div className="flex gap-3 justify-center" onPaste={handlePaste}>
      {Array.from({ length }).map((_, i) => (
        <Input
          key={i}
          ref={(el) => { inputRefs.current[i] = el; }}
          type="password"
          inputMode="numeric"
          maxLength={1}
          value={value[i] || ''}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          disabled={disabled}
          className="w-14 h-14 text-center text-2xl font-bold border-white/10 bg-white/[0.05] text-white placeholder:text-white/20 focus-visible:ring-emerald-500/50"
          autoFocus={i === 0}
        />
      ))}
    </div>
  );
};
