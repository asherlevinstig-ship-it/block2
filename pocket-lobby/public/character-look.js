export const hairStyles={short:'Side sweep',long:'Long locks',ponytail:'Ponytail'};
export const faceStyles={classic:'Classic',soft:'Soft',angular:'Angular'};
export const skinTones=['Original','Warm','Brown','Deep'];
export function normalizeCharacterLook(appearance={}){
  if(appearance.gender!==undefined&&!['male','female'].includes(appearance.gender))throw new Error('Invalid character gender.');
  if(appearance.hairStyle!==undefined&&!Object.hasOwn(hairStyles,appearance.hairStyle))throw new Error('Invalid hairstyle.');
  if(appearance.faceStyle!==undefined&&!Object.hasOwn(faceStyles,appearance.faceStyle))throw new Error('Invalid face style.');
  if(appearance.skinTone!==undefined&&(!Number.isInteger(appearance.skinTone)||appearance.skinTone<0||appearance.skinTone>=skinTones.length))throw new Error('Invalid skin tone.');
  return {...(appearance.gender==='female'?{gender:'female'}:{}),
    ...(appearance.hairStyle?{hairStyle:appearance.hairStyle}:{}),
    ...(appearance.faceStyle?{faceStyle:appearance.faceStyle}:{}),
    ...(appearance.skinTone?{skinTone:appearance.skinTone}:{})};
}
