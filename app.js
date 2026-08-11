const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const money=n=>"Rs "+new Intl.NumberFormat("en-PK",{maximumFractionDigits:2}).format(Number(n||0));
const num=n=>new Intl.NumberFormat("en-PK",{maximumFractionDigits:3}).format(Number(n||0));
const today=()=>new Date().toISOString().slice(0,10);
const monthNow=()=>today().slice(0,7);
const id=()=>crypto.randomUUID?crypto.randomUUID():Date.now()+"-"+Math.random();
let db=JSON.parse(localStorage.getItem("suh-full-db")||'{"customers":[],"products":[],"salesmen":[],"invoices":[],"payments":[],"returns":[],"targets":[],"petrolExpenses":[]}');
let lines=[];

// Keep old saved records compatible with the simplified final masters.
db.customers=(db.customers||[]).map(c=>({...c,sssRate:Number(c.sssRate??c.sssPrice??0),atlasRate:Number(c.atlasRate??c.atlasPrice??0),profitLoss:c.profitLoss||"",approvalExpiry:c.approvalExpiry||""}));
db.products=(db.products||[]).map(p=>({...p,tpPrice:Number(p.tpPrice??p.rate??0),toScheme:Number(p.toScheme||0),piecesPerCarton:Number(p.piecesPerCarton||0),cartonWeight:Number(p.cartonWeight||0),weightUnit:p.weightUnit||"kg",priceBasis:"piece",rate:Number(p.rate??p.tpPrice??0),priceHistory:Array.isArray(p.priceHistory)?p.priceHistory:[],schemeHistory:Array.isArray(p.schemeHistory)?p.schemeHistory:[]}));
db.petrolExpenses=Array.isArray(db.petrolExpenses)?db.petrolExpenses:[];

function effectiveProductRate(p){return Math.max(0,Number(p?.tpPrice||0)-Number(p?.toScheme||0))}
function customerProfitLoss(c){
 const s=Number(c?.sssRate||0),a=Number(c?.atlasRate||0);
 if(!s&&!a)return {type:c?.profitLoss||"",amount:0,signed:0};
 const signed=s-a,type=signed>0?"profit":signed<0?"loss":c?.profitLoss||"";
 return {type,amount:Math.abs(signed),signed};
}
function weightLabel(unit){return unit==="litre"?"L":"kg"}
function toTonnage(cartons,p){return Number(cartons||0)*Number(p?.cartonWeight||0)/1000}

function toast(msg){const t=$("#toast");t.textContent=msg;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),2500)}
function autoSnapshot(){
 try{
  const key="suh-auto-backups",stamp=today(),raw=JSON.stringify(db);
  let arr=JSON.parse(localStorage.getItem(key)||"[]");
  const item={date:stamp,savedAt:new Date().toISOString(),data:raw};
  const i=arr.findIndex(x=>x.date===stamp); if(i>=0)arr[i]=item; else arr.push(item);
  arr=arr.slice(-7); localStorage.setItem(key,JSON.stringify(arr));
 }catch(e){}
}
function persist(){localStorage.setItem("suh-full-db",JSON.stringify(db));autoSnapshot();renderAll()}
function cName(code){const c=db.customers.find(x=>x.code===code);return c?c.name:""}
function pName(code){const p=db.products.find(x=>x.code===code);return p?p.name:""}
function smName(code){const s=db.salesmen.find(x=>x.code===code);return s?s.name:"Unassigned"}
function returnedFor(invoiceId,productCode){return db.returns.filter(r=>r.invoiceId===invoiceId&&r.productCode===productCode).reduce((a,r)=>a+r.cartons,0)}
function invoiceNet(inv){
 if(inv.status==="Cancelled") return {amount:0,tonnage:0,cartons:0};
 let amount=inv.total,tonnage=inv.tonnage,cartons=inv.cartons;
 db.returns.filter(r=>r.invoiceId===inv.id).forEach(r=>{amount-=r.amount;tonnage-=r.tonnage;cartons-=r.cartons});
 return {amount,tonnage,cartons};
}
function outstanding(code){
 const c=db.customers.find(x=>x.code===code); if(!c)return 0;
 const sales=db.invoices.filter(i=>i.customerCode===code).reduce((a,i)=>a+invoiceNet(i).amount,0);
 const pays=db.payments.filter(p=>p.customerCode===code).reduce((a,p)=>a+p.amount,0);
 return Number(c.opening||0)+sales-pays;
}
function monthlyMetrics(month,filter={}){
 let invs=db.invoices.filter(i=>i.date.startsWith(month)&&i.status!=="Cancelled");
 if(filter.customer) invs=invs.filter(i=>i.customerCode===filter.customer);
 if(filter.salesman) invs=invs.filter(i=>(db.customers.find(c=>c.code===i.customerCode)||{}).salesman===filter.salesman);
 let amount=0,tonnage=0;
 invs.forEach(i=>{const n=invoiceNet(i);amount+=n.amount;tonnage+=n.tonnage});
 return {amount,tonnage};
}
function esc(s){return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}

let currentTab="dashboard";
window.switchTab=(name,fromHistory=false)=>{
 if(!document.getElementById(name))name="dashboard";
 $$(".tabs button").forEach(b=>b.classList.toggle("active",b.dataset.tab===name));
 $$(".tab").forEach(t=>t.classList.toggle("active",t.id===name));
 if(!fromHistory&&name!==currentTab)history.pushState({tab:name},"","#"+name);
 currentTab=name;
 window.scrollTo({top:0,behavior:"smooth"});
};
$$(".tabs button").forEach(b=>b.onclick=()=>switchTab(b.dataset.tab));
window.addEventListener("popstate",e=>switchTab(e.state?.tab||location.hash.slice(1)||"dashboard",true));
$("#backBtn").onclick=()=>{if(history.length>1)history.back();else switchTab("dashboard")};
history.replaceState({tab:location.hash.slice(1)||"dashboard"},"",location.hash||"#dashboard");

function selectOptions(){
 const cust='<option value="">Select customer</option>'+db.customers.map(c=>`<option value="${esc(c.code)}">${esc(c.code)} — ${esc(c.name)}</option>`).join("");
 ["#invCustomer","#payCustomer"].forEach(s=>$(s).innerHTML=cust);
 $("#rCustomer").innerHTML='<option value="">All Customers</option>'+cust.replace('<option value="">Select customer</option>','');
 $("#lineProduct").innerHTML='<option value="">Select product</option>'+db.products.map(p=>`<option value="${esc(p.code)}">${esc(p.code)} — ${esc(p.name)}</option>`).join("");
 $("#rProduct").innerHTML='<option value="">All Products</option>'+db.products.map(p=>`<option value="${esc(p.code)}">${esc(p.code)} — ${esc(p.name)}</option>`).join("");
 $("#rSalesman").innerHTML='<option value="">All Salesmen</option>'+db.salesmen.map(s=>`<option value="${esc(s.code)}">${esc(s.code)} — ${esc(s.name)}</option>`).join("");
 $("#retInvoice").innerHTML='<option value="">Select invoice</option>'+db.invoices.filter(i=>i.status!=="Cancelled").slice().reverse().map(i=>`<option value="${i.id}">${esc(i.invoiceNo)} — ${esc(i.customerCode)} — ${i.date}</option>`).join("");
 if($("#exportInvoice")){const current=$("#exportInvoice").value;$("#exportInvoice").innerHTML='<option value="">Select saved invoice</option>'+db.invoices.filter(i=>i.status!=="Cancelled").slice().reverse().map(i=>`<option value="${i.id}">${esc(i.invoiceNo)} — ${esc(i.customerCode)} — ${esc(cName(i.customerCode))}</option>`).join("");if(current&&db.invoices.some(i=>i.id===current))$("#exportInvoice").value=current;}
 updateTargetEntity();
}

