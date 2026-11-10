export const factionHall='factionHall';
export const factionHallSpawn={x:1,y:5};
export const factionHallRest={x:7,y:6};
export const factionHallStove={x:7,y:2};
export const factionHallLayout=[
 ['bookcase',2,1],['hallBoard',3,2],['stove',factionHallStove.x,factionHallStove.y],
 ['table',4,4],['chair',4,5],['chair',5,5],['bench',factionHallRest.x,factionHallRest.y],
 ['plant',1,1],['lamp',8,1]
];
export const hallProjects=[
 {name:'Build the faction hall',reward:'A private hall with room to meet and rest.',targets:{gold:500,timber:100,meal:20}},
 {name:'Build the field kitchen',reward:'A shared stove for cooking before an expedition.',targets:{gold:800,timber:160,meal:32}}
];

export const guildFeast={targets:{gold:100,timber:20,fish:10},hunger:50};
