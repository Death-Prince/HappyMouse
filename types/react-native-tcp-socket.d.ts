// types/react-native-tcp-socket.d.ts

declare module "react-native-tcp-socket" {
  export interface Socket {
    write(data: string | Uint8Array): void;
    destroy(): void;
    on(event: "data", callback: (data: Uint8Array | string) => void): void;
    on(event: "error", callback: (error: string) => void): void;
    on(event: "close", callback: () => void): void;
  }

  export interface ConnectionOptions {
    port: number;
    host: string;
    timeout?: number;
  }

  export function createConnection(
    options: ConnectionOptions,
    callback?: () => void
  ): Socket;
}
