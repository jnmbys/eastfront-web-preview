/** Completion is not cancellation; assets remain supplied by the actual network. */
export const completedConstruction=(queue:any[])=>queue.filter(q=>q.status==='DONE'&&!q.cancelled&&!q.satisfied);
