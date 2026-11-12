export const MAX_ACTION_POINTS=100;
export const ACTION_POINT_REGEN_MS=60000;
export function normalizeActionPoints(input){
 return {value:Number.isFinite(input?.value)?Math.max(0,Math.min(MAX_ACTION_POINTS,Math.floor(input.value))):MAX_ACTION_POINTS,at:Number.isSafeInteger(input?.at)&&input.at>=0?input.at:0,active:input?.active===true};
}
export function availableActionPoints(input,now){
 const p=normalizeActionPoints(input);
 return p.active?p.value:Math.min(MAX_ACTION_POINTS,p.value+Math.max(0,Math.floor((now-p.at)/ACTION_POINT_REGEN_MS)));
}
