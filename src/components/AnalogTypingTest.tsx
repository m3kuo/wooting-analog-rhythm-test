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

const PRESSURE_LEVELS = [30, 60, 100];

export const AnalogTypingTest = () => {
  const { keyData, connectionStatus, connect, disconnect } = useWebSocket();
  const { toast } = useToast();
  
  const [testSequence, setTestSequence] = useState<TestSequence[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTestActive, setIsTestActive] = useState(false);
  const [testStats, setTestStats] = useState<TestStats>({
    accuracy: 0,
    totalAttempts: 0,
    successfulHits: 0,
    averageDeviation: 0
  });
  const [attempts, setAttempts] = useState<number[]>([]);

  // Generate a random test sequence
  const generateTestSequence = useCallback(() => {
    const sequence: TestSequence[] = [];
    for (let i = 0; i < 20; i++) {
      const randomKey = HOME_ROW_KEYS[Math.floor(Math.random() * HOME_ROW_KEYS.length)];
      const randomPressure = PRESSURE_LEVELS[Math.floor(Math.random() * PRESSURE_LEVELS.length)];
      sequence.push({
        key: randomKey.key,
        keyCode: randomKey.keyCode,
        targetPressure: randomPressure
      });
    }
    setTestSequence(sequence);
    setCurrentIndex(0);
  }, []);

  // Initialize test sequence on mount
  useEffect(() => {
    generateTestSequence();
  }, [generateTestSequence]);

  // Handle key press detection
  useEffect(() => {
    if (!isTestActive || currentIndex >= testSequence.length) return;

    const currentTarget = testSequence[currentIndex];
    const keyPress = keyData.find(k => k.keyCode === currentTarget.keyCode && k.isPressed === 1);

    if (keyPress) {
      const pressurePercent = keyPress.analogValue * 100;
      const targetPercent = currentTarget.targetPressure;
      const deviation = Math.abs(pressurePercent - targetPercent);
      const tolerance = 10; // 10% tolerance

      setAttempts(prev => [...prev, deviation]);
      
      const isSuccess = deviation <= tolerance;
      
      setTestStats(prev => {
        const newTotalAttempts = prev.totalAttempts + 1;
        const newSuccessfulHits = prev.successfulHits + (isSuccess ? 1 : 0);
        const newAccuracy = (newSuccessfulHits / newTotalAttempts) * 100;
        const newAverageDeviation = (prev.averageDeviation * prev.totalAttempts + deviation) / newTotalAttempts;

        return {
          accuracy: newAccuracy,
          totalAttempts: newTotalAttempts,
          successfulHits: newSuccessfulHits,
          averageDeviation: newAverageDeviation
        };
      });

      if (isSuccess) {
        toast({
          title: "Perfect!",
          description: `Hit ${targetPercent}% with ${Math.round(pressurePercent)}% pressure`,
        });
      } else {
        toast({
          title: "Miss",
          description: `Target: ${targetPercent}%, You: ${Math.round(pressurePercent)}%`,
          variant: "destructive"
        });
      }

      // Move to next key after a short delay
      setTimeout(() => {
        setCurrentIndex(prev => prev + 1);
      }, 500);
    }
  }, [keyData, isTestActive, currentIndex, testSequence, toast]);

  // Auto-end test when sequence is complete
  useEffect(() => {
    if (currentIndex >= testSequence.length && isTestActive) {
      setIsTestActive(false);
      toast({
        title: "Test Complete!",
        description: `Final accuracy: ${Math.round(testStats.accuracy)}%`,
      });
    }
  }, [currentIndex, testSequence.length, isTestActive, testStats.accuracy, toast]);

  const startTest = () => {
    if (connectionStatus !== 'connected') {
      connect();
      toast({
        title: "Connecting...",
        description: "Please wait while we connect to your Wooting keyboard",
      });
      return;
    }
    setIsTestActive(true);
  };

  const pauseTest = () => {
    setIsTestActive(false);
  };

  const resetTest = () => {
    setIsTestActive(false);
    setCurrentIndex(0);
    setTestStats({
      accuracy: 0,
      totalAttempts: 0,
      successfulHits: 0,
      averageDeviation: 0
    });
    setAttempts([]);
    generateTestSequence();
  };

  const getCurrentKeyPress = (keyCode: number): KeyData | undefined => {
    return keyData.find(k => k.keyCode === keyCode);
  };

  const isCurrentTarget = (keyCode: number): boolean => {
    return isTestActive && currentIndex < testSequence.length && 
           testSequence[currentIndex].keyCode === keyCode;
  };

  const getConnectionIcon = () => {
    switch (connectionStatus) {
      case 'connected':
        return <Wifi className="w-4 h-4 text-success" />;
      case 'connecting':
        return <Wifi className="w-4 h-4 text-warning animate-pulse" />;
      default:
        return <WifiOff className="w-4 h-4 text-destructive" />;
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            Wooting Analog Precision Test
          </h1>
          <p className="text-muted-foreground">
            Test your analog keyboard control by hitting precise pressure values
          </p>
        </div>

        {/* Connection Status */}
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

        {/* Test Controls */}
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

          <Progress 
            value={(currentIndex / testSequence.length) * 100} 
            className="h-2"
          />
        </Card>

        {/* Stats */}
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

        {/* Current Target */}
        {isTestActive && currentIndex < testSequence.length && (
          <Card className="p-6 text-center">
            <div className="text-lg text-muted-foreground mb-2">Press this key:</div>
            <div className="flex justify-center">
              <KeyboardKey
                keyChar={testSequence[currentIndex].key}
                targetPressure={testSequence[currentIndex].targetPressure}
                currentPressure={getCurrentKeyPress(testSequence[currentIndex].keyCode)?.analogValue || 0}
                isPressed={getCurrentKeyPress(testSequence[currentIndex].keyCode)?.isPressed === 1}
                isTarget={true}
                className="w-20 h-20 text-3xl"
              />
            </div>
          </Card>
        )}

        {/* Keyboard Layout */}
        <Card className="p-6 bg-keyboard-bg">
          <h3 className="text-lg font-semibold mb-4">Home Row Keys</h3>
          <div className="flex justify-center gap-2">
            {HOME_ROW_KEYS.map((key) => {
              const keyPress = getCurrentKeyPress(key.keyCode);
              const currentTarget = isCurrentTarget(key.keyCode) ? testSequence[currentIndex] : undefined;
              
              return (
                <KeyboardKey
                  key={key.key}
                  keyChar={key.key}
                  targetPressure={currentTarget?.targetPressure}
                  currentPressure={keyPress?.analogValue || 0}
                  isPressed={keyPress?.isPressed === 1}
                  isTarget={!!currentTarget}
                />
              );
            })}
          </div>
        </Card>

        {/* Real-time Key Data */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Real-time Key Data</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-40 overflow-y-auto">
            {keyData.filter(k => k.isPressed === 1).map((key, index) => (
              <div key={index} className="bg-secondary p-2 rounded text-sm font-mono">
                Key {key.keyCode}: {Math.round(key.analogValue * 100)}%
              </div>
            ))}
            {keyData.filter(k => k.isPressed === 1).length === 0 && (
              <div className="text-muted-foreground text-sm col-span-full text-center py-4">
                No keys currently pressed
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};