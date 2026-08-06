const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const money=n=>"Rs "+new Intl.NumberFormat("en-PK",{maximumFractionDigits:2}).format(Number(n||0));
const num=n=>new Intl.NumberFormat("en-PK",{maximumFractionDigits:3}).format(Number(n||0));
const today=()=>new Date().toISOString().slice(0,10);
const monthNow=()=>today().slice(0,7);
const id=()=>crypto.randomUUID?crypto.randomUUID():Date.now()+"-"+Math.random();
let db=JSON.parse(localStorage.getItem("suh-full-db")||'{"customers":[],"products":[],"salesmen":[],"invoices":[],"payments":[],"returns":[],"targets":[]}');
let lines=[];

function toast(msg){const t=$("#toast");t.textContent=msg;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),2500)}
function persist(){localStorage.setItem("suh-full-db",JSON.stringify(db));renderAll()}
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

window.switchTab=name=>{
 $$(".tabs button").forEach(b=>b.classList.toggle("active",b.dataset.tab===name));
 $$(".tab").forEach(t=>t.classList.toggle("active",t.id===name));
 window.scrollTo({top:0,behavior:"smooth"});
};
$$(".tabs button").forEach(b=>b.onclick=()=>switchTab(b.dataset.tab));

function selectOptions(){
 const cust='<option value="">Select customer</option>'+db.customers.map(c=>`<option value="${esc(c.code)}">${esc(c.code)} — ${esc(c.name)}</option>`).join("");
 ["#invCustomer","#payCustomer"].forEach(s=>$(s).innerHTML=cust);
 $("#rCustomer").innerHTML='<option value="">All Customers</option>'+cust.replace('<option value="">Select customer</option>','');
 $("#lineProduct").innerHTML='<option value="">Select product</option>'+db.products.map(p=>`<option value="${esc(p.code)}">${esc(p.code)} — ${esc(p.name)}</option>`).join("");
 $("#rProduct").innerHTML='<option value="">All Products</option>'+db.products.map(p=>`<option value="${esc(p.code)}">${esc(p.code)} — ${esc(p.name)}</option>`).join("");
 const sm='<option value="">Unassigned</option>'+db.salesmen.map(s=>`<option value="${esc(s.code)}">${esc(s.code)} — ${esc(s.name)}</option>`).join("");
 $("#custSalesman").innerHTML=sm;
 $("#rSalesman").innerHTML='<option value="">All Salesmen</option>'+db.salesmen.map(s=>`<option value="${esc(s.code)}">${esc(s.code)} — ${esc(s.name)}</option>`).join("");
 $("#retInvoice").innerHTML='<option value="">Select invoice</option>'+db.invoices.filter(i=>i.status!=="Cancelled").slice().reverse().map(i=>`<option value="${i.id}">${esc(i.invoiceNo)} — ${esc(i.customerCode)} — ${i.date}</option>`).join("");
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
 $("#dashTargets").innerHTML=overall?targetProgressHtml("Overall Company",overall,met):'<p class="muted">No overall target set for this month.</p>';
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
 $("#customerList").innerHTML=db.customers.filter(c=>(c.code+" "+c.name).toLowerCase().includes(q)).map(c=>`<div class="list-row"><div><b>${esc(c.code)} — ${esc(c.name)}</b><div class="muted">${esc(smName(c.salesman))} • ${esc(c.phone||"")} ${esc(c.address||"")}</div></div><div class="right"><b>${money(outstanding(c.code))}</b><div class="muted">Outstanding</div><div class="mini-actions"><button onclick="editCustomer('${esc(c.code)}')">Edit</button></div></div></div>`).join("")||'<p class="muted">No customers.</p>';
}
function renderProducts(){
 const q=$("#productSearch").value.toLowerCase();
 $("#productList").innerHTML=db.products.filter(p=>(p.code+" "+p.name+" "+(p.brand||"")).toLowerCase().includes(q)).map(p=>`<div class="list-row"><div><b>${esc(p.code)} — ${esc(p.name)}</b><div class="muted">${esc(p.brand||"")} • ${esc(p.packing||"")} • ${num(p.cartonWeight)} kg/carton • ${num(p.piecesPerCarton||0)} pcs/carton</div></div><div class="right"><b>${money(p.rate)}/${p.priceBasis==="piece"?"piece":"ton"}</b><div class="muted">TP: ${money(p.tpPrice||0)}/pc</div><div class="muted">${(p.priceHistory||[]).length} price change(s)</div><div class="mini-actions"><button onclick="editProduct('${esc(p.code)}')">Edit</button></div></div></div>`).join("")||'<p class="muted">No products.</p>';
}
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
 $("#invoiceLines").innerHTML=lines.map((l,i)=>`<tr><td>${esc(l.code)}</td><td>${esc(l.name)}</td><td>${esc(l.packing||"")}</td><td>${l.cartons}</td><td>${num(l.piecesPerCarton||0)}</td><td>${num(l.pieces||0)}</td><td>${num(l.cartonWeight)}</td><td>${num(l.kg)}</td><td>${num(l.tonnage)}</td><td>${l.priceBasis==="piece"?"Per Piece":"Per Ton"}</td><td>${money(l.rate)}</td><td>${money(l.amount)}</td><td><button class="remove" onclick="removeLine(${i})">×</button></td></tr>`).join("");
 $("#invCartons").textContent=lines.reduce((a,l)=>a+l.cartons,0);$("#invTon").textContent=num(lines.reduce((a,l)=>a+l.tonnage,0));$("#invTotal").textContent=money(lines.reduce((a,l)=>a+l.amount,0));
}
window.removeLine=i=>{lines.splice(i,1);renderLines()};

