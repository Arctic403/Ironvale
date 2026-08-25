import { postService, getService } from '../../ui/api.js';
import { setPlayer } from '../../ui/state.js';
import { renderPlayerHud, showToast, refreshEffects } from '../../ui/shell.js';

export async function act(service, body, {refresh=true}={}) {
  const result=await postService(service,body);
  if (!result.ok) {
    showToast(result.error||'Action failed',true);
    return {result,data:null};
  }
  if (result.player) { setPlayer(result.player); renderPlayerHud(result.player); }
  showToast(result.message||'Action complete.');
  refreshEffects();
  const data=refresh?await getService(service):null;
  return {result,data};
}

export function bindActionForms(root, service, rerender) {
  root.querySelectorAll('form[data-service-form]').forEach(form=>form.addEventListener('submit',async event=>{
    event.preventDefault();
    const body={action:form.dataset.action};
    const fd=new FormData(form);
    for (const [k,v] of fd.entries()) body[k]=v;
    const {data}=await act(service,body);
    if (data?.ok) rerender(data);
  }));
  root.querySelectorAll('[data-service-action]').forEach(button=>button.addEventListener('click',async()=>{
    const body={action:button.dataset.serviceAction};
    for (const [k,v] of Object.entries(button.dataset)) {
      if (k==='serviceAction') continue;
      body[k]=v;
    }
    const {data}=await act(service,body);
    if (data?.ok) rerender(data);
  }));
}
