import { state } from '../../ui/state.js';
import { escapeHtml, money, timeUntil, dateTime, progress, panel, badge, empty } from '../../ui/helpers.js';
import { bindActionForms, act } from './common.js';
import { api, getService } from '../../ui/api.js';
import { renderPlayerHud, showToast } from '../../ui/shell.js';

export function renderFinanceService(root,service,data,query) {
  if (service==='bank') return renderBank(root,data);
  if (service==='market') return renderMarket(root,data);
  if (service==='shop') return renderShop(root,data,query);
  if (service==='auction') return renderAuction(root,data);
  if (service==='offshore') return renderOffshore(root,data);
}

function renderBank(root,data) {
  const account=data.account||{}, investments=data.investments||[], tiers=data.tiers||[], ledger=data.ledger||[], security=data.security||{};
  root.innerHTML=`
    <section class="service-hero"><div><span class="eyebrow">RIFT NATIONAL BANK</span><h2>Banking</h2><p>Checking, savings, investment products and server-tracked account security.</p></div>
      <div class="service-kpis"><div><span>CHECKING</span><strong>${money(account.checking)}</strong></div><div><span>SAVINGS</span><strong>${money(account.savings)}</strong></div></div>
    </section>
    ${security.frozen?`<div class="warning-banner">ACCOUNT FROZEN ${security.frozenUntil?`· ${escapeHtml(timeUntil(security.frozenUntil))}`:''}</div>`:''}
    <div class="two-col">
      ${panel('Move Money',`
        <div class="bank-action-grid">
          ${moneyForm('deposit','Deposit cash','Cash → Checking')}
          ${moneyForm('withdraw','Withdraw cash','Checking → Cash')}
          ${moneyForm('to-savings','Move to savings','Checking → Savings')}
          ${moneyForm('from-savings','Withdraw savings','Savings → Checking')}
        </div>`,{eyebrow:'ACCOUNTS'})}
      ${panel('Account Overview',`
        <div class="stat-list">
          <div><span>Checking</span><strong>${money(account.checking)}</strong></div>
          <div><span>Savings</span><strong>${money(account.savings)}</strong></div>
          <div><span>Lifetime deposits</span><strong>${money(account.lifetime_deposits)}</strong></div>
          <div><span>Security</span><strong>${security.frozen?'FROZEN':'NORMAL'}</strong></div>
        </div>
        <a class="rc-button wide" href="#offshore" data-route="offshore">Offshore Accounts</a>`,{eyebrow:'BALANCES'})}
    </div>
    ${panel('Investments',`
      <div class="card-grid">${tiers.map(tier=>{
        const unlocked=Number(account.lifetime_deposits||0)>=Number(tier.unlockDeposit||0);
        return `<article class="product-card ${unlocked?'':'locked'}"><header><div><span class="eyebrow">${escapeHtml(tier.riskLabel)} RISK</span><h3>${escapeHtml(tier.name)}</h3></div>${badge(`${Math.round(Number(tier.targetRate||0)*100)}% target`,'info')}</header>
          <div class="stat-list compact"><div><span>Cap</span><strong>${money(tier.cap)}</strong></div><div><span>Term</span><strong>${escapeHtml(timeUntil(Date.now()+Number(tier.termSeconds||0)*1000))}</strong></div><div><span>Unlock deposits</span><strong>${money(tier.unlockDeposit)}</strong></div></div>
          <form data-service-form data-action="invest"><input type="hidden" name="tierId" value="${escapeHtml(tier.id)}"><input name="amount" type="number" min="1" max="${escapeHtml(tier.cap)}" placeholder="Amount" ${unlocked?'':'disabled'}><button class="rc-button" ${unlocked?'':'disabled'}>Invest</button></form>
        </article>`;
      }).join('')}</div>
      <div class="investment-list">${investments.map(inv=>{
        const tier=tiers.find(t=>t.id===inv.tier_id);
        const ready=Number(inv.matures_at)<=Date.now()&&!inv.claimed;
        return `<article class="list-card"><div><strong>${escapeHtml(tier?.name||inv.tier_id)}</strong><small>${money(inv.principal)} · ${(Number(inv.rate||0)*100).toFixed(2)}%</small></div><div><span>${inv.claimed?'CLAIMED':ready?'READY':escapeHtml(timeUntil(inv.matures_at))}</span>${ready?`<button class="rc-button small" data-service-action="claim-investment" data-investment-id="${escapeHtml(inv.id)}">Claim</button>`:''}</div></article>`;
      }).join('')||empty('No investments yet')}</div>`,{eyebrow:'INVESTMENT DESK'})}
    ${panel('Recent Ledger',ledger.length?`<div class="ledger-list">${ledger.map(row=>`<div class="ledger-row"><div><strong>${escapeHtml(String(row.kind||'transaction').toUpperCase())}</strong><small>${escapeHtml(dateTime(row.created_at))}</small></div><span>${money(row.amount)}${row.fee?` · fee ${money(row.fee)}`:''}</span><b>${money(row.balance_after)}</b></div>`).join('')}</div>`:empty('No transactions'),{eyebrow:'ACCOUNT HISTORY'})}`;
  bindActionForms(root,'bank',fresh=>renderBank(root,fresh));
}

