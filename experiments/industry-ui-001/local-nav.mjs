// Presentation/navigation only. No API calls, credentials, or request-state writes here.
document.getElementById('workbench-mode').addEventListener('change',event=>{
  if(['demo','records','personnel','forward'].includes(event.target.value))
    location.assign('/#mode='+encodeURIComponent(event.target.value));
});
const message=document.getElementById('message'),status=document.getElementById('live-status');
function label(){
  const text=message.textContent;
  status.textContent=text.includes('已确认提交')&&text.includes('账本尚未刷新')?'已提交、账本待刷新'
    :text.includes('已确认拒绝')&&text.includes('账本尚未刷新')?'已拒绝、账本待刷新'
    :text.includes('结果待确认')?'结果未知 · 核对原请求'
    :text.includes('处理中')?'处理中 · 正式账本未更新'
    :text.includes('旧账本版本')||text.includes('服务实例不符')?'拒绝旧响应 · 保留版本下限'
    :'本机操作 · 以已读取后端账本为准';
}
new MutationObserver(label).observe(message,{childList:true,characterData:true,subtree:true});label();