function renderAll(){selectOptions();renderDashboard();renderCustomers();renderProducts();renderSalesmen();renderPayments();renderReturns();renderTargets();renderLines();}

$("#customerSearch").oninput=renderCustomers;$("#productSearch").oninput=renderProducts;
$("#saveSalesman").onclick=()=>{const code=$("#smCode").value.trim(),name=$("#smName").value.trim();if(!code||!name)return toast("Salesman code and name required");if(db.salesmen.some(s=>s.code===code))return toast("Salesman code already exists");db.salesmen.push({code,name,phone:$("#smPhone").value.trim()});$("#smCode").value=$("#smName").value=$("#smPhone").value="";persist();toast("Salesman saved")};

$("#saveCustomer").onclick=()=>{const old=$("#custEdit").value,code=$("#custCode").value.trim(),name=$("#custName").value.trim();if(!code||!name)return toast("Customer code and name required");if(!old&&db.customers.some(c=>c.code===code))return toast("Customer code already exists");const obj={code,name,salesman:$("#custSalesman").value,phone:$("#custPhone").value.trim(),address:$("#custAddress").value.trim(),opening:Number($("#custOpening").value||0)};if(old){const i=db.customers.findIndex(c=>c.code===old);db.customers[i]={...db.customers[i],...obj};db.invoices.forEach(x=>{if(x.customerCode===old)x.customerCode=code});db.payments.forEach(x=>{if(x.customerCode===old)x.customerCode=code})}else db.customers.push(obj);clearCustomerForm();persist();toast("Customer saved")};
function clearCustomerForm(){["#custEdit","#custCode","#custName","#custPhone","#custAddress","#custOpening"].forEach(s=>$(s).value="");$("#custSalesman").value="";$("#cancelCustomerEdit").classList.add("hidden")}
window.editCustomer=code=>{const c=db.customers.find(x=>x.code===code);if(!c)return;$("#custEdit").value=c.code;$("#custCode").value=c.code;$("#custName").value=c.name;$("#custSalesman").value=c.salesman||"";$("#custPhone").value=c.phone||"";$("#custAddress").value=c.address||"";$("#custOpening").value=c.opening||0;$("#cancelCustomerEdit").classList.remove("hidden");switchTab("customers")};$("#cancelCustomerEdit").onclick=clearCustomerForm;

