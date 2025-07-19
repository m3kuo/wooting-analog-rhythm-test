import { cn } from '@/lib/utils';

interface KeyboardKeyProps {
  keyChar: string;
  targetPressure?: number;
  currentPressure?: number;
  isPressed?: boolean;
  isTarget?: boolean;
  className?: string;
}

export const KeyboardKey = ({
  keyChar,
  targetPressure = 0,
  currentPressure = 0,
  isPressed = false,
  isTarget = false,
  className
}: KeyboardKeyProps) => {
  const getKeyState = () => {
    if (!isTarget) return 'idle';
    if (!isPressed) return 'target';

    const tolerance = 10; // 10% tolerance
    const diff = Math.abs(currentPressure * 100 - targetPressure);

    if (diff <= tolerance) return 'success';
    return 'error';
  };

  const keyState = getKeyState();

  const getPressureColor = (pressure: number) => {
    if (pressure < 0.3) return 'hsl(var(--analog-low))';
    if (pressure < 0.7) return 'hsl(var(--analog-mid))';
    return 'hsl(var(--analog-high))';
  };

  return (
    <div
      className={cn(
        'relative w-16 h-16 rounded-lg flex flex-col items-center justify-center',
        'transition-all duration-150 font-mono font-bold text-lg',
        'border-2 shadow-lg',
        {
          'bg-keyboard-key-idle border-border text-muted-foreground': keyState === 'idle',
          'bg-keyboard-key-target border-primary text-primary': keyState === 'target',
          'bg-keyboard-key-pressed border-success text-success animate-key-press': keyState === 'success',
          'bg-keyboard-key-error border-destructive text-destructive animate-key-press': keyState === 'error'
        },
        className
      )}
      style={{
        boxShadow: isPressed
          ? `0 0 20px ${getPressureColor(currentPressure)}40`
          : 'var(--shadow-key)'
      }}
    >
      <span className="text-2xl text-white uppercase">{keyChar}</span>

      {isTarget && (
        <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2">
          <div className="text-xs text-center">
            <div className="text-primary font-bold">{targetPressure}%</div>
            {isPressed && (
              <div
                className="text-xs font-medium"
                style={{ color: getPressureColor(currentPressure) }}
              >
                {Math.round(currentPressure * 100)}%
              </div>
            )}
          </div>
        </div>
      )}

      {isPressed && (
        <div
          className="absolute inset-0 rounded-lg opacity-30"
          style={{
            background: `linear-gradient(0deg, ${getPressureColor(currentPressure)} ${currentPressure * 100}%, transparent ${currentPressure * 100}%)`
          }}
        />
      )}
    </div>
  );
};
