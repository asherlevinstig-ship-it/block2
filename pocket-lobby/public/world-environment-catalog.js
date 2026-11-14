const asset=name=>'assets/environment/'+name+'.webp';
export const environmentProfiles={
 courtyard:{asset:'assets/environment/courtyard-valley.png',oak:true,sky:true,leaves:true,motes:'#d8c185',fog:[[.2,.34,.13],[.62,.43,.17],[.79,.81,.12]],falls:[[.80,.646,.034,.122],[.912,.758,.036,.12]],water:[[.70,.90],[.76,.85],[.83,.89],[.90,.88],[1,.95],[1,1],[.70,1]],lights:[[.856,.153],[.83,.255],[.90,.213],[.862,.546],[.923,.498],[.965,.565]]},
 pond:{asset:asset('pond'),sky:true,leaves:true,motes:'#e4efa0',fog:[[.24,.43,.16],[.66,.36,.18],[.81,.77,.12]],water:[[.17,.38],[.79,.35],[.99,.49],[.82,.84],[.65,1],[.25,1],[.12,.6]],lights:[[.783,.352],[.912,.323],[.928,.355]]},
 forest:{asset:asset('forest'),leaves:true,motes:'#c9efac',fog:[[.27,.45,.13],[.65,.49,.14],[.74,.78,.14]],lights:[[.905,.42],[.817,.403],[.864,.453]]},
 river:{asset:asset('river'),sky:true,leaves:true,motes:'#caedcb',fog:[[.30,.45,.13],[.64,.31,.16],[.74,.77,.14]],falls:[[.858,.297,.025,.116],[.90,.49,.09,.037]],water:[[.16,.4],[.67,.3],[.83,.5],[1,.59],[1,.9],[.62,1],[.28,.92]],lights:[[.14,.248],[.78,.21],[.823,.325],[.967,.303]]},
 quarry:{asset:asset('quarry'),sky:true,motes:'#d5bc99',fog:[[.30,.45,.16],[.68,.36,.18],[.76,.72,.12]],lights:[[.851,.39],[.93,.36],[.954,.179],[.98,.602]]},
 cavern:{asset:asset('cavern'),motes:'#b0d8ff',fog:[[.30,.49,.13],[.64,.4,.16],[.79,.73,.12]],falls:[[.918,.253,.029,.334]],water:[[.79,.61],[.97,.57],[1,.74],[.75,.75]],coolLights:true,lights:[[.06,.415],[.94,.25],[.95,.70],[.81,.865],[.059,.22]]},
 dungeon:{asset:asset('dungeon'),motes:'#b5b6e9',fog:[[.30,.45,.13],[.64,.47,.16],[.77,.77,.13]],falls:[[.903,.63,.028,.10]],water:[[.75,.77],[1,.74],[1,.95],[.63,1],[.68,.86]],lights:[[.113,.37],[.859,.267],[.819,.324],[.993,.309]]},
 atrium:{asset:asset('atrium'),motes:'#f0d9ac',fog:[[.50,.47,.15]],lights:[[.079,.342],[.928,.342],[.19,.356],[.621,.389],[.829,.337],[.494,.228]]},
 arcade:{asset:asset('arcade'),motes:'#ebc38a',lights:[[.09,.266],[.35,.16],[.574,.124],[.64,.139],[.778,.48],[.974,.423],[.14,.499]]},
 watch:{asset:asset('watch'),sky:true,leaves:true,motes:'#f0c8a3',fog:[[.27,.4,.15],[.61,.39,.18],[.75,.69,.11]],coolLights:true,lights:[[.899,.064],[.941,.481],[.927,.347]]},
 chamber:{asset:asset('chamber'),motes:'#edcea6',lights:[[.196,.244],[.154,.762],[.046,.711],[.996,.294]]},
 lounge:{asset:asset('lounge'),motes:'#ecc6d4',lights:[[.103,.276],[.942,.278],[.463,.059],[.67,.416],[.858,.414]]}
};
const group=(rooms,theme,extra={})=>Object.fromEntries(rooms.map(room=>[room,{theme,...extra}]));
// Every playable room is assigned explicitly. Related places share biome art,
// with individual framing, colour and particle seeds instead of a generic sky.
export const roomEnvironments={
 outside:{theme:'courtyard',position:.72,mobilePosition:.90},
 home:{theme:'chamber',position:.68},hub:{theme:'atrium',position:.60},factionHall:{theme:'atrium',position:.76,hue:7},
 lounge:{theme:'lounge',position:.72},
 ...group(['store','market','furnishings','tailor','bakery','armory'],'arcade'),
 store:{theme:'arcade',hue:8,position:.8},tailor:{theme:'arcade',hue:14,position:.66},armory:{theme:'arcade',hue:-9,position:.78},bakery:{theme:'arcade',hue:-5,position:.57},
 pond:{theme:'pond',position:.72},creek:{theme:'river',position:.56,hue:5},
 reedwater:{theme:'river',position:.55},willowbank:{theme:'river',position:.70,hue:-4},millbrook:{theme:'river',position:.84},
 ...group(['trail','logging','clearing','wildlifeReserve','grove','shrine','ruins','roots','thornwood'],'forest'),
 logging:{theme:'forest',position:.60,hue:-6},clearing:{theme:'forest',position:.70},wildlifeReserve:{theme:'forest',position:.65,hue:-12},
 grove:{theme:'forest',position:.76,hue:14},shrine:{theme:'forest',position:.65,hue:19},ruins:{theme:'forest',position:.86,hue:12},roots:{theme:'cavern',position:.52,hue:-18},thornwood:{theme:'forest',hue:18,brightness:.65},
 quarry:{theme:'quarry',position:.77},crystaldeep:{theme:'cavern',position:.74},
 ambermead:{theme:'watch',position:.52,hue:-10},beaconwatch:{theme:'watch',position:.82},waystation:{theme:'watch',position:.18,hue:-14},starfall:{theme:'watch',position:.70,hue:16},
 ...group(['millCellar','depthsGate','depthsGallery','depthsCache','depthsTreasury','depthsRest','depthsTrial','depthsVault'],'dungeon'),
 millCellar:{theme:'dungeon',position:.55,hue:-12},depthsGate:{theme:'dungeon',position:.75,hue:-7},
 depthsGallery:{theme:'dungeon',position:.63,hue:-12},depthsCache:{theme:'dungeon',position:.85,hue:10},depthsTreasury:{theme:'dungeon',position:.78,hue:-18},
 depthsRest:{theme:'cavern',position:.78,hue:-10},depthsTrial:{theme:'dungeon',position:.83,hue:14},depthsVault:{theme:'dungeon',position:.87,hue:18}
};
export function environmentForRoom(room){const entry=roomEnvironments[room];return entry?{...environmentProfiles[entry.theme],position:.68,mobilePosition:.78,hue:0,brightness:.78,...entry}:null;}