function renderDashboard(){
 const td=today(),mo=monthNow();
 const todayInv=db.invoices.filter(i=>i.date===td), monthInv=db.invoices.filter(i=>i.date.startsWith(mo));
 const sum=(arr,k)=>arr.reduce((a,i)=>a+invoiceNet(i)[k],0);
 $("#dashDate").textContent=new Date().toLocaleDateString("en-PK",{weekday:"long",day:"numeric",month:"long",year:"numeric"});
 $("#todaySales").textContent=money(sum(todayInv,"amount")); $("#todayTon").textContent=num(sum(todayInv,"tonnage"));
 $("#monthSales").textContent=money(sum(monthInv,"amount")); $("#monthTon").textContent=num(sum(monthInv,"tonnage"));
 $("#totalOutstanding").textContent=money(db.customers.reduce((a,c)=>a+outstanding(c.code),0));
 $("#monthCollection").textContent=money(db.payments.filter(p=>p.date.startsWith(mo)).reduce((a,p)=>a+p.amount,0));
 const counts={Pending:0,Dispatched:0,Delivered:0,Cancelled:0}; monthInv.forEach(i=>counts[i.status]=(counts[i.status]||0)+1);
 $("#deliverySummary").innerHTML=Object.entries(counts).map(([k,v])=>`<div class="statline"><span class="badge ${k}">${k}</span><b>${v}</b></div>`).join("");
 const overall=db.targets.find(t=>t.month===mo&&t.type==="company");
 const met=monthlyMetrics(mo);
 const amountTarget=Number(overall?.amount||0),tonTarget=Number(overall?.tonnage||0);
 const amountPct=amountTarget?met.amount/amountTarget*100:0,tonPct=tonTarget?met.tonnage/tonTarget*100:0;
 $("#targetAmountDash").textContent=money(amountTarget);
 $("#achievementAmountDash").textContent=money(met.amount);
 $("#achievementAmountPct").textContent=amountPct.toFixed(1)+"%";
 $("#targetTonDash").textContent=num(tonTarget)+" tons";
 $("#achievementTonDash").textContent=num(met.tonnage)+" tons";
 $("#achievementTonPct").textContent=tonPct.toFixed(1)+"%";
 $("#dashTargets").innerHTML=overall?targetProgressHtml("Overall Company",overall,met):'<p class="muted">Set this month’s amount and tonnage target from the Targets page.</p>';
 const byCust={}; monthInv.forEach(i=>{const n=invoiceNet(i);byCust[i.customerCode]??={amount:0,tonnage:0};byCust[i.customerCode].amount+=n.amount;byCust[i.customerCode].tonnage+=n.tonnage});
 $("#topCustomers").innerHTML=Object.entries(byCust).sort((a,b)=>b[1].amount-a[1].amount).slice(0,5).map(([c,m])=>`<div class="statline"><span><b>${esc(cName(c))}</b><div class="muted">${esc(c)}</div></span><span class="right">${money(m.amount)}<div class="muted">${num(m.tonnage)} tons</div></span></div>`).join("")||'<p class="muted">No sales this month.</p>';
 const byProd={}; monthInv.forEach(i=>i.lines.forEach(l=>{let rc=returnedFor(i.id,l.code),ratio=Math.max(0,(l.cartons-rc)/l.cartons);byProd[l.code]??={amount:0,tonnage:0};byProd[l.code].amount+=l.amount*ratio;byProd[l.code].tonnage+=l.tonnage*ratio}));
 $("#topProducts").innerHTML=Object.entries(byProd).sort((a,b)=>b[1].amount-a[1].amount).slice(0,5).map(([p,m])=>`<div class="statline"><span><b>${esc(pName(p))}</b><div class="muted">${esc(p)}</div></span><span class="right">${money(m.amount)}<div class="muted">${num(m.tonnage)} tons</div></span></div>`).join("")||'<p class="muted">No sales this month.</p>';
 $("#recentInvoices").innerHTML=db.invoices.slice(-8).reverse().map(i=>{const n=invoiceNet(i);return `<div class="list-row"><div><b>${esc(i.invoiceNo)}</b><div class="muted">${i.date} • ${esc(i.customerCode)} — ${esc(cName(i.customerCode))}</div></div><div class="right"><span class="badge ${i.status}">${i.status}</span><div>${money(n.amount)}</div><div class="muted">${num(n.tonnage)} tons</div></div></div>`}).join("")||'<p class="muted">No invoices yet.</p>';
}
function targetProgressHtml(title,t,m){
 const tp=t.tonnage?Math.min(100,m.tonnage/t.tonnage*100):0, ap=t.amount?Math.min(100,m.amount/t.amount*100):0;
 return `<b>${esc(title)}</b>
 <div class="progress-wrap"><div class="progress-head"><span>Tonnage: ${num(m.tonnage)} / ${num(t.tonnage)}</span><b>${tp.toFixed(1)}%</b></div><div class="progress"><i style="width:${tp}%"></i></div></div>
 <div class="progress-wrap"><div class="progress-head"><span>Amount: ${money(m.amount)} / ${money(t.amount)}</span><b>${ap.toFixed(1)}%</b></div><div class="progress"><i style="width:${ap}%"></i></div></div>`;
}

function renderCustomers(){
 const q=$("#customerSearch").value.toLowerCase();
 $("#customerList").innerHTML=db.customers.filter(c=>(c.code+" "+c.name).toLowerCase().includes(q)).map(c=>{const pl=customerProfitLoss(c),plText=pl.type?`${pl.type==="profit"?"↑ Profit":"↓ Loss"}: ${money(pl.amount)}`:"Rate difference not set";return `<div class="list-row"><div><b>${esc(c.code)} — ${esc(c.name)}</b><div class="muted">${esc(c.address||"")}</div><div class="muted">SSS ${money(c.sssRate||0)}/pc • Atlas ${money(c.atlasRate||0)}/pc • ${plText}${c.approvalExpiry?` • Approval: ${esc(c.approvalExpiry)}`:""}</div></div><div class="right"><b>${money(outstanding(c.code))}</b><div class="muted">Outstanding</div><div class="mini-actions"><button onclick="editCustomer('${esc(c.code)}')">Edit</button></div></div></div>`}).join("")||'<p class="muted">No customers.</p>';
}
function renderProducts(){
 const q=$("#productSearch").value.toLowerCase();
 $("#productList").innerHTML=db.products.filter(p=>(p.code+" "+p.name).toLowerCase().includes(q)).map(p=>`<div class="list-row"><div><b>${esc(p.code)} — ${esc(p.name)}</b><div class="muted">${num(p.piecesPerCarton||0)} pcs/carton • ${num(p.cartonWeight)} ${weightLabel(p.weightUnit)}/carton</div></div><div class="right"><b>TP ${money(p.tpPrice||0)}/pc</b><div class="muted">TO Scheme: ${money(p.toScheme||0)} • Net rate: ${money(effectiveProductRate(p))}/pc</div><div class="mini-actions"><button onclick="showProductHistory('${esc(p.code)}')">History</button><button onclick="editProduct('${esc(p.code)}')">Edit</button></div></div></div>`).join("")||'<p class="muted">No products.</p>';
}
window.showProductHistory=code=>{
 const p=db.products.find(x=>x.code===code); if(!p)return;
 const fmt=(arr,key)=>arr.length?arr.slice().reverse().map(h=>`<div class="history-row"><b>${money(h[key]||0)}</b><div class="muted">${h.from||"Earlier"} → ${h.to||"Current"}</div></div>`).join(""):'<div class="muted">No changes recorded yet.</div>';
 $("#productHistory").innerHTML=`<div class="history-box"><div class="section-head"><h3>${esc(p.code)} — ${esc(p.name)} History</h3><button class="btn ghost" onclick="document.querySelector('#productHistory').innerHTML=''">Close</button></div><div class="history-grid"><div><h4>TP Price History</h4>${fmt(p.priceHistory||[],"tpPrice")}</div><div><h4>TO Scheme History</h4>${fmt(p.schemeHistory||[],"toScheme")}</div></div></div>`;
};
function renderSalesmen(){
 $("#salesmanList").innerHTML=db.salesmen.map(s=>{const customers=db.customers.filter(c=>c.salesman===s.code).length;const m=monthlyMetrics(monthNow(),{salesman:s.code});return `<div class="list-row"><div><b>${esc(s.code)} — ${esc(s.name)}</b><div class="muted">${esc(s.phone||"")} • ${customers} customers</div></div><div class="right">${money(m.amount)}<div class="muted">${num(m.tonnage)} tons this month</div></div></div>`}).join("")||'<p class="muted">No salesmen.</p>';
}
function renderPayments(){
 $("#paymentList").innerHTML=db.payments.slice(-20).reverse().map(p=>`<div class="list-row"><div><b>${esc(p.customerCode)} — ${esc(cName(p.customerCode))}</b><div class="muted">${p.date} • ${esc(p.method)} • ${esc(p.ref||p.note||"")}</div></div><b>${money(p.amount)}</b></div>`).join("")||'<p class="muted">No payments.</p>';
}
function renderReturns(){
 $("#returnList").innerHTML=db.returns.slice(-20).reverse().map(r=>`<div class="list-row"><div><b>${esc(r.invoiceNo)} • ${esc(r.productCode)} — ${esc(pName(r.productCode))}</b><div class="muted">${r.date} • ${r.cartons} cartons • ${esc(r.reason||"")}</div></div><div class="right">${money(r.amount)}<div class="muted">${num(r.tonnage)} tons</div></div></div>`).join("")||'<p class="muted">No returns.</p>';
}
function renderTargets(){
 const mo=$("#targetMonth").value||monthNow();
 $("#targetList").innerHTML=db.targets.filter(t=>t.month===mo).map(t=>{let title="Overall Company",filter={};if(t.type==="customer"){title=t.entity+" — "+cName(t.entity);filter.customer=t.entity}else if(t.type==="salesman"){title=t.entity+" — "+smName(t.entity);filter.salesman=t.entity}return `<div class="panel">${targetProgressHtml(title,t,monthlyMetrics(mo,filter))}</div>`}).join("")||'<p class="muted">No targets saved for selected month.</p>';
}
function renderLines(){
 $("#invoiceLines").innerHTML=lines.map((l,i)=>`<tr><td>${esc(l.code)}</td><td>${esc(l.name)}</td><td>${esc(weightLabel(l.weightUnit))}</td><td>${l.cartons}</td><td>${num(l.piecesPerCarton||0)}</td><td>${num(l.pieces||0)}</td><td>${num(l.cartonWeight)}</td><td>${num(l.totalWeight??l.kg)}</td><td>${num(l.tonnage)}</td><td>Per Piece</td><td>${money(l.rate)}</td><td>${money(l.amount)}</td><td><button class="remove" onclick="removeLine(${i})">×</button></td></tr>`).join("");
 $("#invCartons").textContent=lines.reduce((a,l)=>a+l.cartons,0);$("#invTon").textContent=num(lines.reduce((a,l)=>a+l.tonnage,0));$("#invTotal").textContent=money(lines.reduce((a,l)=>a+l.amount,0));
}
window.removeLine=i=>{lines.splice(i,1);renderLines()};

