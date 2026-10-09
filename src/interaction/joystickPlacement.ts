export type Box={left:number;right:number;top:number;bottom:number;width:number;height:number};
export function joystickPlacement(width:number,height:number,hand:'left'|'right',obstacles:Box[],size=104){
 const gap=16,valid=obstacles.filter(r=>r.width>0&&r.height>0),preferred=hand==='left'?22:width-size-22;
 const xs=[preferred,hand==='left'?width-size-22:22,...valid.flatMap(r=>[r.left-size-gap,r.right+gap])];
 const ys=[height-size-105,...valid.map(r=>r.top-size-gap),80];
 const hits=(x:number,y:number)=>valid.some(r=>x<r.right+gap&&x+size>r.left-gap&&y<r.bottom+gap&&y+size>r.top-gap);
 for(const x of xs)for(const y of ys)if(x>=8&&x+size<=width-8&&y>=72&&y+size<=height-8&&!hits(x,y))return {x,y};
 return null; // No safe map area: hide temporarily, never cover a command.
}
