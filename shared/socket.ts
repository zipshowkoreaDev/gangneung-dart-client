import { io } from "socket.io-client";

const SOCKET_URL =
  process.env.NEXT_PUBLIC_SOCKET_URL ?? "https://socket-relay.zipshowkorea.com/dart";

export const socket = io(SOCKET_URL, {
  transports: ["polling", "websocket"],
  autoConnect: false,
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: Infinity,
  withCredentials: false,
  forceNew: true,
});