function renderAll(){selectOptions();renderDashboard();renderCustomers();renderProducts();renderSalesmen();renderPayments();renderReturns();renderTargets();renderLines();renderPetrol();renderBackupStatus();}

$("#customerSearch").oninput=renderCustomers;$("#productSearch").oninput=renderProducts;
$("#saveSalesman").onclick=()=>{const code=$("#smCode").value.trim(),name=$("#smName").value.trim();if(!code||!name)return toast("Salesman code and name required");if(db.salesmen.some(s=>s.code===code))return toast("Salesman code already exists");db.salesmen.push({code,name,phone:$("#smPhone").value.trim()});$("#smCode").value=$("#smName").value=$("#smPhone").value="";persist();toast("Salesman saved")};

function updateCustomerRatePreview(){
 const s=Number($("#custSssRate").value||0),a=Number($("#custAtlasRate").value||0),manual=$("#custProfitLoss").value;
 let signed=s-a,type=signed>0?"profit":signed<0?"loss":manual,amount=Math.abs(signed);
 if(manual&&amount===0)type=manual;
 $("#custProfitLossAmount").value=amount||"";
 $("#customerRatePreview").textContent=(s||a)?`SSS rate − Atlas rate = ${money(signed)} • ${type==="profit"?"↑ Profit":type==="loss"?"↓ Loss":"No difference"}`:"";
}
["#custSssRate","#custAtlasRate"].forEach(s=>$(s).oninput=updateCustomerRatePreview);$("#custProfitLoss").onchange=updateCustomerRatePreview;
$("#saveCustomer").onclick=()=>{const old=$("#custEdit").value,code=$("#custCode").value.trim(),name=$("#custName").value.trim();if(!code||!name)return toast("SSS code and customer name required");if(!old&&db.customers.some(c=>c.code===code))return toast("SSS code already exists");const sssRate=Number($("#custSssRate").value||0),atlasRate=Number($("#custAtlasRate").value||0),signed=sssRate-atlasRate;const obj={code,name,address:$("#custAddress").value.trim(),sssRate,atlasRate,profitLoss:signed>0?"profit":signed<0?"loss":$("#custProfitLoss").value,profitLossAmount:Math.abs(signed),approvalExpiry:$("#custApprovalExpiry").value||"",opening:Number($("#custOpening").value||0)};if(old){const i=db.customers.findIndex(c=>c.code===old);db.customers[i]={...db.customers[i],...obj};db.invoices.forEach(x=>{if(x.customerCode===old)x.customerCode=code});db.payments.forEach(x=>{if(x.customerCode===old)x.customerCode=code})}else db.customers.push(obj);clearCustomerForm();persist();toast("Customer saved")};
function clearCustomerForm(){["#custEdit","#custCode","#custName","#custAddress","#custSssRate","#custAtlasRate","#custProfitLossAmount","#custApprovalExpiry","#custOpening"].forEach(s=>$(s).value="");$("#custProfitLoss").value="";$("#customerRatePreview").textContent="";$("#cancelCustomerEdit").classList.add("hidden")}
window.editCustomer=code=>{const c=db.customers.find(x=>x.code===code);if(!c)return;$("#custEdit").value=c.code;$("#custCode").value=c.code;$("#custName").value=c.name;$("#custAddress").value=c.address||"";$("#custSssRate").value=c.sssRate||"";$("#custAtlasRate").value=c.atlasRate||"";$("#custProfitLoss").value=c.profitLoss||"";$("#custApprovalExpiry").value=c.approvalExpiry||"";$("#custOpening").value=c.opening||0;updateCustomerRatePreview();$("#cancelCustomerEdit").classList.remove("hidden");switchTab("customers")};$("#cancelCustomerEdit").onclick=clearCustomerForm;

function updateProductPricePreview(){const tp=Number($("#prodTpPrice").value||0),scheme=Number($("#prodToScheme").value||0);$("#productPricePreview").textContent=tp?`TP incl. GST ${money(tp)}/pc − TO Scheme ${money(scheme)} = Net invoice rate ${money(Math.max(0,tp-scheme))}/pc`:""}
["#prodTpPrice","#prodToScheme"].forEach(s=>$(s).oninput=updateProductPricePreview);
function dayBefore(date){const d=new Date(date+"T12:00:00");d.setDate(d.getDate()-1);return d.toISOString().slice(0,10)}
function updateValueHistory(arr,key,oldValue,newValue,effective){
 arr=Array.isArray(arr)?arr.slice():[]; oldValue=Number(oldValue||0); newValue=Number(newValue||0);
 if(oldValue===newValue)return arr;
 const last=arr[arr.length-1];
 if(last&&!last.to)last.to=dayBefore(effective); else arr.push({from:"",to:dayBefore(effective),[key]:oldValue});
 arr.push({from:effective,to:"",[key]:newValue}); return arr;
}
function saveProductObject(prev,base,effective){
 if(!prev)return {...base,createdAt:effective,priceHistory:[{from:effective,to:"",tpPrice:Number(base.tpPrice||0)}],schemeHistory:[{from:effective,to:"",toScheme:Number(base.toScheme||0)}]};
 return {...prev,...base,priceHistory:updateValueHistory(prev.priceHistory,"tpPrice",prev.tpPrice,base.tpPrice,effective),schemeHistory:updateValueHistory(prev.schemeHistory,"toScheme",prev.toScheme,base.toScheme,effective)};
}
$("#saveProduct").onclick=()=>{const old=$("#prodEdit").value,code=$("#prodCode").value.trim(),name=$("#prodName").value.trim(),tpPrice=Number($("#prodTpPrice").value||0),toScheme=Number($("#prodToScheme").value||0),effective=$("#prodEffectiveFrom").value||today();if(!code||!name)return toast("Product code and SKU name required");if(!old&&db.products.some(p=>p.code===code))return toast("Product code already exists");const base={code,name,cartonWeight:Number($("#prodWeight").value||0),weightUnit:$("#prodWeightUnit").value,piecesPerCarton:Number($("#prodPieces").value||0),priceBasis:"piece",rate:Math.max(0,tpPrice-toScheme),tpPrice,toScheme};if(old){const i=db.products.findIndex(p=>p.code===old),prev=db.products[i];db.products[i]=saveProductObject(prev,base,effective)}else db.products.push(saveProductObject(null,base,effective));clearProductForm();persist();toast("Product saved")};
function clearProductForm(){["#prodEdit","#prodCode","#prodName","#prodWeight","#prodPieces","#prodTpPrice","#prodToScheme"].forEach(s=>$(s).value="");$("#prodWeightUnit").value="kg";$("#prodEffectiveFrom").value=today();$("#productPricePreview").textContent="";$("#cancelProductEdit").classList.add("hidden")}
window.editProduct=code=>{const p=db.products.find(x=>x.code===code);if(!p)return;$("#prodEdit").value=p.code;$("#prodCode").value=p.code;$("#prodName").value=p.name;$("#prodWeight").value=p.cartonWeight;$("#prodWeightUnit").value=p.weightUnit||"kg";$("#prodPieces").value=p.piecesPerCarton||0;$("#prodTpPrice").value=p.tpPrice||"";$("#prodToScheme").value=p.toScheme||"";$("#prodEffectiveFrom").value=today();updateProductPricePreview();$("#cancelProductEdit").classList.remove("hidden");switchTab("products")};$("#cancelProductEdit").onclick=clearProductForm;

