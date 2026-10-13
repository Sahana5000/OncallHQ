'use client';
import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:4000';

export function useWebSocket(onIncidentUpdate: (data: any) => void) {
  const socketRef = useRef<Socket | null>(null);
  const callbackRef = useRef(onIncidentUpdate);

  // Keep callback ref fresh without re-subscribing
  useEffect(() => {
    callbackRef.current = onIncidentUpdate;
  }, [onIncidentUpdate]);

  const connect = useCallback(() => {
    if (socketRef.current?.connected) return;

    const socket = io(WS_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });

    socket.on('connect', () => {
      console.log('[WS] Connected to OnCallHQ realtime stream');
    });

    socket.on('incident:update', (data: any) => {
      callbackRef.current(data);
    });

    socket.on('incident:created', (data: any) => {
      callbackRef.current({ ...data, _event: 'created' });
    });

    socket.on('disconnect', (reason: string) => {
      console.warn(`[WS] Disconnected: ${reason}`);
    });

    socket.on('connect_error', (err: Error) => {
      console.warn(`[WS] Connection error: ${err.message}`);
    });

    socketRef.current = socket;
  }, []);

  const disconnect = useCallback(() => {
    socketRef.current?.disconnect();
    socketRef.current = null;
  }, []);

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  return { connect, disconnect };
}
