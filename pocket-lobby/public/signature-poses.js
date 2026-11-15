export const signaturePoses={
 faultbreaker:{duration:900,impact:.58},
 sanctuary:{duration:800},
 bloodPrice:{duration:850}
};
export function signatureCast(state,now){
 const casts=Object.keys(signaturePoses).map(id=>({id,at:(state.styleAbilities?.readyAt?.[id]??0)-45000}));
 return casts.filter(cast=>cast.at>0&&now>=cast.at&&now-cast.at<signaturePoses[cast.id].duration).sort((a,b)=>b.at-a.at)[0]??null;
}
