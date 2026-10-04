import '/chain-nav.mjs';
const $=id=>document.getElementById(id);
for(const b of document.querySelectorAll('[data-close]'))b.onclick=()=>$(b.dataset.close).close();
$('open-ledger').onclick=()=> $('ledger-dialog').showModal();
$('cost-detail').onclick=()=> $('ledger-dialog').showModal();
$('settings').onclick=()=> $('info-dialog').showModal();
$('open-diagnostics').onclick=()=>{$('info-dialog').showModal();$('diagnostics').open=true;$('diagnostics').scrollIntoView({block:'nearest'});};
const message=$('message'),strip=$('request-strip');
function status(){const t=message.textContent;strip.classList.toggle('attention',/失败|拒绝|未知|待确认|尚未刷新|锁定|停止|处理中|服务实例不符|无法|未完成/.test(t));}
new MutationObserver(status).observe(message,{subtree:true,childList:true,characterData:true});status();
window.addEventListener('industry-view',e=>{window.industryConfirmedView=e.detail;});
