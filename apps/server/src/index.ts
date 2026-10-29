import { listen } from "@colyseus/tools";
import { defineRoom, defineServer } from "@colyseus/core";
import { PRACTICE_ROOM, SILVER_DEPTHS_ROOM, WORLD_ROOM } from "@blockcraft/protocol";
import { WorldRoom } from "./game-room.js";

const SERVER_BUILD = "combat-only-v307";

const gameServer = defineServer({
  rooms: {
    [WORLD_ROOM]: defineRoom(WorldRoom, { roomKind: "overworld" }),
    [SILVER_DEPTHS_ROOM]: defineRoom(WorldRoom, { roomKind: "silver-depths" }).filterBy(["instanceKey"]),
    [PRACTICE_ROOM]: defineRoom(WorldRoom, { roomKind: "practice" }),
  },
  express: app => {
    app.get("/health", (_request, response) => response.json({
      ok: true,
      service: "blockcraft-server",
      build: SERVER_BUILD,
    }));
  },
});

listen(gameServer);
