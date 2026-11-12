export const MAX_ACTION_POINTS=100;
export function normalizeActionPoints(input){
 return {value:Number.isFinite(input?.value)?Math.max(0,Math.min(MAX_ACTION_POINTS,Math.floor(input.value))):MAX_ACTION_POINTS,at:Number.isSafeInteger(input?.at)&&input.at>=0?input.at:0,active:input?.active===true,...(Number.isSafeInteger(input?.spent)&&input.spent>=0?{spent:input.spent}:{})};
}
export function availableActionPoints(input,now){
 return normalizeActionPoints(input).value;
}
