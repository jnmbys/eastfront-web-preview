// Permanent presentation identities; no randomization or personality values.
const identities:Record<string,string>={'雷纳·沃尔特':'walter','米哈伊尔·罗文':'roven','安东·维尔':'veil'};
export function officerPortrait(name:string){const id=identities[name];return id?`<img class="officer-portrait" data-officer-id="officer:${id}" src="/assets/playable/officers/${id}.svg" alt="${name}肖像" width="40" height="50">`:'<span class="ui-badge">◇</span>';}