$("#lineProduct").onchange=()=>{const p=db.products.find(x=>x.code===$("#lineProduct").value);$("#lineRate").value=p?effectiveProductRate(p):"";previewLine()};
$("#lineCartons").oninput=previewLine;$("#lineRate").oninput=previewLine;
function previewLine(){const p=db.products.find(x=>x.code===$("#lineProduct").value),c=Number($("#lineCartons").value||0),r=Number($("#lineRate").value||0);if(!p||!c){$("#linePreview").textContent="";return}const totalWeight=c*p.cartonWeight,t=toTonnage(c,p),pieces=c*Number(p.piecesPerCarton||0),amount=pieces*r;$("#linePreview").textContent=`${c} cartons × ${p.piecesPerCarton||0} pcs = ${num(pieces)} pieces • ${num(totalWeight)} ${weightLabel(p.weightUnit)} • ${num(t)} tons • Amount ${money(amount)}`}
$("#addLine").onclick=()=>{const p=db.products.find(x=>x.code===$("#lineProduct").value),cartons=Number($("#lineCartons").value||0),rate=Number($("#lineRate").value||0);if(!p||cartons<=0)return toast("Select product and enter cartons");const totalWeight=cartons*p.cartonWeight,tonnage=toTonnage(cartons,p),pieces=cartons*Number(p.piecesPerCarton||0),amount=pieces*rate;lines.push({code:p.code,name:p.name,packing:p.weightUnit||"kg",weightUnit:p.weightUnit||"kg",cartons,piecesPerCarton:Number(p.piecesPerCarton||0),pieces,cartonWeight:p.cartonWeight,totalWeight,kg:totalWeight,tonnage,priceBasis:"piece",rate,amount,tpPrice:Number(p.tpPrice||0),toScheme:Number(p.toScheme||0)});$("#lineCartons").value="";previewLine();renderLines()};
$("#invCustomer").onchange=()=>{$("#customerOutstandingHint").textContent=$("#invCustomer").value?`Current outstanding: ${money(outstanding($("#invCustomer").value))}`:""};
$("#saveInvoice").onclick=()=>{const invoiceNo=$("#invNo").value.trim(),date=$("#invDate").value,customerCode=$("#invCustomer").value,status=$("#invStatus").value;if(!invoiceNo||!date||!customerCode||!lines.length)return toast("Invoice no, date, customer and SKU lines required");if(db.invoices.some(i=>i.invoiceNo===invoiceNo)&&!confirm("Invoice number already exists. Save anyway?"))return;const newInv={id:id(),invoiceNo,date,customerCode,status,vehicle:$("#invVehicle").value.trim(),driver:$("#invDriver").value.trim(),createdAt:new Date().toISOString(),lines:JSON.parse(JSON.stringify(lines)),cartons:lines.reduce((a,l)=>a+l.cartons,0),tonnage:lines.reduce((a,l)=>a+l.tonnage,0),total:lines.reduce((a,l)=>a+l.amount,0)};db.invoices.push(newInv);lines=[];["#invNo","#invVehicle","#invDriver"].forEach(s=>$(s).value="");persist();if($("#exportInvoice"))$("#exportInvoice").value=newInv.id;toast("Invoice saved — PDF/JPG/WhatsApp ready")};

$("#payCustomer").onchange=()=>{$("#paymentOutstandingHint").textContent=$("#payCustomer").value?`Current outstanding: ${money(outstanding($("#payCustomer").value))}`:""};
$("#savePayment").onclick=()=>{const date=$("#payDate").value,customerCode=$("#payCustomer").value,amount=Number($("#payAmount").value||0);if(!date||!customerCode||amount<=0)return toast("Payment details incomplete");db.payments.push({id:id(),date,customerCode,ref:$("#payRef").value.trim(),amount,method:$("#payMethod").value,note:$("#payNote").value.trim()});["#payRef","#payAmount","#payNote"].forEach(s=>$(s).value="");persist();toast("Payment saved")};

$("#retInvoice").onchange=()=>{const inv=db.invoices.find(i=>i.id===$("#retInvoice").value);$("#retLine").innerHTML='<option value="">Select SKU line</option>'+(inv?inv.lines.map(l=>{const remaining=l.cartons-returnedFor(inv.id,l.code);return `<option value="${esc(l.code)}">${esc(l.code)} — ${esc(l.name)} (${remaining} cartons available)</option>`}).join(""):"");previewReturn()};
$("#retLine").onchange=previewReturn;$("#retCartons").oninput=previewReturn;
function previewReturn(){const inv=db.invoices.find(i=>i.id===$("#retInvoice").value);if(!inv){$("#returnPreview").textContent="";return}const l=inv.lines.find(x=>x.code===$("#retLine").value),c=Number($("#retCartons").value||0);if(!l||!c){$("#returnPreview").textContent="";return}const t=c*l.cartonWeight/1000,pieces=c*Number(l.piecesPerCarton||0),amount=l.priceBasis==="piece"?pieces*l.rate:t*l.rate;$("#returnPreview").textContent=`Return: ${c} cartons • ${num(t)} tons • ${money(amount)}`}
$("#saveReturn").onclick=()=>{const inv=db.invoices.find(i=>i.id===$("#retInvoice").value),code=$("#retLine").value,c=Number($("#retCartons").value||0);if(!inv||!code||c<=0)return toast("Return details incomplete");const l=inv.lines.find(x=>x.code===code),available=l.cartons-returnedFor(inv.id,code);if(c>available)return toast("Returned cartons exceed available quantity");const tonnage=c*l.cartonWeight/1000,pieces=c*Number(l.piecesPerCarton||0),amount=l.priceBasis==="piece"?pieces*l.rate:tonnage*l.rate;db.returns.push({id:id(),date:$("#retDate").value,invoiceId:inv.id,invoiceNo:inv.invoiceNo,customerCode:inv.customerCode,productCode:code,cartons:c,tonnage,amount,ref:$("#retRef").value.trim(),reason:$("#retReason").value.trim()});$("#retCartons").value=$("#retRef").value=$("#retReason").value="";persist();toast("Sales return saved")};

$("#targetType").onchange=updateTargetEntity;$("#targetMonth").onchange=renderTargets;
function updateTargetEntity(){const type=$("#targetType").value;if(type==="company"){$("#targetEntityWrap").classList.add("hidden");$("#targetEntity").innerHTML='<option value="company">Company</option>'}else{$("#targetEntityWrap").classList.remove("hidden");const arr=type==="customer"?db.customers:db.salesmen;$("#targetEntity").innerHTML=arr.map(x=>`<option value="${esc(x.code)}">${esc(x.code)} — ${esc(x.name)}</option>`).join("")}}
$("#saveTarget").onclick=()=>{const month=$("#targetMonth").value,type=$("#targetType").value,entity=type==="company"?"company":$("#targetEntity").value;if(!month||!entity)return toast("Month and entity required");const obj={month,type,entity,tonnage:Number($("#targetTon").value||0),amount:Number($("#targetAmount").value||0)},i=db.targets.findIndex(t=>t.month===month&&t.type===type&&t.entity===entity);if(i>=0)db.targets[i]=obj;else db.targets.push(obj);persist();toast("Target saved")};

