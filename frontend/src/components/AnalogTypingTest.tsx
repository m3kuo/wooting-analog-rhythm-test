import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { KeyboardKey } from './KeyboardKey';
import { useWebSocket, KeyData } from '@/hooks/useWebSocket';
import { Play, Pause, RotateCcw, Wifi, WifiOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface TestSequence {
  key: string;
  keyCode: number;
  targetPressure: number;
}

interface TestStats {
  accuracy: number;
  totalAttempts: number;
  successfulHits: number;
  averageDeviation: number;
}

const HOME_ROW_KEYS = [
  { key: 'a', keyCode: 4 },
  { key: 's', keyCode: 22 },
  { key: 'd', keyCode: 7 },
  { key: 'f', keyCode: 9 },
  { key: 'j', keyCode: 13 },
  { key: 'k', keyCode: 14 },
  { key: 'l', keyCode: 15 },
];

const PRESSURE_LEVELS_MAP: Record<number, number[]> = {
  2: [50, 100],
  3: [30, 60, 100],
};

export const AnalogTypingTest = () => {
  const { keyData, connectionStatus, connect, disconnect } = useWebSocket();
  const { toast } = useToast();

  const [levelCount, setLevelCount] = useState<number>(3);

  const [testSequence, setTestSequence] = useState<TestSequence[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTestActive, setIsTestActive] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [maxAnalog, setMaxAnalog] = useState<number>(0);
  const [keyHeld, setKeyHeld] = useState<boolean>(false);

  const [testStats, setTestStats] = useState<TestStats>({
    accuracy: 0,
    totalAttempts: 0,
    successfulHits: 0,
    averageDeviation: 0
  });

  const generateTestSequence = useCallback(() => {
    const sequence: TestSequence[] = [];
    const levels = PRESSURE_LEVELS_MAP[levelCount] || [30, 60, 100];
    for (let i = 0; i < 20; i++) {
      const randomKey = HOME_ROW_KEYS[Math.floor(Math.random() * HOME_ROW_KEYS.length)];
      const randomPressure = levels[Math.floor(Math.random() * levels.length)];
      sequence.push({
        key: randomKey.key,
        keyCode: randomKey.keyCode,
        targetPressure: randomPressure
      });
    }
    setTestSequence(sequence);
    setCurrentIndex(0);
  }, [levelCount]);

  useEffect(() => {
    generateTestSequence();
  }, [generateTestSequence]);

  useEffect(() => {
    if (!isTestActive || currentIndex >= testSequence.length) return;
    if (cooldownUntil && Date.now() < cooldownUntil) return;

    const currentTarget = testSequence[currentIndex];
    const keyEvent = keyData.find(k => k.keyCode === currentTarget.keyCode);
    const otherPressed = keyData.find(k => k.keyCode !== currentTarget.keyCode && k.isPressed);

    if (otherPressed) {
      handleAttempt(100, false, 'Wrong key!');
      return;
    }

    if (keyEvent?.isPressed) {
      setKeyHeld(true);
      setMaxAnalog(prev => Math.max(prev, keyEvent.analogValue));
    } else if (keyHeld) {
      const percent = maxAnalog * 100;
      const deviation = Math.abs(percent - currentTarget.targetPressure);
      const success = deviation <= 10;
      handleAttempt(deviation, success, success ? 'Good!' : 'Missed target');
      setKeyHeld(false);
      setMaxAnalog(0);
    }
  }, [keyData, isTestActive, currentIndex, testSequence, cooldownUntil, maxAnalog, keyHeld]);

  const handleAttempt = (deviation: number, isSuccess: boolean, message: string) => {
    setTestStats(prev => {
      const newTotal = prev.totalAttempts + 1;
      const newHits = prev.successfulHits + (isSuccess ? 1 : 0);
      const accuracy = (newHits / newTotal) * 100;
      const avgDev = (prev.averageDeviation * prev.totalAttempts + deviation) / newTotal;
      return {
        accuracy,
        totalAttempts: newTotal,
        successfulHits: newHits,
        averageDeviation: avgDev
      };
    });

    toast({
      title: message,
      description: isSuccess ? 'Held correct pressure' : `Deviation: ${Math.round(deviation)}%`,
      variant: isSuccess ? undefined : 'destructive'
    });

    setCooldownUntil(Date.now() + 3000);
    setTimeout(() => {
      setCurrentIndex(prev => prev + 1);
      setCooldownUntil(null);
    }, 3000);
  };

  useEffect(() => {
    if (currentIndex >= testSequence.length && isTestActive) {
      setIsTestActive(false);
      toast({
        title: 'Test Complete!',
        description: `Final accuracy: ${Math.round(testStats.accuracy)}%`,
      });
    }
  }, [currentIndex, testSequence.length, isTestActive, testStats.accuracy, toast]);

  const startTest = () => {
    if (connectionStatus !== 'connected') {
      connect();
      toast({ title: 'Connecting...', description: 'Please wait while we connect to your Wooting keyboard' });
      return;
    }
    setIsTestActive(true);
  };

  const pauseTest = () => setIsTestActive(false);

  const resetTest = () => {
    setIsTestActive(false);
    setCurrentIndex(0);
    setTestStats({ accuracy: 0, totalAttempts: 0, successfulHits: 0, averageDeviation: 0 });
    setCooldownUntil(null);
    setMaxAnalog(0);
    setKeyHeld(false);
    generateTestSequence();
  };

  const getCurrentKeyPress = (keyCode: number): KeyData | undefined => {
    return keyData.find(k => k.keyCode === keyCode);
  };

  const getConnectionIcon = () => {
    switch (connectionStatus) {
      case 'connected': return <Wifi className="w-4 h-4 text-success" />;
      case 'connecting': return <Wifi className="w-4 h-4 text-warning animate-pulse" />;
      default: return <WifiOff className="w-4 h-4 text-destructive" />;
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            Wooting Analog Precision Test
          </h1>
          <p className="text-muted-foreground">
            Test your keyboard control by hitting and holding precise pressure values
          </p>
        </div>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {getConnectionIcon()}
              <span className="font-medium">
                Status: {connectionStatus.charAt(0).toUpperCase() + connectionStatus.slice(1)}
              </span>
            </div>
            <div className="flex gap-2">
              {connectionStatus !== 'connected' && (
                <Button variant="outline" size="sm" onClick={connect}>
                  Connect
                </Button>
              )}
              {connectionStatus === 'connected' && (
                <Button variant="outline" size="sm" onClick={disconnect}>
                  Disconnect
                </Button>
              )}
            </div>
          </div>
        </Card>

        <div className="flex justify-center">
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">Select pressure thresholds:</div>
            <div className="flex gap-2">
              {[2, 3].map((count) => (
                <Button
                  key={count}
                  variant={count === levelCount ? 'default' : 'outline'}
                  onClick={() => setLevelCount(count)}
                  size="sm"
                >
                  {count} Levels
                </Button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-primary">
              {Math.round(testStats.accuracy)}%
            </div>
            <div className="text-sm text-muted-foreground">Accuracy</div>
          </Card>
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-foreground">
              {testStats.successfulHits}
            </div>
            <div className="text-sm text-muted-foreground">Successful Hits</div>
          </Card>
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-foreground">
              {testStats.totalAttempts}
            </div>
            <div className="text-sm text-muted-foreground">Total Attempts</div>
          </Card>
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-foreground">
              {Math.round(testStats.averageDeviation)}%
            </div>
            <div className="text-sm text-muted-foreground">Avg Deviation</div>
          </Card>
        </div>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex gap-2">
              {!isTestActive ? (
                <Button onClick={startTest} className="flex items-center gap-2">
                  <Play className="w-4 h-4" />
                  Start Test
                </Button>
              ) : (
                <Button onClick={pauseTest} variant="secondary" className="flex items-center gap-2">
                  <Pause className="w-4 h-4" />
                  Pause
                </Button>
              )}
              <Button onClick={resetTest} variant="outline" className="flex items-center gap-2">
                <RotateCcw className="w-4 h-4" />
                Reset
              </Button>
            </div>
            <div className="text-sm text-muted-foreground">
              Progress: {currentIndex} / {testSequence.length}
            </div>
          </div>
          <Progress value={(currentIndex / testSequence.length) * 100} className="h-2" />
        </Card>

        {isTestActive && (
          <Card className="p-6 text-center">
            {cooldownUntil && Date.now() < cooldownUntil ? (
              <div className="text-lg text-muted-foreground">Get ready for the next key...</div>
            ) : (
              <div>
                <div className="text-lg text-muted-foreground mb-2">Press and hold this key:</div>
                <div className="flex justify-center">
                  <KeyboardKey
                    keyChar={testSequence[currentIndex]?.key}
                    targetPressure={testSequence[currentIndex]?.targetPressure}
                    currentPressure={getCurrentKeyPress(testSequence[currentIndex]?.keyCode)?.analogValue || 0}
                    isPressed={getCurrentKeyPress(testSequence[currentIndex]?.keyCode)?.isPressed === 1}
                    isTarget={true}
                    className="w-20 h-20 text-3xl"
                  />
                </div>
              </div>
            )}
          </Card>
        )}

        <Card className="p-4 mt-4">
          <h3 className="text-lg font-medium mb-2">Real-time Key Data</h3>
          {keyData.length === 0 ? (
            <div className="text-muted-foreground text-sm">No keys currently pressed</div>
          ) : (
            keyData.map(k => (
              <div key={k.keyCode} className="text-sm">
                Key {k.keyCode}: {Math.round(k.analogValue * 100)}%
              </div>
            ))
          )}
        </Card>
      </div>
    </div>
  );
};
