// Permanent presentation identities; no randomization or personality values.
const identities:Record<string,string>={'雷纳·沃尔特':'walter','米哈伊尔·罗文':'roven','安东·维尔':'veil'};
export function officerPortrait(name:string){const id=identities[name];return id?`<span class="officer-portrait portrait-${id}" data-officer-id="officer:${id}" role="img" aria-label="${name}原创虚构肖像"></span>`:'<span class="ui-badge">◇</span>';}
