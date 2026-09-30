// Compatibility entrypoint for the existing Colyseus Cloud PM2 process.
// The managed host retains this historical script path between deployments.
import("../apps/server/dist/index.js").catch(error => {
  console.error(error);
  process.exit(1);
});
