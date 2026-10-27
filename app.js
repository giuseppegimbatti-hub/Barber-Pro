const services={"Taglio e barba modellata":{prezzo:20,durata:1},"Taglio":{prezzo:15,durata:1},"Taglio e shampoo":{prezzo:20,durata:1},"Shampoo":{prezzo:7,durata:1},"Taglio bambini":{prezzo:12,durata:1},"Barba solo macchinetta":{prezzo:4,durata:1},"Barba modellata":{prezzo:8,durata:1},"Barba tipo rasoio":{prezzo:7,durata:2}};
const slots=[];for(let h=8;h<=21;h++){slots.push(`${String(h).padStart(2,'0')}:00`);if(h<21)slots.push(`${String(h).padStart(2,'0')}:30`)}
const $=id=>document.getElementById(id);const state={date:new Date(),appointments:[],clients:[]};
function iso(d){return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10)}function euro(n){const v=Number(n||0);return `${Number.isInteger(v)?v.toFixed(0):v.toFixed(2)}€`}function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2)}
// Archivio IndexedDB persistente; importazione automatica dai vecchi dati localStorage.
const DB_NAME='barber-pro-ipad-v1';
let dbPromise;
function openDb(){
  if(!('indexedDB' in window))return Promise.reject(new Error('IndexedDB non disponibile'));
  if(!dbPromise)dbPromise=new Promise((resolve,reject)=>{
    const req=indexedDB.open(DB_NAME,1);
    req.onupgradeneeded=()=>req.result.createObjectStore('archive');
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error);
  });
  return dbPromise;
}
async function readArchive(){
  const db=await openDb();return new Promise((resolve,reject)=>{
    const req=db.transaction('archive','readonly').objectStore('archive').get('main');
    req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
  });
}
async function writeArchive(data){
  const db=await openDb();return new Promise((resolve,reject)=>{
    const tx=db.transaction('archive','readwrite');tx.objectStore('archive').put(data,'main');
    tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
  });
}
let saveQueue=Promise.resolve();
async function load(){
  try{
    let data=await readArchive();
    if(!data){
      data=JSON.parse(localStorage.getItem('barber-pro-data')||'null');
      if(!data)data={appointments:JSON.parse(localStorage.getItem('appointments')||'[]'),clients:JSON.parse(localStorage.getItem('clients')||'[]')};
      if(!Array.isArray(data.appointments)||!Array.isArray(data.clients))throw Error('Archivio non valido');
      await writeArchive(data);
    }
    if(!Array.isArray(data.appointments)||!Array.isArray(data.clients))throw Error('Archivio non valido');
    state.appointments=data.appointments;state.clients=data.clients;
  }catch(err){
    console.error(err);window.archiveUnavailable=true;
    alert('ATTENZIONE: impossibile aprire l’archivio locale. Non inserire o modificare dati: verifica le impostazioni del browser e recupera un backup.');
  }
  updateBackupNotice();
}
function save(){
  if(window.archiveUnavailable){alert('Archivio non disponibile: modifiche non salvate.');return;}
  const snapshot=structuredClone({appointments:state.appointments,clients:state.clients});
  saveQueue=saveQueue.then(()=>writeArchive(snapshot)).catch(err=>{
    console.error(err);window.archiveUnavailable=true;
    alert('ERRORE: i dati non sono stati salvati. Esporta subito un backup e non continuare a lavorare prima di risolvere il problema.');
  });
}
function updateBackupNotice(){
  const el=$('backupNotice');if(!el)return;
  const stamp=Number(localStorage.getItem('barber-last-external-backup')||0);
  const old=!stamp||Date.now()-stamp>24*60*60*1000;
  el.textContent=old?'⚠️ Backup esterno da effettuare: esporta il file e salvalo in File → iCloud Drive.':'✓ Ultimo backup esportato: '+new Date(stamp).toLocaleString('it-IT');
  el.style.display='block';
}
function startOfWeek(d){const x=new Date(d);const day=(x.getDay()+6)%7;x.setDate(x.getDate()-day);x.setHours(0,0,0,0);return x}
function setView(name){document.querySelectorAll('.view,.nav-btn').forEach(e=>e.classList.remove('active'));$(name).classList.add('active');document.querySelector(`[data-view="${name}"]`).classList.add('active');$('pageTitle').textContent={agenda:'Agenda',clienti:'Clienti',report:'Gestionale'}[name];if(name==='report')renderReport()}
function renderWeek(){const base=startOfWeek(state.date);$('weekStrip').innerHTML='';['Lun','Mar','Mer','Gio','Ven','Sab','Dom'].forEach((n,i)=>{const d=new Date(base);d.setDate(base.getDate()+i);const b=document.createElement('button');b.className='day-pill'+(iso(d)===iso(state.date)?' active':'');b.innerHTML=`<span>${n}</span><strong>${d.getDate()}</strong>`;b.onclick=()=>{state.date=d;renderAll()};$('weekStrip').appendChild(b)})}
function renderAgenda(){const ds=iso(state.date);$('datePicker').value=ds;$('selectedDateLabel').textContent=state.date.toLocaleDateString('it-IT',{weekday:'long',day:'2-digit',month:'long',year:'numeric'});$('agendaGrid').innerHTML='';slots.forEach(slot=>{const apps=state.appointments.filter(a=>a.date===ds&&a.time===slot);const row=document.createElement('div');row.className='slot';row.innerHTML=`<div class="slot-time">${slot}</div><div class="apps">${apps.length?apps.map(a=>`<div class="app-card" data-id="${a.id}"><b>${a.client}</b><br><span class="muted">${a.service} · ${euro(a.price)}</span></div>`).join(''):'<div class="empty">Libero</div>'}</div><button class="primary-btn">+ Prenota</button>`;row.querySelector('button').onclick=()=>openAppointment({time:slot});row.querySelectorAll('.app-card').forEach(c=>c.onclick=()=>openAppointment(state.appointments.find(a=>a.id===c.dataset.id)));$('agendaGrid').appendChild(row)})}
function renderClients(){const list=$('clientList');list.innerHTML='';const allClientNames=[...state.clients];[...state.clients].sort((a,b)=>a.localeCompare(b,'it')).forEach(c=>{const apps=state.appointments.filter(a=>a.client.toLowerCase()===c.toLowerCase());const total=apps.reduce((sum,a)=>sum+Number(a.price||0),0);const r=document.createElement('div');r.className='client-row';r.innerHTML=`<strong>${c}</strong><span>${apps.length} visite</span><span>${euro(total)}</span><button class="danger-btn">Elimina</button>`;r.querySelector('button').onclick=()=>{if(confirm(`Eliminare ${c}?`)){state.clients=state.clients.filter(x=>x!==c);save();renderAll()}};list.appendChild(r)});$('clientSuggestions').innerHTML=allClientNames.sort((a,b)=>a.localeCompare(b,'it')).map(c=>`<option value="${c}"></option>`).join('')}
function renderStats(){}
function openAppointment(app){const isEdit=!!app.id;$('appointmentTitle').textContent=isEdit?'Modifica appuntamento':'Nuovo appuntamento';$('editingAppointmentId').value=app.id||'';$('appointmentClient').value=app.client||'';$('appointmentTime').value=app.time||'08:00';$('appointmentService').innerHTML=Object.keys(services).map(s=>`<option ${s===(app.service||'Taglio')?'selected':''}>${s}</option>`).join('');const selectedService=app.service||'Taglio';const defaultPrice=services[selectedService]?.prezzo??0;$('appointmentCustomPrice').value=(isEdit&&Number(app.price||0)!==Number(defaultPrice))?String(app.price):'';$('appointmentNotes').value=app.notes||'';$('appointmentCustomPrice').placeholder=`Lascia vuoto per usare ${euro(defaultPrice)}`;$('appointmentService').onchange=()=>{$('appointmentCustomPrice').placeholder=`Lascia vuoto per usare ${euro(services[$('appointmentService').value].prezzo)}`};$('deleteAppointmentBtn').classList.toggle('hidden',!isEdit);$('appointmentDialog').showModal()}

