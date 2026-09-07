export function createLoadingWatchdog({ onTimeout, setTimer = setTimeout, clearTimer = clearTimeout, timeoutMs = 20000 }) {
  let timer = null;
  let generation = 0;
  function stop() {
    generation++;
    if (timer !== null) clearTimer(timer);
    timer = null;
  }
  return {
    start() {
      stop();
      const current = generation;
      timer = setTimer(() => {
        if (generation !== current) return;
        timer = null;
        onTimeout();
      }, timeoutMs);
    },
    stop,
  };
}
