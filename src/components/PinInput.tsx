import { useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";

export const PinInput: React.FC<{
  value: string;
  onChange: (pin: string) => void;
  disabled?: boolean;
  length?: number;
}> = ({ value, onChange, disabled, length = 4 }) => {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [show, setShow] = useState(false);

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
    <div>
      <div className="flex gap-3 justify-center" onPaste={handlePaste}>
        {Array.from({ length }).map((_, i) => (
          <Input
            key={i}
            ref={(el) => { inputRefs.current[i] = el; }}
            type={show ? "text" : "password"}
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
      <div className="flex justify-center mt-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 text-xs text-white/60 hover:text-white"
          onClick={() => setShow((s) => !s)}
          disabled={disabled}
        >
          {show ? <EyeOff className="h-3.5 w-3.5 mr-1.5" /> : <Eye className="h-3.5 w-3.5 mr-1.5" />}
          {show ? 'Masquer le PIN' : 'Afficher le PIN'}
        </Button>
      </div>
    </div>
  );
};