function moneyForm(action,label,note) {
  return `<form class="compact-form" data-service-form data-action="${action}"><label><span>${escapeHtml(label)}</span><small>${escapeHtml(note)}</small><input name="amount" type="number" min="1" inputmode="numeric" placeholder="Amount"></label><button class="rc-button">${escapeHtml(label)}</button></form>`;
}

function renderMarket(root,data) {
  const positions=new Map((data.positions||[]).map(p=>[p.asset_id,p]));
  const event=data.modifiers?.event;
  root.innerHTML=`
    <section class="service-hero"><div><span class="eyebrow">RIFTCITY EXCHANGE</span><h2>City Market</h2><p>Fictional city assets with server-generated prices. Active events can change volatility.</p></div>${event?`<div class="event-card-mini"><span>ACTIVE EVENT</span><strong>${escapeHtml(event.name)}</strong><small>${escapeHtml(event.description||'')}</small></div>`:''}</section>
    <div class="market-grid">${(data.assets||[]).map(asset=>{
      const pos=positions.get(asset.id)||{};
      const qty=Number(pos.quantity)||0, avg=Number(pos.average_cost)||0;
      return `<article class="market-card"><header><div><span class="market-symbol">${escapeHtml(asset.symbol)}</span><h3>${escapeHtml(asset.name)}</h3></div><strong>${money(asset.price)}</strong></header>
        <div class="market-chart">${Array.from({length:18},(_,i)=>`<i style="height:${35+((i*17+asset.symbol.length*13)%60)}%"></i>`).join('')}</div>
        <div class="stat-list compact"><div><span>Owned</span><strong>${qty}</strong></div><div><span>Avg cost</span><strong>${money(avg)}</strong></div><div><span>Position value</span><strong>${money(qty*Number(asset.price||0))}</strong></div><div><span>Volatility</span><strong>${Math.round(Number(asset.volatility||0)*100)}%</strong></div></div>
        <div class="split-forms">
          ${tradeForm('buy',asset.id,'Buy')}
          ${tradeForm('sell',asset.id,'Sell')}
        </div>
      </article>`;
    }).join('')}</div>`;
  bindActionForms(root,'market',fresh=>renderMarket(root,fresh));
}

function tradeForm(action,assetId,label) {
  return `<form data-service-form data-action="${action}"><input type="hidden" name="assetId" value="${escapeHtml(assetId)}"><input name="quantity" type="number" min="1" value="1"><button class="rc-button ${action==='buy'?'primary':''}">${label}</button></form>`;
}

function renderShop(root,data,query) {
  const shops=data.shops||[];
  const requested=query?.get('shopId');
  const selected=data.selected||shops.find(s=>s.id===requested)||shops[0];
  root.innerHTML=`
    <section class="service-hero"><div><span class="eyebrow">RIFTCITY RETAIL</span><h2>Shops</h2><p>Legal storefronts use the same server inventory engine as the rest of the city.</p></div></section>
    <div class="tab-row">${shops.map(shop=>`<button class="${shop.id===selected?.id?'active':''}" data-shop-select="${escapeHtml(shop.id)}">${escapeHtml(shop.name)}</button>`).join('')}</div>
    ${selected?`<section class="shop-grid">${(selected.items||[]).map(item=>`<article class="shop-item"><div class="item-art item-art-${escapeHtml(item.category)}"><span>${escapeHtml(item.name.slice(0,2).toUpperCase())}</span></div><div class="shop-item-main"><span class="eyebrow">${escapeHtml(item.category)}</span><h3>${escapeHtml(item.name)}</h3><p>${escapeHtml(item.description)}</p><div class="tag-row">${(item.tags||[]).map(t=>`<span>${escapeHtml(t)}</span>`).join('')}</div></div><div class="shop-price"><span>BUY</span><strong>${money(item.price)}</strong><small>Sell ${money(item.buyback)}</small><div class="split-forms">${shopForm('buy',selected.id,item.id,'Buy')}${shopForm('sell',selected.id,item.id,'Sell')}</div></div></article>`).join('')}</section>`:empty('No shop selected')}`;
  root.querySelectorAll('[data-shop-select]').forEach(btn=>btn.addEventListener('click',()=>{
    const shop=shops.find(s=>s.id===btn.dataset.shopSelect);
    renderShop(root,{...data,selected:shop},new URLSearchParams(`shopId=${encodeURIComponent(shop.id)}`));
  }));
  bindActionForms(root,'shop',async()=>{
    const fresh=await getService('shop');
    if (fresh.ok) renderShop(root,{...fresh,selected:fresh.shops?.find(s=>s.id===selected.id)},new URLSearchParams(`shopId=${encodeURIComponent(selected.id)}`));
  });
}

