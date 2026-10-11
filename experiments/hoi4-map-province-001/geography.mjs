/** Public geographic gazetteer; abstract theatre names, never military intelligence. */
export function places(c,snapshot){
 const names=['西原','河岔','南渡','桦林','松岗','石桥','南岭','北桥','白桦站','河西','渡口镇','南湾','铁杉','东松','榆林','红岩','东岭','北岸','白河','谷口','南岗','东方城','分水岭'];
 const list=snapshot.cities.items.map((x,i)=>({id:x.id,cityId:x.id,name:names[i],hex:x.districts.find(d=>d.type==='MAIN').hex,importance:[0,1,2,21,22].includes(i)?2:1}));
 for(const [name,hex]of [['西泉','3,10'],['柳溪','9,0'],['林口','15,5'],['高地镇','16,14'],['东溪','31,-2'],['石岭','32,8'],['北林','30,-13'],['南原','23,20']])if(c.state.hexes[hex]&&c.state.hexes[hex].terrain!=='LAKE')list.push({id:'TOWN:'+hex,cityId:null,name,hex,importance:0});
 return list;
}
