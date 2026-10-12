// Original line symbols; no Paradox artwork or unsupported game controls.
export function commandIcon(kind:string){const paths:Record<string,string>={
 move:'M3 12h17m-6-6 6 6-6 6', attack:'M3 21 21 3m-10 0h10v10', support:'M3 18h7V6h10m-5-5 5 5-5 5', retreat:'M21 12H3m6-6-6 6 6 6', hold:'M5 4h14v17H5Zm4 4v9m6-9v9', refit:'M8 3v7H2m1-1a9 9 0 1 1 1 10', train:'m3 8 9-5 9 5-9 5Zm3 4v6l6 3 6-3v-6', sun:'M8 12a4 4 0 1 0 8 0 4 4 0 1 0-8 0M12 1v3m0 16v3M1 12h3m16 0h3M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2', rain:'M4 13a4 4 0 0 1 1-8 6 6 0 0 1 11 0 4 4 0 0 1 1 8Zm2 3-2 4m8-4-2 4m8-4-2 4', mud:'m12 2-6 9a7 7 0 1 0 12 0ZM7 16h10M8 19h8', people:'M8 7a4 4 0 1 0 8 0 4 4 0 1 0-8 0M3 22v-4c0-7 18-7 18 0v4', xp:'m12 2 3 6 7 1-5 5 1 8-6-4-6 4 1-8-5-5 7-1Z', rail:'M5 3h14v14H5Zm0 7h14M8 21l2-4m6 4-2-4M8 14h1m6 0h1', play:'m7 3 14 9-14 9Z', pause:'M7 3v18M17 3v18', save:'M3 3h16l2 2v16H3Zm4 0v7h10V3M7 21v-7h10v7', fuel:'M5 5h11v16H5Zm0 6h11m0-7 5 5v10h-3v-5h-2', gear:'M3 7h18v14H3Zm0 0 4-4h10l4 4M12 7v14', info:'M12 10v8m0-12v1M2 12a10 10 0 1 0 20 0 10 10 0 1 0-20 0',
 armor:'M3 12h18v7H3Zm4-5h9v5M16 9h7M5 22h14M6 15v2m5-2v2m5-2v2',
 artillery:'M12 3v18M3 12h18M6 6l12 12M18 6 6 18',
 motor:'M2 7h13v11H2Zm13 4h5l3 4v3h-8M6 18v4m13-4v4',
 production:'M3 21V10l6 3V8l6 4V4h5v17ZM7 17h2m3 0h2m3 0h2',
 supply:'M3 7h13v11H3ZM16 11h4l2 4v3h-6M6 18v3m13-3v3M6 4h9',
 construction:'m5 20 12-13m-9-3 12 12M4 5l3-3 15 15-3 3ZM2 18l4 4',
 army:'M3 5h18v14H3ZM3 5l18 14M21 5 3 19',
 division:'M4 3h6v6H4Zm10 0h6v6h-6ZM4 15h6v6H4Zm10 0h6v6h-6ZM7 9v6m10-6v6M7 12h10',
 war:'m4 3 16 18M20 3 4 21m0-6 5 5m6 0 5-5',
 settings:'M3 6h18M3 12h18M3 18h18M8 3v6m8 0v6m-9 0v6',
 city:'M3 21V9h6v12m0 0V3h6v18m0 0V12h6v9M1 21h22',
 province:'M3 20 8 4h8l5 16M9 20l2-5m1-4 1-4M3 13h18',
 map:'m2 6 6-3 8 3 6-3v16l-6 3-8-3-6 3Zm6-3v16m8-13v16'};
 return `<svg viewBox="0 0 24 24" aria-hidden="true" class="hoi-icon"><path d="${paths[kind]??paths.army}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>`;
}

export function iconHelp(){return `<details class="icon-guide"><summary aria-label="图标说明">${commandIcon('info')}</summary><div><b>指挥与状态图例</b>${[['production','生产','工厂分配、效率、产出与库存'],['construction','建设','建设和维修队列'],['division','编制','草案、正式模板与换编'],['army','部队','选择部队，查看所属军团'],['city','城市','城市与实际设施'],['settings','设置','本机显示和操作设置'],['play','继续','从暂停处继续共同时间'],['pause','暂停','在权威结算边界暂停，等候确认'],['save','保存','保存当前战役；失败会明确提示'],['xp','陆军经验','国家经验，与单位训练经验分开'],['rail','火车','可用车辆与运输需求'],['move','移动','点空地立即提交移动'],['attack','攻击','点已识别敌军提交攻击'],['support','支援','支援本场交战，不跟进占领'],['retreat','撤回','按真实路段耗时撤出，并非立即安全'],['hold','驻守','持续待命，不阻止敌方攻击'],['refit','整补','休整、等待合法补充'],['train','训练','压低战备，换取有上限的单位经验'],['people','人员','现有人员；不含装备战力'],['gear','装备','缺额来自实际编制'],['supply','补给','日常获得量与需求'],['fuel','燃料','真实携行燃料'],['rain','降雨','道路与越野耗时增加'],['mud','湿度','雨后逐步消退，铁路不套泥泞减速']].map(([k,n,d])=>`<p>${commandIcon(k!)}<b>${n}</b> ${d}</p>`).join('')}</div></details>`;}