$("#runReport").onclick=()=>{const f=$("#rFrom").value,t=$("#rTo").value,c=$("#rCustomer").value,p=$("#rProduct").value,s=$("#rSalesman").value,st=$("#rStatus").value;let rows=db.invoices.filter(i=>(!f||i.date>=f)&&(!t||i.date<=t)&&(!c||i.customerCode===c)&&(!st||i.status===st)&&(!s||(db.customers.find(x=>x.code===i.customerCode)||{}).salesman===s));if(p)rows=rows.filter(i=>i.lines.some(l=>l.code===p));let amount=0,tonnage=0;rows.forEach(i=>{const n=invoiceNet(i);amount+=n.amount;tonnage+=n.tonnage});$("#reportOutput").innerHTML=`<div class="grid cards"><div class="card"><span>Invoices</span><strong>${rows.length}</strong></div><div class="card"><span>Net Sales</span><strong>${money(amount)}</strong></div><div class="card"><span>Net Tonnage</span><strong>${num(tonnage)}</strong></div></div>`+rows.map(i=>{const n=invoiceNet(i);return `<div class="list-row"><div><b>${esc(i.invoiceNo)}</b><div class="muted">${i.date} • ${esc(i.customerCode)} — ${esc(cName(i.customerCode))}</div></div><div class="right"><span class="badge ${i.status}">${i.status}</span><div>${money(n.amount)}</div><div class="muted">${num(n.tonnage)} tons</div></div></div>`}).join("")};
$("#runOutstanding").onclick=()=>{$("#reportOutput").innerHTML=`<h3>Customer Outstanding</h3>`+db.customers.slice().sort((a,b)=>outstanding(b.code)-outstanding(a.code)).map(c=>`<div class="list-row"><div><b>${esc(c.code)} — ${esc(c.name)}</b><div class="muted">${esc(smName(c.salesman))}</div></div><b>${money(outstanding(c.code))}</b></div>`).join("")};
$("#exportCsv").onclick=()=>{const rows=[["Invoice No","Date","SSS Code","Customer Name","Status","Product Code","SKU Name","Cartons","Carton Size PCs","Total Pieces","Carton Weight","Weight Unit","Tonnage","Rate per Pc","Sales Amount","TP Price per Pc incl GST","TO Scheme","Customer SSS Rate per Pc","Customer Atlas Rate per Pc","Customer Profit/Loss","Approval Expire Date"]];db.invoices.forEach(i=>i.lines.forEach(l=>{const tp=Number(l.tpPrice||0),sssapAmount=Number(l.pieces||0)*tp;const c=db.customers.find(x=>x.code===i.customerCode)||{},pl=customerProfitLoss(c);rows.push([i.invoiceNo,i.date,i.customerCode,cName(i.customerCode),i.status,l.code,l.name,l.cartons,l.piecesPerCarton||0,l.pieces||0,l.cartonWeight,l.weightUnit||"kg",l.tonnage,l.rate,l.amount,tp,l.toScheme||0,c.sssRate||0,c.atlasRate||0,pl.type?`${pl.type}:${pl.amount}`:"",c.approvalExpiry||""])}));download("SUH-sales-"+today()+".csv",rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n"),"text/csv")};


$("#runSssap").onclick=()=>{
 const f=$("#rFrom").value,t=$("#rTo").value,c=$("#rCustomer").value,p=$("#rProduct").value,s=$("#rSalesman").value,st=$("#rStatus").value;
 let invs=db.invoices.filter(i=>i.status!=="Cancelled"&&(!f||i.date>=f)&&(!t||i.date<=t)&&(!c||i.customerCode===c)&&(!st||i.status===st)&&(!s||(db.customers.find(x=>x.code===i.customerCode)||{}).salesman===s));
 let rows=[],totalAmount=0,totalTon=0;
 invs.forEach(i=>i.lines.forEach(l=>{
   if(p&&l.code!==p)return;
   const returned=returnedFor(i.id,l.code),netCartons=Math.max(0,l.cartons-returned);
   const netPieces=netCartons*Number(l.piecesPerCarton||0);
   const netTon=netCartons*Number(l.cartonWeight||0)/1000;
   const tp=Number(l.tpPrice||0);
   const amount=netPieces*tp;
   totalAmount+=amount;totalTon+=netTon;
   rows.push({invoiceNo:i.invoiceNo,date:i.date,customerCode:i.customerCode,productCode:l.code,productName:l.name,cartons:netCartons,pieces:netPieces,tp,tonnage:netTon,amount});
 }));
 $("#reportOutput").innerHTML=`<div class="grid cards"><div class="card"><span>SSSAP Sale Amount</span><strong>${money(totalAmount)}</strong></div><div class="card"><span>SSSAP Tonnage</span><strong>${num(totalTon)}</strong></div><div class="card"><span>Lines</span><strong>${rows.length}</strong></div></div>`+
 rows.map(r=>`<div class="list-row"><div><b>${esc(r.invoiceNo)} • ${esc(r.productCode)} — ${esc(r.productName)}</b><div class="muted">${r.date} • ${esc(r.customerCode)} • ${num(r.cartons)} cartons • TP ${money(r.tp)}/pc</div></div><div class="right">${money(r.amount)}<div class="muted">${num(r.tonnage)} tons</div></div></div>`).join("");
 window.__lastSssapRows=rows;
};

$("#exportSssapCsv").onclick=()=>{
 let rows=window.__lastSssapRows;
 if(!rows){$("#runSssap").click();rows=window.__lastSssapRows||[]}
 const out=[["Invoice No","Date","SSS Code","Customer Name","Product Code","SKU Name","Net Cartons","Total Pieces","TP Price per Pc incl GST","SSSAP Amount","SSSAP Tonnage","TO Scheme","Customer Atlas Rate per Pc","Customer SSS Rate per Pc","Profit/Loss","Approval Expire Date"]];
 rows.forEach(r=>{
   const inv=db.invoices.find(i=>i.invoiceNo===r.invoiceNo&&i.date===r.date),line=inv?inv.lines.find(l=>l.code===r.productCode):null;
   const customer=db.customers.find(c=>c.code===r.customerCode)||{},pl=customerProfitLoss(customer);out.push([r.invoiceNo,r.date,r.customerCode,cName(r.customerCode),r.productCode,r.productName,r.cartons,r.pieces,r.tp,r.amount,r.tonnage,line?.toScheme||0,customer.atlasRate||0,customer.sssRate||0,pl.type?`${pl.type}:${pl.amount}`:"",customer.approvalExpiry||""]);
 });
 download("SUH-SSSAP-"+today()+".csv",out.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n"),"text/csv");
};

$("#exportOutstandingCsv").onclick=()=>{
 const rows=[["Customer Code","Customer Name","Salesman","Opening Outstanding","Current Outstanding"]];
 db.customers.slice().sort((a,b)=>outstanding(b.code)-outstanding(a.code)).forEach(c=>rows.push([c.code,c.name,smName(c.salesman),c.opening||0,outstanding(c.code)]));
 download("SUH-outstanding-"+today()+".csv",rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n"),"text/csv");
};
$("#printReport").onclick=()=>{
 const content=$("#reportOutput").innerHTML||"<h2>SUH Sales Pro Report</h2><p>Please run a report first.</p>";
 const w=window.open("","_blank");
 w.document.write(`<html><head><title>SUH Report</title><style>body{font-family:Arial;padding:30px;color:#111}.list-row{display:flex;justify-content:space-between;border-bottom:1px solid #ddd;padding:10px 0}.muted{color:#666;font-size:12px}.card{display:inline-block;border:1px solid #ddd;padding:12px;margin:5px}.badge{font-size:12px}</style></head><body><h1>SUH Sales Pro</h1><p>Generated: ${new Date().toLocaleString()}</p>${content}</body></html>`);
 w.document.close();w.focus();setTimeout(()=>w.print(),400);
};

function selectedInvoice(){const id=$("#exportInvoice")?.value;const inv=db.invoices.find(i=>i.id===id);if(!inv)toast("Please select a saved invoice");return inv}
function loadImage(src){return new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=reject;im.src=src})}
function fmtInvoiceDate(d){try{return new Date(d+"T00:00:00").toLocaleDateString("en-GB")}catch(e){return d}}
function invoicePriorBalance(inv){const c=db.customers.find(x=>x.code===inv.customerCode)||{};let bal=Number(c.opening||0);for(const i of db.invoices){if(i.id===inv.id)break;if(i.customerCode===inv.customerCode)bal+=invoiceNet(i).amount}for(const p of db.payments){if(p.customerCode===inv.customerCode&&(!inv.date||!p.date||p.date<=inv.date))bal-=Number(p.amount||0)}return bal}
async function invoiceCanvas(inv){
 const W=1240,H=1754,c=document.createElement("canvas");c.width=W;c.height=H;const x=c.getContext("2d");
 x.fillStyle="#fff";x.fillRect(0,0,W,H);const yellow="#ffd400",black="#101010",muted="#555";
 const customer=db.customers.find(v=>v.code===inv.customerCode)||{};
 // watermark
 try{const logo=await loadImage("assets/suh-final-logo.png");x.save();x.globalAlpha=.07;const m=650;x.drawImage(logo,(W-m)/2,560,m,m);x.restore();x.drawImage(logo,85,58,105,105)}catch(e){}
 x.fillStyle=black;x.font="bold 32px Arial";x.fillText("SUH Sales Pro",215,92);x.font="18px Arial";x.fillText("Sales & Distribution Invoice",215,125);
 x.fillStyle=yellow;x.fillRect(70,185,790,34);x.fillRect(1090,185,80,34);x.fillStyle=black;x.font="bold 38px Arial";x.fillText("INVOICE",895,216);
 x.font="bold 18px Arial";x.fillText("Code:",110,280);x.fillText("Name:",110,316);x.fillText("Address:",110,352);x.font="18px Arial";x.fillText(String(inv.customerCode||""),205,280);x.font="bold 18px Arial";x.fillText(String(customer.name||""),205,316);x.font="16px Arial";x.fillStyle=muted;x.fillText(String(customer.address||"-").slice(0,58),205,352);
 x.fillStyle=black;x.font="bold 18px Arial";x.fillText("Inv. No:",865,280);x.fillText("Date:",865,316);x.fillText("Status:",865,352);x.font="18px Arial";x.fillText(String(inv.invoiceNo),960,280);x.fillText(fmtInvoiceDate(inv.date),960,316);x.fillText(String(inv.status||""),960,352);
 const cols=[70,120,570,690,790,890,1010,1170], heads=["Sr.#","Item Name","Rate","QTY","Dis%","Dis Value","Bonus","Line Total"];
 x.fillStyle=black;x.fillRect(70,405,1100,48);x.fillStyle="#fff";x.font="bold 16px Arial";heads.forEach((h,i)=>x.fillText(h,cols[i]+8,436));
 let y=488;x.fillStyle=black;x.font="15px Arial";
 inv.lines.forEach((l,i)=>{const qty=Number(l.pieces||l.cartons||0);x.fillText(String(i+1),cols[0]+12,y);x.fillText(String(l.name||l.code).slice(0,46),cols[1]+8,y);x.fillText(Number(l.rate||0).toLocaleString("en-PK",{minimumFractionDigits:2,maximumFractionDigits:2}),cols[2]+8,y);x.fillText(String(qty),cols[3]+8,y);x.fillText("0.00",cols[4]+8,y);x.fillText("0.00",cols[5]+8,y);x.fillText("0",cols[6]+8,y);x.textAlign="right";x.fillText(Number(l.amount||0).toLocaleString("en-PK",{minimumFractionDigits:2,maximumFractionDigits:2}),1160,y);x.textAlign="left";x.strokeStyle="#bbb";x.beginPath();x.moveTo(70,y+18);x.lineTo(1170,y+18);x.stroke();y+=42});
 const subtotal=Number(inv.total||0),prior=invoicePriorBalance(inv),net=prior+subtotal;
 y=Math.max(y+30,620);x.font="14px Arial";x.strokeStyle="#777";x.strokeRect(70,y,115,28);x.strokeRect(70,y+30,115,28);x.fillText("T. Item:   "+inv.lines.length,78,y+20);x.fillText("T. Qty:    "+inv.lines.reduce((a,l)=>a+Number(l.pieces||l.cartons||0),0),78,y+50);
 const bx=835,bw=335,rh=38;const rows=[["Sub Total",subtotal,true],["Discount",0,false],["Any Charges",0,false],["Previous Balance",prior,false],["Net Balance",net,true]];rows.forEach((r,j)=>{const yy=y+j*rh;if(r[2]){x.fillStyle=yellow;x.fillRect(bx,yy,bw,rh-3)}x.fillStyle=black;x.font=(r[2]?"bold ":"")+"17px Arial";x.fillText(r[0],bx+18,yy+25);x.textAlign="right";x.fillText(Number(r[1]).toLocaleString("en-PK",{minimumFractionDigits:2,maximumFractionDigits:2}),bx+bw-14,yy+25);x.textAlign="left"});
 x.fillStyle=yellow;x.fillRect(70,1665,850,15);x.fillRect(1125,1665,45,15);x.fillStyle=muted;x.font="14px Arial";x.fillText("Generated by SUH Sales Pro",90,1710);x.textAlign="center";x.fillText("Page 1 of 1",W/2,1710);x.textAlign="right";x.fillText("Authorised Sign",1100,1710);x.textAlign="left";
 return c
}
function bytesToBase64(bytes){let bin="";for(let i=0;i<bytes.length;i+=0x8000)bin+=String.fromCharCode(...bytes.subarray(i,i+0x8000));return btoa(bin)}
function jpegPdfBase64(dataUrl,w,h){const raw=atob(dataUrl.split(",")[1]),jpg=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)jpg[i]=raw.charCodeAt(i);const enc=new TextEncoder(),parts=[],offsets=[0];let len=0;const add=v=>{const b=typeof v==="string"?enc.encode(v):v;parts.push(b);len+=b.length};add("%PDF-1.4\n");const obj=(n,body)=>{offsets[n]=len;add(`${n} 0 obj\n${body}\nendobj\n`)};obj(1,"<< /Type /Catalog /Pages 2 0 R >>");obj(2,"<< /Type /Pages /Kids [3 0 R] /Count 1 >>");obj(3,"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>");const stream="q\n595 0 0 842 0 0 cm\n/Im0 Do\nQ\n";obj(4,`<< /Length ${stream.length} >>\nstream\n${stream}endstream`);offsets[5]=len;add(`5 0 obj\n<< /Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpg.length} >>\nstream\n`);add(jpg);add("\nendstream\nendobj\n");const xref=len;add("xref\n0 6\n0000000000 65535 f \n");for(let i=1;i<=5;i++)add(String(offsets[i]).padStart(10,"0")+" 00000 n \n");add(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);const out=new Uint8Array(len);let p=0;parts.forEach(b=>{out.set(b,p);p+=b.length});return bytesToBase64(out)}
async function invoiceFile(inv,type){const c=await invoiceCanvas(inv),jpg=c.toDataURL("image/jpeg",.94),safe=String(inv.invoiceNo).replace(/[^a-z0-9_-]/gi,"-");if(type==="jpg")return {name:`SUH-Invoice-${safe}.jpg`,mime:"image/jpeg",b64:jpg.split(",")[1]};return {name:`SUH-Invoice-${safe}.pdf`,mime:"application/pdf",b64:jpegPdfBase64(jpg,c.width,c.height)}}
$("#invoiceJpg").onclick=async()=>{const inv=selectedInvoice();if(!inv)return;toast("Preparing JPG...");const f=await invoiceFile(inv,"jpg");downloadBase64(f.name,f.b64,f.mime)};
$("#invoicePdf").onclick=async()=>{const inv=selectedInvoice();if(!inv)return;toast("Preparing PDF...");const f=await invoiceFile(inv,"pdf");downloadBase64(f.name,f.b64,f.mime)};
$("#invoiceWhatsapp").onclick=async()=>{const inv=selectedInvoice();if(!inv)return;toast("Preparing invoice for WhatsApp...");const f=await invoiceFile(inv,"pdf");if(window.SUHAndroid&&typeof window.SUHAndroid.shareBase64==="function"){window.SUHAndroid.shareBase64(f.name,f.mime,f.b64);return}try{const blob=await (await fetch(`data:${f.mime};base64,${f.b64}`)).blob(),file=new File([blob],f.name,{type:f.mime});if(navigator.share&&navigator.canShare?.({files:[file]})){await navigator.share({title:`Invoice ${inv.invoiceNo}`,text:`SUH invoice ${inv.invoiceNo} — ${cName(inv.customerCode)}`,files:[file]});return}}catch(e){}toast("Direct file sharing needs the Android app. PDF saved instead.");downloadBase64(f.name,f.b64,f.mime)};

$("#shareWhatsapp").onclick=async()=>{
 const text=buildShareText();
 if(navigator.share){try{await navigator.share({title:"SUH Sales Pro Report",text});return}catch(e){}}
 window.open("https://wa.me/?text="+encodeURIComponent(text),"_blank");
};
function buildShareText(){
 const f=$("#rFrom").value,t=$("#rTo").value,c=$("#rCustomer").value;
 let invs=db.invoices.filter(i=>(!f||i.date>=f)&&(!t||i.date<=t)&&(!c||i.customerCode===c));
 let amount=0,tonnage=0;invs.forEach(i=>{const n=invoiceNet(i);amount+=n.amount;tonnage+=n.tonnage});
 let text=`SUH Sales Pro Report\nFrom: ${f||"All"}\nTo: ${t||"All"}\nInvoices: ${invs.length}\nNet Sales: ${money(amount)}\nNet Tonnage: ${num(tonnage)} tons`;
 if(c) text+=`\nCustomer: ${c} — ${cName(c)}\nOutstanding: ${money(outstanding(c))}`;
 return text;
}

function utf8Base64(text){const bytes=new TextEncoder().encode(text);let bin="";for(let i=0;i<bytes.length;i+=0x8000)bin+=String.fromCharCode(...bytes.subarray(i,i+0x8000));return btoa(bin)}
function downloadBase64(name,b64,type){
 if(window.SUHAndroid&&typeof window.SUHAndroid.saveBase64==="function"){window.SUHAndroid.saveBase64(name,type,b64);toast(name+" saved to Downloads");return}
 const a=document.createElement("a");a.href=`data:${type};base64,${b64}`;a.download=name;a.click();
}
function download(name,data,type){downloadBase64(name,utf8Base64(data),type)}
$("#backupData").onclick=()=>download("SUH-backup-"+today()+".json",JSON.stringify(db,null,2),"application/json");
$("#restoreData").onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{db=JSON.parse(r.result);db.petrolExpenses=Array.isArray(db.petrolExpenses)?db.petrolExpenses:[];persist();toast("Backup restored")}catch{toast("Invalid backup file")}};r.readAsText(f)};
$("#restoreAutoBackup").onclick=()=>{try{const arr=JSON.parse(localStorage.getItem("suh-auto-backups")||"[]");if(!arr.length)return toast("No auto backup available");db=JSON.parse(arr[arr.length-1].data);db.petrolExpenses=Array.isArray(db.petrolExpenses)?db.petrolExpenses:[];localStorage.setItem("suh-full-db",JSON.stringify(db));renderAll();toast("Latest auto backup restored")}catch(e){toast("Auto backup could not be restored")}};
function renderBackupStatus(){const el=$("#backupStatus");if(!el)return;let arr=[];try{arr=JSON.parse(localStorage.getItem("suh-auto-backups")||"[]")}catch(e){}const last=arr[arr.length-1];el.textContent=`Auto Save: ON • Every saved change stays on this device${last?` • Latest auto backup: ${new Date(last.savedAt).toLocaleString()}`:""} • 7 daily snapshots retained.`}


