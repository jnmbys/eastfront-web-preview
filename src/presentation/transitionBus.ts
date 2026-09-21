import type { ActionResult, GameState } from '../core-adapter/core.js';
import { derivePresentationEvents, type PresentationEvent } from './events.js';

type Observer=(events:readonly PresentationEvent[])=>void;
const observers=new WeakMap<object,Set<Observer>>();

/** The session is only an identity key. No state is retained by this bus. */
export function observePresentationTransitions(session:object,observer:Observer):()=>void {
  const set=observers.get(session)??new Set<Observer>();set.add(observer);observers.set(session,set);
  return ()=>{set.delete(observer);if(!set.size)observers.delete(session);};
}

/** Called after canonical state adoption. Presentation failures cannot reject an action. */
export function publishPresentationTransition(session:object,before:Readonly<GameState>,result:Readonly<ActionResult>):void {
  const set=observers.get(session);if(!set?.size||!result.accepted)return;
  try{
    const events=derivePresentationEvents(before,result);
    for(const observer of set){try{observer(events);}catch(error){console.error('Presentation observer failed',error);}}
  }catch(error){console.error('Presentation projection failed',error);}
}
