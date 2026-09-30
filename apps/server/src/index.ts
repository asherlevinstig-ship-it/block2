import { listen } from "@colyseus/tools";
import { defineRoom, defineServer } from "@colyseus/core";
import { WORLD_ROOM } from "@blockcraft/protocol";
import { WorldRoom } from "./game-room.js";

const gameServer = defineServer({
  rooms: { [WORLD_ROOM]: defineRoom(WorldRoom) },
  express: app => {
    app.get("/health", (_request, response) => response.json({ ok: true, service: "blockcraft-server" }));
  },
});

listen(gameServer);