$("#saveProduct").onclick=()=>{const old=$("#prodEdit").value,code=$("#prodCode").value.trim(),name=$("#prodName").value.trim(),rate=Number($("#prodRate").value||0);if(!code||!name)return toast("Product code and name required");if(!old&&db.products.some(p=>p.code===code))return toast("Product code already exists");const base={code,name,brand:$("#prodBrand").value.trim(),packing:$("#prodPacking").value.trim(),cartonWeight:Number($("#prodWeight").value||0),piecesPerCarton:Number($("#prodPieces").value||0),priceBasis:$("#prodPriceBasis").value,rate,tpPrice:Number($("#prodTpPrice").value||0),atlasPrice:Number($("#prodAtlasPrice").value||0),sssPrice:Number($("#prodSssPrice").value||0),approvalExpiry:$("#prodApprovalExpiry").value||""};if(old){const i=db.products.findIndex(p=>p.code===old),prev=db.products[i];const hist=[...(prev.priceHistory||[])];if(prev.rate!==rate)hist.push({date:today(),oldRate:prev.rate,newRate:rate});db.products[i]={...prev,...base,priceHistory:hist}}else db.products.push({...base,priceHistory:[]});clearProductForm();persist();toast("Product saved")};
function clearProductForm(){["#prodEdit","#prodCode","#prodName","#prodBrand","#prodPacking","#prodWeight","#prodPieces","#prodRate","#prodTpPrice","#prodAtlasPrice","#prodSssPrice","#prodApprovalExpiry"].forEach(s=>$(s).value="");$("#cancelProductEdit").classList.add("hidden")}
window.editProduct=code=>{const p=db.products.find(x=>x.code===code);if(!p)return;$("#prodEdit").value=p.code;$("#prodCode").value=p.code;$("#prodName").value=p.name;$("#prodBrand").value=p.brand||"";$("#prodPacking").value=p.packing||"";$("#prodWeight").value=p.cartonWeight;$("#prodPieces").value=p.piecesPerCarton||0;$("#prodPriceBasis").value=p.priceBasis||"ton";$("#prodRate").value=p.rate;$("#prodTpPrice").value=p.tpPrice||"";$("#prodAtlasPrice").value=p.atlasPrice||"";$("#prodSssPrice").value=p.sssPrice||"";$("#prodApprovalExpiry").value=p.approvalExpiry||"";$("#cancelProductEdit").classList.remove("hidden");switchTab("products")};$("#cancelProductEdit").onclick=clearProductForm;