function closeAppointmentDialog(){
  $('appointmentDialog').close();
  
  
  
}
$('closeAppointmentDialog').onclick=closeAppointmentDialog;
$('cancelAppointmentBtn').onclick=closeAppointmentDialog;
$('appointmentDialog').addEventListener('click',e=>{if(e.target===$('appointmentDialog'))closeAppointmentDialog()});
$('appointmentDialog').addEventListener('cancel',e=>{e.preventDefault();closeAppointmentDialog()});
function normalizeClientName(name){const clean=name.trim().replace(/\s+/g,' ');return clean?clean[0].toUpperCase()+clean.slice(1):''}
$('appointmentForm').addEventListener('submit',e=>{e.preventDefault();const id=$('editingAppointmentId').value||uid();const service=$('appointmentService').value;const client=normalizeClientName($('appointmentClient').value);if(!client)return;const customRaw=String($('appointmentCustomPrice').value||'').replace(',','.').trim();const customPrice=customRaw===''?null:Number(customRaw);const finalPrice=customPrice!==null&&!Number.isNaN(customPrice)?customPrice:services[service].prezzo;const obj={id,client,service,time:$('appointmentTime').value,price:finalPrice,notes:$('appointmentNotes').value.trim(),date:iso(state.date)};const idx=state.appointments.findIndex(a=>a.id===id);idx>=0?state.appointments[idx]=obj:state.appointments.push(obj);if(!state.clients.some(c=>c.toLowerCase()===obj.client.toLowerCase()))state.clients.push(obj.client);save();$('appointmentDialog').close();renderAll()});
$('deleteAppointmentBtn').onclick=()=>{const id=$('editingAppointmentId').value;if(confirm('Eliminare questo appuntamento?')){state.appointments=state.appointments.filter(a=>a.id!==id);save();$('appointmentDialog').close();renderAll()}};
function periodRange(type,ref){const d=new Date(ref);let start,end;if(type==='day'){start=new Date(d.getFullYear(),d.getMonth(),d.getDate());end=new Date(start);end.setDate(start.getDate()+1)}else if(type==='week'){start=startOfWeek(d);end=new Date(start);end.setDate(start.getDate()+7)}else if(type==='month'){start=new Date(d.getFullYear(),d.getMonth(),1);end=new Date(d.getFullYear(),d.getMonth()+1,1)}else if(type==='year'){start=new Date(d.getFullYear(),0,1);end=new Date(d.getFullYear()+1,0,1)}else{return [null,null]}return [iso(start),iso(end)]}
function periodLabel(type,s,e,ref){
  if(type==='all')return 'Sempre';
  const d=new Date(ref);
  if(type==='day')return d.toLocaleDateString('it-IT',{weekday:'long',day:'2-digit',month:'long',year:'numeric'});
  if(type==='week')return `Settimana ${s} / ${new Date(new Date(e).getTime()-86400000).toISOString().slice(0,10)}`;
  if(type==='month')return d.toLocaleDateString('it-IT',{month:'long',year:'numeric'});
  if(type==='year')return String(d.getFullYear());
  return `${s||''} ${e||''}`;
}
function getFilteredReportData(){
  const type=$('periodFilter').value;
  const ref=$('reportDate').value?new Date($('reportDate').value):new Date();
  const [s,e]=periodRange(type,ref);
  const apps=state.appointments.filter(a=>!s||(a.date>=s&&a.date<e));
  const total=apps.reduce((x,a)=>x+Number(a.price||0),0);
  const byClient={};
  apps.forEach(a=>{
    if(!byClient[a.client])byClient[a.client]={client:a.client,spent:0,visits:0};
    byClient[a.client].spent+=Number(a.price||0);
    byClient[a.client].visits+=1;
  });
  const ranking=Object.values(byClient).sort((a,b)=>b.spent-a.spent||b.visits-a.visits||a.client.localeCompare(b.client));
  const rankingVisits=[...ranking].sort((a,b)=>b.visits-a.visits||b.spent-a.spent||a.client.localeCompare(b.client));
  return {type,ref,s,e,apps,total,ranking,rankingVisits,label:periodLabel(type,s,e,ref)};
}
function renderReport(){
  const data=getFilteredReportData();
  const clients=data.ranking.length;
  $('metricIncome').textContent=euro(data.total);
  $('metricCount').textContent=data.apps.length;
  $('metricClients').textContent=clients;
  const rows=data.ranking.map((r,i)=>`<tr><td>${i+1}</td><td>${r.client}</td><td>${r.visits}</td><td>${euro(r.spent)}</td></tr>`).join('');
  $('clientRanking').innerHTML=`<h3>Classifica clienti</h3><p class="muted">Periodo: ${data.label}</p><div class="ranking-table-wrap"><table class="ranking-table"><thead><tr><th>#</th><th>Cliente</th><th>Visite</th><th>Spesa totale</th></tr></thead><tbody>${rows||'<tr><td colspan="4">Nessun dato nel periodo selezionato</td></tr>'}</tbody></table></div>`;
  $('reportText').textContent=`REPORT BARBER PRO
Periodo: ${data.label}

Incasso totale: ${euro(data.total)}
Appuntamenti: ${data.apps.length}
Clienti diversi: ${clients}

CLASSIFICA CLIENTI PER SPESA
`+
    (data.ranking.length?data.ranking.map((r,i)=>`${i+1}. ${r.client}: ${euro(r.spent)} - ${r.visits} visite`).join('\\n'):'Nessun dato')+
    `

CLASSIFICA CLIENTI PER NUMERO VISITE
`+
    (data.rankingVisits.length?data.rankingVisits.map((r,i)=>`${i+1}. ${r.client}: ${r.visits} visite - ${euro(r.spent)}`).join('\\n'):'Nessun dato');
}
function buildClientRankingHtml(){
  const data=getFilteredReportData();
  const rows=data.ranking.map((r,i)=>`<tr><td>${i+1}</td><td>${r.client}</td><td>${r.visits}</td><td>${euro(r.spent)}</td></tr>`).join('')||'<tr><td colspan="4">Nessun dato nel periodo selezionato</td></tr>';
  return `<!doctype html><html lang="it"><head><meta charset="utf-8"><title>Classifica clienti</title><style>body{font-family:Arial,sans-serif;padding:28px;color:#111}h1{margin:0 0 6px}p{margin:4px 0 18px;color:#444}.summary{display:flex;gap:12px;margin:18px 0}.box{border:1px solid #ddd;border-radius:12px;padding:12px 18px}.box strong{display:block;font-size:22px}table{width:100%;border-collapse:collapse;margin-top:16px}th,td{border-bottom:1px solid #ddd;text-align:left;padding:10px}th{background:#f3f4f6}td:nth-child(1),td:nth-child(3),td:nth-child(4){text-align:right}.footer{margin-top:24px;font-size:12px;color:#666}@media print{body{padding:0}}</style></head><body><h1>Classifica clienti</h1><p>Periodo: ${data.label}</p><div class="summary"><div class="box">Incasso<strong>${euro(data.total)}</strong></div><div class="box">Appuntamenti<strong>${data.apps.length}</strong></div><div class="box">Clienti<strong>${data.ranking.length}</strong></div></div><table><thead><tr><th>#</th><th>Cliente</th><th>Visite</th><th>Spesa totale</th></tr></thead><tbody>${rows}</tbody></table><div class="footer">Report generato da Barber Pro Studio</div><script>window.onload=()=>setTimeout(()=>window.print(),250)<\/script></body></html>`;
}
function printClientRanking(){
  const w=window.open('','_blank');
  if(!w){alert('Il browser ha bloccato la finestra di stampa. Consenti i popup e riprova.');return;}
  w.document.open();w.document.write(buildClientRankingHtml());w.document.close();
}

