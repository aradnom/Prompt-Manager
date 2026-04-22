import type { Server as HttpServer } from "http";
import type { RequestHandler } from "express";
import { WebSocket, WebSocketServer } from "ws";
import type { IncomingMessage } from "http";
import { userEventBus } from "@server/lib/user-event-bus";

const WS_PATH = "/api/events";

/**
 * Attach a WebSocket server to the given HTTP server.
 *
 * Authenticates each upgrade by running the Express session middleware
 * manually against the upgrade request. Only established sessions with a
 * userId are allowed; everything else gets a 401 and the socket is destroyed.
 *
 * Once connected, a UserEventBus subscriber is installed for the socket's
 * userId; all events emitted to that userId from anywhere on the server get
 * forwarded as JSON messages.
 */
export function attachWebSocketServer(
  httpServer: HttpServer,
  sessionMiddleware: RequestHandler,
): void {
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on("upgrade", (req, socket, head) => {
    if (!req.url?.startsWith(WS_PATH)) return;

    // Run session middleware against the upgrade request to populate req.session.
    // express-session expects req/res, but for upgrade we only have req — it
    // works because the middleware only reads cookies and writes to req.session.
    const fakeRes = {
      getHeader: () => undefined,
      setHeader: () => fakeRes,
      // express-session calls end() if it wants to reject; we just swallow.
      end: () => fakeRes,
      writeHead: () => fakeRes,
    };

    sessionMiddleware(
      req as unknown as Parameters<RequestHandler>[0],
      fakeRes as unknown as Parameters<RequestHandler>[1],
      () => {
        const userId = (
          req as IncomingMessage & { session?: { userId?: number } }
        ).session?.userId;

        if (!userId) {
          socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
          socket.destroy();
          return;
        }

        wss.handleUpgrade(req, socket, head, (ws) => {
          wss.emit("connection", ws, req, userId);
        });
      },
    );
  });

  wss.on(
    "connection",
    (ws: WebSocket, _req: IncomingMessage, userId: number) => {
      const unsubscribe = userEventBus.subscribe(userId, (event) => {
        if (ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify(event));
        }
      });

      ws.on("close", () => unsubscribe());
      ws.on("error", (err: Error) => {
        console.error(`WS error for user ${userId}:`, err);
      });
    },
  );
}
