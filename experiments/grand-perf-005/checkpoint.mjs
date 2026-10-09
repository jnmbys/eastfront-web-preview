// Only committed history/ledger records are shared with a transient rollback
// checkpoint. Writers append records or replace the list; they never edit an old
// record. Mutable units, economy, posts, RNG and request state remain deep copied.
// Public save() and durable serialization still produce independent full saves.
export function checkpoint(c){
 const history=c.clock.history,ledger=c.econ.modern.ledger;
 let saved;try{c.clock.history=[];c.econ.modern.ledger=[];saved=c.save();}
 finally{c.clock.history=history;c.econ.modern.ledger=ledger;}
 saved.clock.history=history.slice();saved.econ.modern.ledger=ledger.slice();return saved;
}