function normText(v){return String(v??"").trim().toLowerCase().replace(/\s+/g," ")}
function parseCsv(text){
 const rows=[];let row=[],cell="",q=false;
 for(let i=0;i<text.length;i++){const ch=text[i],next=text[i+1];if(ch==='"'){if(q&&next==='"'){cell+='"';i++}else q=!q}else if(ch===','&&!q){row.push(cell);cell=""}else if((ch==='\n'||ch==='\r')&&!q){if(ch==='\r'&&next==='\n')i++;row.push(cell);if(row.some(x=>String(x).trim()!==""))rows.push(row);row=[];cell=""}else cell+=ch}
 row.push(cell);if(row.some(x=>String(x).trim()!==""))rows.push(row);return rows;
}
function colIndex(ref){let n=0;for(const ch of (ref.match(/[A-Z]+/i)||[""])[0].toUpperCase())n=n*26+ch.charCodeAt(0)-64;return n-1}
async function parseXlsx(file){
 const zip=await JSZip.loadAsync(await file.arrayBuffer()), shared=[];
 if(zip.file("xl/sharedStrings.xml")){const doc=new DOMParser().parseFromString(await zip.file("xl/sharedStrings.xml").async("string"),"application/xml");doc.querySelectorAll("si").forEach(si=>shared.push([...si.querySelectorAll("t")].map(t=>t.textContent).join("")))}
 let sheetPath="xl/worksheets/sheet1.xml";
 if(zip.file("xl/workbook.xml")&&zip.file("xl/_rels/workbook.xml.rels")){
  const wb=new DOMParser().parseFromString(await zip.file("xl/workbook.xml").async("string"),"application/xml"), first=wb.querySelector("sheet"),rid=first?.getAttribute("r:id")||first?.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships","id");
  const rel=new DOMParser().parseFromString(await zip.file("xl/_rels/workbook.xml.rels").async("string"),"application/xml");const r=[...rel.querySelectorAll("Relationship")].find(x=>x.getAttribute("Id")===rid);if(r){let target=r.getAttribute("Target")||"worksheets/sheet1.xml";sheetPath="xl/"+target.replace(/^\//,"").replace(/^xl\//,"")}
 }
 const xml=await zip.file(sheetPath).async("string"),doc=new DOMParser().parseFromString(xml,"application/xml"),rows=[];
 doc.querySelectorAll("sheetData row").forEach(r=>{const out=[];r.querySelectorAll("c").forEach(c=>{const idx=colIndex(c.getAttribute("r")||"A1"),type=c.getAttribute("t"),v=c.querySelector("v")?.textContent??"",inline=[...c.querySelectorAll("is t")].map(t=>t.textContent).join("");out[idx]=type==="s"?(shared[Number(v)]??""):type==="inlineStr"?inline:v});rows.push(out)});return rows;
}
function headerMap(headers){const map={};headers.forEach((h,i)=>map[normText(h).replace(/[^a-z0-9]+/g," ").trim()]=i);return map}
function pick(row,map,names){for(const n of names){const k=normText(n).replace(/[^a-z0-9]+/g," ").trim();if(map[k]!==undefined)return row[map[k]]??""}return ""}
function excelDate(v){if(!v)return today();if(/^\d{4}-\d{2}-\d{2}$/.test(String(v).trim()))return String(v).trim();const n=Number(v);if(Number.isFinite(n)&&n>20000){const d=new Date(Date.UTC(1899,11,30)+n*86400000);return d.toISOString().slice(0,10)}return today()}
$("#importProducts").onchange=async e=>{
 const f=e.target.files[0];if(!f)return;try{
  const rows=f.name.toLowerCase().endsWith(".xlsx")?await parseXlsx(f):parseCsv(await f.text());if(rows.length<2)return toast("Product file has no data rows");
  const map=headerMap(rows[0]),stats={added:0,updated:0,skipped:0},warnings=[];
  for(const row of rows.slice(1)){
   const code=String(pick(row,map,["Product Code","SKU Code","Code"])).trim(),name=String(pick(row,map,["SKU Name","Product Name","Name"])).trim();if(!code||!name){stats.skipped++;continue}
   const tpPrice=Number(String(pick(row,map,["TP Price per Pc including GST in PKR","TP Price per Pcs including Gst in PKR","TP Price per Pc incl GST","TP Price","TP"])).replace(/,/g,"")||0),toScheme=Number(String(pick(row,map,["TO Scheme in PKR","TO Scheme","Scheme"])).replace(/,/g,"")||0),piecesPerCarton=Number(String(pick(row,map,["Carton Size (No of PCs)","Carton Size","Pieces per Carton","Pcs Carton"])).replace(/,/g,"")||0),cartonWeight=Number(String(pick(row,map,["Carton Weight","Weight"])).replace(/,/g,"")||0),weightUnit=normText(pick(row,map,["Weight Unit","Unit"]))==="litre"?"litre":"kg",effective=excelDate(pick(row,map,["Effective From","Effective Date","Date"]));
   const base={code,name,tpPrice,toScheme,piecesPerCarton,cartonWeight,weightUnit,priceBasis:"piece",rate:Math.max(0,tpPrice-toScheme)},i=db.products.findIndex(p=>p.code===code);
   if(i>=0){if(normText(db.products[i].name)!==normText(name)){stats.skipped++;warnings.push(`${code}: name mismatch (${db.products[i].name} / ${name})`);continue}db.products[i]=saveProductObject(db.products[i],base,effective);stats.updated++}else{db.products.push(saveProductObject(null,base,effective));stats.added++}
  }
  persist();const msg=`Product import complete: ${stats.added} new, ${stats.updated} updated, ${stats.skipped} skipped.`;$("#productHistory").innerHTML=`<div class="history-box"><h3>Import Result</h3><div class="success-text">${esc(msg)}</div>${warnings.length?`<div class="warning-text" style="margin-top:8px">${warnings.slice(0,10).map(esc).join("<br>")}${warnings.length>10?`<br>+${warnings.length-10} more`:""}</div>`:""}</div>`;toast(msg)
 }catch(err){console.error(err);toast("Could not read product Excel/CSV file")}finally{e.target.value=""}
};

function daysInMonth(month){const [y,m]=month.split("-").map(Number);return new Date(y,m,0).getDate()}
function petrolForMonth(month){return db.petrolExpenses.filter(x=>x.date.startsWith(month)).sort((a,b)=>a.date.localeCompare(b.date))}
function renderPetrol(){const month=$("#petrolMonth")?.value||monthNow();if(!$("#petrolRows"))return;const count=daysInMonth(month),map=new Map(petrolForMonth(month).map(x=>[x.date,x]));let html="",total=0;for(let d=1;d<=count;d++){const date=`${month}-${String(d).padStart(2,"0")}`,item=map.get(date),amt=Number(item?.amount||0);total+=amt;const day=new Date(date+"T12:00:00").toLocaleDateString("en-PK",{weekday:"short"});html+=`<tr><td>${date}</td><td>${day}</td><td><input class="petrol-amount" data-date="${date}" type="number" min="0" step="0.01" placeholder="0" value="${amt||""}"></td></tr>`}$("#petrolRows").innerHTML=html;$("#petrolTotal").textContent=money(total);$("#petrolHistorySummary").textContent=`${month}: ${petrolForMonth(month).filter(x=>Number(x.amount)>0).length} petrol entries saved • Total ${money(total)}`;$$('.petrol-amount').forEach(inp=>inp.onchange=()=>savePetrolDay(inp.dataset.date,inp.value))}
function savePetrolDay(date,value){const amount=Number(value||0),i=db.petrolExpenses.findIndex(x=>x.date===date);if(amount>0){if(i>=0)db.petrolExpenses[i].amount=amount;else db.petrolExpenses.push({id:id(),date,amount})}else if(i>=0)db.petrolExpenses.splice(i,1);persist();toast(amount>0?"Petrol expense saved":"Petrol entry cleared")}
$("#petrolMonth").onchange=renderPetrol;
function petrolReportRows(){const month=$("#petrolMonth").value,items=petrolForMonth(month),map=new Map(items.map(x=>[x.date,x]));return {month,rows:Array.from({length:daysInMonth(month)},(_,i)=>{const date=`${month}-${String(i+1).padStart(2,"0")}`;return {date,day:new Date(date+"T12:00:00").toLocaleDateString("en-PK",{weekday:"short"}),amount:Number(map.get(date)?.amount||0)}}),total:items.reduce((a,x)=>a+Number(x.amount||0),0)}}
function pdfEscape(s){return String(s).replace(/\\/g,"\\\\").replace(/\(/g,"\\(").replace(/\)/g,"\\)")}
function makeSimplePdf(lines){const content=["BT","/F1 10 Tf","50 800 Td","14 TL",...lines.flatMap((line,i)=>i?[`0 -14 Td`,`(${pdfEscape(line)}) Tj`]:[`(${pdfEscape(line)}) Tj`]),"ET"].join("\n"),objs=[null,"<< /Type /Catalog /Pages 2 0 R >>","<< /Type /Pages /Kids [3 0 R] /Count 1 >>","<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",`<< /Length ${content.length} >>\nstream\n${content}\nendstream`,`<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>`];let out="%PDF-1.4\n",offs=[0];for(let i=1;i<objs.length;i++){offs[i]=new TextEncoder().encode(out).length;out+=`${i} 0 obj\n${objs[i]}\nendobj\n`}const xref=new TextEncoder().encode(out).length;out+=`xref\n0 ${objs.length}\n0000000000 65535 f \n`;for(let i=1;i<objs.length;i++)out+=String(offs[i]).padStart(10,"0")+" 00000 n \n";out+=`trailer\n<< /Size ${objs.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;return out}
$("#petrolPdf").onclick=()=>{const r=petrolReportRows(),lines=["SUH Sales Pro - Petrol Expense Report","Made by Shahzad Ul Haq",`Month: ${r.month}`,"-----------------------------------------------","Date         Day        Amount (PKR)","-----------------------------------------------",...r.rows.map(x=>`${x.date}   ${x.day.padEnd(9," ")} ${x.amount?x.amount.toFixed(2):"-"}`),"-----------------------------------------------",`TOTAL PETROL EXPENSE: PKR ${r.total.toFixed(2)}`];download("SUH-Petrol-"+r.month+".pdf",makeSimplePdf(lines),"application/pdf")};
$("#petrolJpg").onclick=()=>{const r=petrolReportRows(),canvas=document.createElement("canvas"),w=1200,lineH=38,h=230+r.rows.length*lineH+100;canvas.width=w;canvas.height=h;const c=canvas.getContext("2d");c.fillStyle="#ffffff";c.fillRect(0,0,w,h);c.fillStyle="#111111";c.font="bold 34px Arial";c.fillText("SUH Sales Pro - Petrol Expense",50,55);c.font="20px Arial";c.fillText("Made by Shahzad Ul Haq",50,90);c.fillText("Month: "+r.month,50,125);c.font="bold 20px Arial";c.fillText("Date",50,180);c.fillText("Day",330,180);c.fillText("Amount (PKR)",560,180);c.font="19px Arial";let y=220;r.rows.forEach(x=>{c.fillText(x.date,50,y);c.fillText(x.day,330,y);c.fillText(x.amount?x.amount.toFixed(2):"-",560,y);y+=lineH});c.font="bold 24px Arial";c.fillText("Total Petrol Expense: PKR "+r.total.toFixed(2),50,y+30);const data=canvas.toDataURL("image/jpeg",0.92).split(",")[1];downloadBase64("SUH-Petrol-"+r.month+".jpg",data,"image/jpeg")};
window.addEventListener("beforeunload",()=>{try{localStorage.setItem("suh-full-db",JSON.stringify(db));autoSnapshot()}catch(e){}});

$("#importCustomers").onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{let n=0;r.result.split(/\r?\n/).slice(1).forEach(line=>{if(!line.trim())return;const parts=line.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g)||[];const [code,name,address,sssRate,atlasRate,profitLoss,approvalExpiry,opening]=parts.map(x=>x.trim().replace(/^"|"$/g,""));if(!code||!name)return;const sss=Number((sssRate||"0").replace(/,/g,"")),atlas=Number((atlasRate||"0").replace(/,/g,"")),signed=sss-atlas;const obj={code,name,address:address||"",sssRate:sss,atlasRate:atlas,profitLoss:signed>0?"profit":signed<0?"loss":(profitLoss||""),profitLossAmount:Math.abs(signed),approvalExpiry:approvalExpiry||"",opening:Number((opening||"0").replace(/,/g,""))},i=db.customers.findIndex(c=>c.code===code);if(i>=0)db.customers[i]={...db.customers[i],...obj};else db.customers.push(obj);n++});persist();toast(n+" customers imported")};r.readAsText(f)};

["#invDate","#payDate","#retDate"].forEach(s=>$(s).value=today());$("#targetMonth").value=monthNow();$("#prodEffectiveFrom").value=today();$("#petrolMonth").value=monthNow();$("#rFrom").value=monthNow()+"-01";$("#rTo").value=today();

let deferredPrompt;window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();deferredPrompt=e;$("#installBtn").classList.remove("hidden")});$("#installBtn").onclick=async()=>{if(!deferredPrompt)return;deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;$("#installBtn").classList.add("hidden")};
if("serviceWorker" in navigator)navigator.serviceWorker.register("sw.js");
renderAll();
switchTab(location.hash.slice(1)||"dashboard",true);
