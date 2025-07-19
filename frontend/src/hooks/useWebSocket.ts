import { useState, useEffect, useRef, useCallback } from 'react';

export interface KeyData {
  keyCode: number;
  analogValue: number;
  isPressed: number;
}

export interface WebSocketHookReturn {
  keyData: KeyData[];
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error';
  connect: () => void;
  disconnect: () => void;
}

export const useWebSocket = (url: string = 'ws://localhost:32312'): WebSocketHookReturn => {
  const [keyData, setKeyData] = useState<KeyData[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');
  const ws = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();

  const connect = useCallback(() => {
    if (ws.current?.readyState === WebSocket.OPEN) return;

    setConnectionStatus('connecting');
    
    try {
      ws.current = new WebSocket(url);

      ws.current.onopen = () => {
        setConnectionStatus('connected');
        console.log('WebSocket connected to Wooting backend');
      };

      ws.current.onmessage = (event) => {
        const message = event.data;
        if (message) {
          // Parse the message format: (keycode:analogvalue:pressed)(keycode:analogvalue:pressed)...
          const keyMatches = message.match(/\((\d+):([^:]+):(\d+)\)/g);
          if (keyMatches) {
            const parsedKeys: KeyData[] = keyMatches.map((match: string) => {
              const [, keyCode, analogValue, isPressed] = match.match(/\((\d+):([^:]+):(\d+)\)/) || [];
              return {
                keyCode: parseInt(keyCode),
                analogValue: parseFloat(analogValue),
                isPressed: parseInt(isPressed)
              };
            });
            setKeyData(parsedKeys);
          }
        }
      };

      ws.current.onclose = () => {
        setConnectionStatus('disconnected');
        console.log('WebSocket disconnected');
        
        // Auto-reconnect after 3 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          if (ws.current?.readyState !== WebSocket.OPEN) {
            connect();
          }
        }, 3000);
      };

      ws.current.onerror = () => {
        setConnectionStatus('error');
        console.error('WebSocket error');
      };
    } catch (error) {
      setConnectionStatus('error');
      console.error('Failed to create WebSocket connection:', error);
    }
  }, [url]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    
    if (ws.current) {
      ws.current.close();
      ws.current = null;
    }
    setConnectionStatus('disconnected');
    setKeyData([]);
  }, []);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    keyData,
    connectionStatus,
    connect,
    disconnect
  };
};