function normalizeImportedClientName(value){
  if(typeof value==='string')return value.trim();
  if(value&&typeof value==='object')return String(value.nome||value.name||value.cliente||value.client||value.fullName||'').trim();
  return '';
}
function importClientsFromJsonText(text){
  const parsed=JSON.parse(text);
  let raw=[];
  if(Array.isArray(parsed))raw=parsed;
  else if(parsed&&Array.isArray(parsed.clients))raw=parsed.clients;
  else if(parsed&&Array.isArray(parsed.clienti))raw=parsed.clienti;
  else throw new Error('Formato non valido');
  const before=state.clients.length;
  const existing=new Set(state.clients.map(c=>c.toLowerCase().trim()));
  let added=0, skipped=0;
  raw.forEach(item=>{
    const name=normalizeImportedClientName(item);
    if(!name){skipped++;return;}
    const key=name.toLowerCase().trim();
    if(existing.has(key)){skipped++;return;}
    state.clients.push(name);
    existing.add(key);
    added++;
  });
  state.clients.sort((a,b)=>a.localeCompare(b,'it'));
  save();
  renderAll();
  setView('clienti');
  alert(`Importazione completata\nClienti aggiunti: ${added}\nDuplicati/non validi saltati: ${skipped}\nTotale clienti: ${state.clients.length}`);
}