$("#lineProduct").onchange=()=>{const p=db.products.find(x=>x.code===$("#lineProduct").value);$("#lineRate").value=p?p.rate:"";$("#lineRateLabel").firstChild.textContent=p&&p.priceBasis==="ton"?"Rate per Ton":"Rate per Piece";previewLine()};
$("#lineCartons").oninput=previewLine;$("#lineRate").oninput=previewLine;
function previewLine(){const p=db.products.find(x=>x.code===$("#lineProduct").value),c=Number($("#lineCartons").value||0),r=Number($("#lineRate").value||0);if(!p||!c){$("#linePreview").textContent="";return}const kg=c*p.cartonWeight,t=kg/1000,pieces=c*Number(p.piecesPerCarton||0),amount=p.priceBasis==="piece"?pieces*r:t*r;$("#linePreview").textContent=p.priceBasis==="piece"?`${c} cartons × ${p.piecesPerCarton||0} pcs = ${num(pieces)} pieces • ${num(t)} tons • Amount ${money(amount)}`:`${c} cartons × ${p.cartonWeight} kg = ${num(kg)} kg = ${num(t)} tons • Amount ${money(amount)}`}
$("#addLine").onclick=()=>{const p=db.products.find(x=>x.code===$("#lineProduct").value),cartons=Number($("#lineCartons").value||0),rate=Number($("#lineRate").value||0);if(!p||cartons<=0)return toast("Select product and enter cartons");const kg=cartons*p.cartonWeight,tonnage=kg/1000,pieces=cartons*Number(p.piecesPerCarton||0),priceBasis=p.priceBasis||"ton",amount=priceBasis==="piece"?pieces*rate:tonnage*rate;lines.push({code:p.code,name:p.name,packing:p.packing||"",cartons,piecesPerCarton:Number(p.piecesPerCarton||0),pieces,cartonWeight:p.cartonWeight,kg,tonnage,priceBasis,rate,amount,tpPrice:Number(p.tpPrice||0),atlasPrice:Number(p.atlasPrice||0),sssPrice:Number(p.sssPrice||0),approvalExpiry:p.approvalExpiry||""});$("#lineCartons").value="";previewLine();renderLines()};
$("#invCustomer").onchange=()=>{$("#customerOutstandingHint").textContent=$("#invCustomer").value?`Current outstanding: ${money(outstanding($("#invCustomer").value))}`:""};
$("#saveInvoice").onclick=()=>{const invoiceNo=$("#invNo").value.trim(),date=$("#invDate").value,customerCode=$("#invCustomer").value,status=$("#invStatus").value;if(!invoiceNo||!date||!customerCode||!lines.length)return toast("Invoice no, date, customer and SKU lines required");if(db.invoices.some(i=>i.invoiceNo===invoiceNo)&&!confirm("Invoice number already exists. Save anyway?"))return;db.invoices.push({id:id(),invoiceNo,date,customerCode,status,vehicle:$("#invVehicle").value.trim(),driver:$("#invDriver").value.trim(),lines:JSON.parse(JSON.stringify(lines)),cartons:lines.reduce((a,l)=>a+l.cartons,0),tonnage:lines.reduce((a,l)=>a+l.tonnage,0),total:lines.reduce((a,l)=>a+l.amount,0)});lines=[];["#invNo","#invVehicle","#invDriver"].forEach(s=>$(s).value="");persist();toast("Invoice saved")};

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
$("#exportCsv").onclick=()=>{const rows=[["Invoice No","Date","Customer Code","Customer Name","Status","Product Code","Product Name","Cartons","Pieces Per Carton","Total Pieces","Carton Weight KG","Tonnage","Price Basis","Selling Rate","Sales Amount","TP Price per Pc","SSSAP Amount","Atlas Price per Pc","SSS Price per Pc","Approval Expire Date"]];db.invoices.forEach(i=>i.lines.forEach(l=>{const tp=Number(l.tpPrice||0),sssapAmount=Number(l.pieces||0)*tp;rows.push([i.invoiceNo,i.date,i.customerCode,cName(i.customerCode),i.status,l.code,l.name,l.cartons,l.piecesPerCarton||0,l.pieces||0,l.cartonWeight,l.tonnage,l.priceBasis||"ton",l.rate,l.amount,tp,sssapAmount,l.atlasPrice||0,l.sssPrice||0,l.approvalExpiry||""])}));download("SUH-sales-"+today()+".csv",rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n"),"text/csv")};


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
 const out=[["Invoice No","Date","Customer Code","Customer Name","Product Code","Product Name","Net Cartons","Total Pieces","TP Price per Pc","SSSAP Amount","SSSAP Tonnage","Atlas Price per Pc","SSS Price per Pc","Approval Expire Date"]];
 rows.forEach(r=>{
   const inv=db.invoices.find(i=>i.invoiceNo===r.invoiceNo&&i.date===r.date),line=inv?inv.lines.find(l=>l.code===r.productCode):null;
   out.push([r.invoiceNo,r.date,r.customerCode,cName(r.customerCode),r.productCode,r.productName,r.cartons,r.pieces,r.tp,r.amount,r.tonnage,line?.atlasPrice||0,line?.sssPrice||0,line?.approvalExpiry||""]);
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

$("#backupData").onclick=()=>download("SUH-backup-"+today()+".json",JSON.stringify(db,null,2),"application/json");
$("#restoreData").onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{db=JSON.parse(r.result);persist();toast("Backup restored")}catch{toast("Invalid backup file")}};r.readAsText(f)};
function download(name,data,type){const a=document.createElement("a"),u=URL.createObjectURL(new Blob([data],{type}));a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),500)}

$("#importCustomers").onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{let n=0;r.result.split(/\r?\n/).slice(1).forEach(line=>{if(!line.trim())return;const parts=line.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g)||[];const [code,name,opening,phone,address,salesman]=parts.map(x=>x.trim().replace(/^"|"$/g,""));if(!code||!name)return;const obj={code,name,opening:Number((opening||"0").replace(/,/g,"")),phone:phone||"",address:address||"",salesman:salesman||""},i=db.customers.findIndex(c=>c.code===code);if(i>=0)db.customers[i]={...db.customers[i],...obj};else db.customers.push(obj);n++});persist();toast(n+" customers imported")};r.readAsText(f)};

["#invDate","#payDate","#retDate"].forEach(s=>$(s).value=today());$("#targetMonth").value=monthNow();$("#rFrom").value=monthNow()+"-01";$("#rTo").value=today();

let deferredPrompt;window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();deferredPrompt=e;$("#installBtn").classList.remove("hidden")});$("#installBtn").onclick=async()=>{if(!deferredPrompt)return;deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;$("#installBtn").classList.add("hidden")};
if("serviceWorker" in navigator)navigator.serviceWorker.register("sw.js");
renderAll();
