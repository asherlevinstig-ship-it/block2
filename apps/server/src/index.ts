import { listen } from "@colyseus/tools";
import { defineRoom, defineServer } from "@colyseus/core";
import { SILVER_DEPTHS_ROOM, WORLD_ROOM } from "@blockcraft/protocol";
import { WorldRoom } from "./game-room.js";

const SERVER_BUILD = "colyseus-hunt-reward-sets-v224";

const gameServer = defineServer({
  rooms: {
    [WORLD_ROOM]: defineRoom(WorldRoom, { roomKind: "overworld" }),
    [SILVER_DEPTHS_ROOM]: defineRoom(WorldRoom, { roomKind: "silver-depths" }).filterBy(["instanceKey"]),
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