function renderAll(){renderWeek();renderAgenda();renderClients();renderStats();renderReport()}
document.querySelectorAll('.nav-btn').forEach(b=>b.onclick=()=>setView(b.dataset.view));$('prevWeek').onclick=()=>{state.date.setDate(state.date.getDate()-7);renderAll()};$('nextWeek').onclick=()=>{state.date.setDate(state.date.getDate()+7);renderAll()};$('datePicker').onchange=e=>{state.date=new Date(e.target.value);renderAll()};$('reportDate').value=iso(new Date());$('periodFilter').onchange=renderReport;$('reportDate').onchange=renderReport;$('printReportBtn').onclick=()=>window.print();$('printClientRankingBtn').onclick=printClientRanking;$('addClientBtn').onclick=()=>{const n=$('newClientName').value.trim();if(n&&!state.clients.some(c=>c.toLowerCase()===n.toLowerCase())){state.clients.push(n[0].toUpperCase()+n.slice(1));$('newClientName').value='';save();renderAll()}};
$('importClientsFile').onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{importClientsFromJsonText(r.result)}catch(err){alert('File clienti JSON non valido. Deve contenere una lista di nomi, oppure {clients:[...]} / {clienti:[...]}')}};r.readAsText(f);e.target.value=''};
$('exportBtn').onclick=async()=>{
  await saveQueue;
  const data={format:'barber-pro-backup',version:2,exportedAt:new Date().toISOString(),appointments:state.appointments,clients:state.clients};
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;
  a.download='barber-pro-backup-'+iso(new Date())+'.json';document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),60000);
  // L'esportazione non garantisce che il file sia stato effettivamente salvato su iCloud.
  if(confirm('Hai salvato il file di backup nell’app File, preferibilmente in iCloud Drive? Premi OK solo dopo aver verificato.')){
    localStorage.setItem('barber-last-external-backup',String(Date.now()));updateBackupNotice();
  }
};
let deferredInstall;window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstall=e;$('installBtn').classList.remove('hidden')});$('installBtn').onclick=async()=>{if(deferredInstall){deferredInstall.prompt();deferredInstall=null;$('installBtn').classList.add('hidden')}};
if('serviceWorker'in navigator){navigator.serviceWorker.register('service-worker.js').then(()=>navigator.serviceWorker.ready.then(r=>r.update())).catch(()=>{})}
load().then(()=>{renderAll();});

$('restoreBackupFile').onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{const d=JSON.parse(r.result);if(!Array.isArray(d.appointments)||!Array.isArray(d.clients)||!d.appointments.every(a=>a&&typeof a==='object'&&typeof a.id==='string'&&typeof a.date==='string')||!d.clients.every(c=>typeof c==='string'))throw Error('Formato errato');if(!confirm('Ripristinare il backup? I dati attualmente salvati su questo dispositivo verranno sostituiti.'))return;state.appointments=d.appointments;state.clients=d.clients;save();renderAll();alert('Backup ripristinato correttamente.')}catch(err){alert('Backup non valido: è necessario un file esportato da Barber Pro.')}};r.readAsText(f);e.target.value='';};