function shopForm(action,shopId,itemId,label) {
  return `<form data-service-form data-action="${action}"><input type="hidden" name="shopId" value="${escapeHtml(shopId)}"><input type="hidden" name="itemId" value="${escapeHtml(itemId)}"><input name="quantity" type="number" min="1" max="50" value="1"><button class="rc-button ${action==='buy'?'primary':''}">${label}</button></form>`;
}

async function renderAuction(root,data) {
  let inventory=state.inventory;
  if (!inventory) {
    const inv=await api('/api/inventory');
    if (inv.ok) { inventory=inv; state.inventory=inv; }
  }
  const tradeable=(inventory?.inventory||[]).filter(i=>i.tradeable&&Number(i.quantity)>0);
  root.innerHTML=`
    <section class="service-hero"><div><span class="eyebrow">THE EXCHANGE</span><h2>Black Market</h2><p>Player-run item listings. Items are reserved server-side when listed or purchased.</p></div><div class="service-kpis"><div><span>ACTIVE</span><strong>${(data.listings||[]).length}</strong></div><div><span>YOUR LISTINGS</span><strong>${(data.mine||[]).length}</strong></div></div></section>
    ${panel('Create Listing',tradeable.length?`<form class="listing-form" data-service-form data-action="list"><select name="itemId">${tradeable.map(i=>`<option value="${escapeHtml(i.id)}">${escapeHtml(i.name)} · x${i.quantity}</option>`).join('')}</select><input name="quantity" type="number" min="1" value="1" placeholder="Quantity"><input name="unitPrice" type="number" min="1" placeholder="Unit price"><button class="rc-button primary">Create listing</button></form>`:empty('No tradeable items to list'),{eyebrow:'SELL'})}
    ${panel('Player Listings',`<div class="auction-list">${(data.listings||[]).map(row=>`<article class="auction-row"><div class="item-art small item-art-${escapeHtml(row.item?.category||'item')}"><span>${escapeHtml((row.item?.name||'IT').slice(0,2).toUpperCase())}</span></div><div><strong>${escapeHtml(row.item?.name||row.item_id)}</strong><small>x${row.quantity} · ${money(row.unit_price)} each</small></div><div><strong>${money(Number(row.quantity)*Number(row.unit_price))}</strong>${row.seller_user_id===state.user?.id?`<button class="rc-button small" data-service-action="cancel" data-listing-id="${escapeHtml(row.id)}">Cancel</button>`:`<button class="rc-button primary small" data-service-action="buy" data-listing-id="${escapeHtml(row.id)}">Buy</button>`}</div></article>`).join('')||empty('No active listings')}</div>`,{eyebrow:'PLAYER EXCHANGE'})}`;
  bindActionForms(root,'auction',fresh=>renderAuction(root,fresh));
}

function renderOffshore(root,data) {
  const current=data.currentRegion||{};
  root.innerHTML=`
    <section class="service-hero"><div><span class="eyebrow">OFFSHORE NETWORK</span><h2>International Banking</h2><p>Offshore transfers are only available while physically present in a supported destination.</p></div><div class="service-kpis"><div><span>REGION</span><strong>${escapeHtml(current.name||'RiftCity')}</strong></div><div><span>ACCESS</span><strong>${data.available?'OPEN':'LOCKED'}</strong></div></div></section>
    ${!data.available?`<div class="warning-banner">Travel to Solara or Haven Isle to access offshore banking.</div>`:''}
    <div class="card-grid">${(data.accounts||[]).map(account=>`<article class="product-card"><span class="eyebrow">${escapeHtml(account.region_id)}</span><h3>${money(account.balance)}</h3><p>Lifetime deposits: ${money(account.lifetime_deposits)}</p></article>`).join('')||empty('No offshore accounts yet')}</div>
    ${data.available?panel('Transfer Funds',`<div class="bank-action-grid">${offshoreForm('deposit','Deposit offshore')}${offshoreForm('withdraw','Withdraw to checking')}</div>`,{eyebrow:'CURRENT REGION'}):''}`;
  bindActionForms(root,'offshore',fresh=>renderOffshore(root,fresh));
}

function offshoreForm(action,label) {
  return `<form class="compact-form" data-service-form data-action="${action}"><label><span>${escapeHtml(label)}</span><small>${action==='deposit'?'3% routing fee':'4% return fee'}</small><input name="amount" type="number" min="1" placeholder="Amount"></label><button class="rc-button">${escapeHtml(label)}</button></form>`;
}
