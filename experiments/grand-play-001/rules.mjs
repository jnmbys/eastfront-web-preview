// Isolated campaign rules. One tick is five campaign minutes, not an old phase.
export const rules = Object.freeze({version:'GRAND-PLAY-1',saveVersion:1,minutes:5,wallMs:8000,speeds:[1,2,4],epochTicks:24,duration:180,holdTicks:24,victoryFrom:150,searchBudget:400,stack:3,orgRetreat:18,combatQ:.25,moveQ:.5});
export const sides=['GERMAN','SOVIET'];
export const profiles=[{name:'雷纳·沃尔特',assault:1.15,stop:32,concentration:1},{name:'米哈伊尔·罗文',assault:.9,stop:45,concentration:2},{name:'安东·维尔',assault:1,stop:38,concentration:1.5}];
export const goals=[{name:'西岸集结线 W17',paper:'W17'},{name:'中央枢纽 Z17',paper:'Z17'},{name:'东岸站区 AC17',paper:'AC17'},{name:'北侧迂回 X14',paper:'X14'}];
