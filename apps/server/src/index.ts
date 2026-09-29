import { createServer } from "node:http";
import express from "express";
import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { WORLD_ROOM } from "@blockcraft/protocol";
import { WorldRoom } from "./game-room.js";

const port = Number(process.env.PORT || 2567);
const app = express();
app.get("/health", (_request, response) => response.json({ ok: true, service: "blockcraft-server" }));

const httpServer = createServer(app);
const gameServer = new Server({ transport: new WebSocketTransport({ server: httpServer }) });
gameServer.define(WORLD_ROOM, WorldRoom);

await gameServer.listen(port);
console.log(`Blockcraft authoritative server listening on http://localhost:${port}`);
