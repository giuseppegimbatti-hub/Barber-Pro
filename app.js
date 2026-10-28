const services={"Taglio e barba modellata":{prezzo:20,durata:1},"Taglio":{prezzo:15,durata:1},"Taglio e shampoo":{prezzo:20,durata:1},"Shampoo":{prezzo:7,durata:1},"Taglio bambini":{prezzo:12,durata:1},"Barba solo macchinetta":{prezzo:4,durata:1},"Barba modellata":{prezzo:8,durata:1},"Barba tipo rasoio":{prezzo:7,durata:2}};
const slots=[];for(let h=8;h<=21;h++){slots.push(`${String(h).padStart(2,'0')}:00`);if(h<21)slots.push(`${String(h).padStart(2,'0')}:30`)}
const $=id=>document.getElementById(id);const state={date:new Date(),appointments:[],clients:[],phones:{},communes:{}};
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
    state.appointments=data.appointments;state.clients=data.clients;state.phones=(data.phones&&typeof data.phones==='object'&&!Array.isArray(data.phones))?data.phones:{};state.communes=(data.communes&&typeof data.communes==='object'&&!Array.isArray(data.communes))?data.communes:{};
  }catch(err){
    console.error(err);window.archiveUnavailable=true;
    alert('ATTENZIONE: impossibile aprire l’archivio locale. Non inserire o modificare dati: verifica le impostazioni del browser e recupera un backup.');
  }
  updateBackupNotice();
}
function save(protect=false){
  if(window.archiveUnavailable){alert('Archivio non disponibile: modifiche non salvate.');return;}
  const snapshot=structuredClone({appointments:state.appointments,clients:state.clients,phones:state.phones,communes:state.communes});
  saveQueue=saveQueue.then(async()=>{await createLocalSnapshot(protect);await writeArchive(snapshot);}).catch(err=>{
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
function setView(name){document.querySelectorAll('.view,.nav-btn').forEach(e=>e.classList.remove('active'));$(name).classList.add('active');document.querySelector(`[data-view="${name}"]`).classList.add('active');$('pageTitle').textContent={agenda:'Agenda',clienti:'Clienti',report:'Gestionale',promemoria:'Promemoria WhatsApp'}[name];if(name==='report')renderReport();if(name==='promemoria')renderTomorrowReminders()}
// Festivita nazionali italiane, comprese Pasqua e Lunedi dell'Angelo.
function easterSunday(year){
 const a=year%19,b=Math.floor(year/100),c=year%100,d=Math.floor(b/4),e=b%4;
 const f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30;
 const i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k+7)%7;
 const m=Math.floor((a+11*h+22*l)/451),month=Math.floor((h+l-7*m+114)/31);
 const day=((h+l-7*m+114)%31)+1;return new Date(year,month-1,day);
}
function italianHoliday(date){
 const fixed={'01-01':'Capodanno','01-06':'Epifania','04-25':'Festa della Liberazione','05-01':'Festa del Lavoro','06-02':'Festa della Repubblica','08-15':'Ferragosto','11-01':'Ognissanti','12-08':'Immacolata Concezione','12-25':'Natale','12-26':'Santo Stefano'};
 const key=`${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
 if(fixed[key])return fixed[key];
 const easter=easterSunday(date.getFullYear());const easterMonday=new Date(easter);easterMonday.setDate(easter.getDate()+1);
 if(iso(date)===iso(easter))return 'Pasqua';if(iso(date)===iso(easterMonday))return 'Lunedi dell’Angelo';
 return '';
}
function renderWeek(){const base=startOfWeek(state.date);$('weekStrip').innerHTML='';['Lun','Mar','Mer','Gio','Ven','Sab','Dom'].forEach((n,i)=>{const d=new Date(base);d.setDate(base.getDate()+i);const b=document.createElement('button');const holiday=italianHoliday(d);const isSunday=d.getDay()===0;const isRestMonday=d.getDay()===1;const marked=holiday||isSunday||isRestMonday;const marker=holiday?'Festivo':isRestMonday?'Riposo':' ';b.className='day-pill'+(marked?' holiday':'')+(iso(d)===iso(state.date)?' active':'');if(marked){b.title=holiday||(isRestMonday?'Riposo settimanale':'Domenica');b.setAttribute('aria-label',`${n} ${d.getDate()}: ${b.title}`)}b.innerHTML=`<span>${n}</span><strong>${d.getDate()}</strong>${marked?'<small class="holiday-mark">'+marker+'</small>':''}`;b.onclick=()=>{state.date=d;renderAll()};$('weekStrip').appendChild(b)})}
let agendaMode='compact';
function renderAgenda(){
 const ds=iso(state.date);$('datePicker').value=ds;
 $('selectedDateLabel').textContent=state.date.toLocaleDateString('it-IT',{weekday:'long',day:'2-digit',month:'long',year:'numeric'});
 const grid=$('agendaGrid');grid.replaceChildren();
 const dayApps=state.appointments.filter(a=>a.date===ds);
 const busy=slots.filter(t=>dayApps.some(a=>a.time===t)).length;
 $('agendaSummary').textContent=`${slots.length-busy} orari liberi · ${busy} occupati · ${dayApps.length} appuntamenti`;
 $('compactAgendaBtn').classList.toggle('active-mode',agendaMode==='compact');
 $('detailAgendaBtn').classList.toggle('active-mode',agendaMode==='detail');
 grid.className=agendaMode==='compact'?'agenda-grid compact-grid':'agenda-grid';
 if(agendaMode==='compact'){
  for(const slot of slots){
   const apps=dayApps.filter(a=>a.time===slot);
   const b=document.createElement('button');b.type='button';b.className='compact-slot '+(apps.length?'occupied':'available');
   const time=document.createElement('strong');time.textContent=slot;
   const label=document.createElement('span');label.textContent=apps.length?`${apps.length} appuntament${apps.length===1?'o':'i'}`:'Libero';
   b.append(time,label);b.title=apps.length?apps.map(a=>a.client).join(', '):'Prenota alle '+slot;
   b.onclick=()=>{if(!apps.length){openAppointment({time:slot});return;}showSlotAppointments(slot,apps)};
   grid.appendChild(b);
  }
  return;
 }
 slots.forEach(slot=>{const apps=dayApps.filter(a=>a.time===slot);const row=document.createElement('div');row.className='slot';row.innerHTML=`<div class="slot-time">${slot}</div><div class="apps">${apps.length?apps.map(a=>`<div class="app-card" data-id="${escapeHtml(a.id)}"><b>${escapeHtml(a.client)}</b><br><span class="muted">${escapeHtml(a.service)} · ${euro(a.price)}</span></div>`).join(''):'<div class="empty">Libero</div>'}</div><button class="primary-btn">+ Prenota</button>`;row.querySelector('button').onclick=()=>openAppointment({time:slot});row.querySelectorAll('.app-card').forEach(c=>c.onclick=()=>openAppointment(state.appointments.find(a=>a.id===c.dataset.id)));grid.appendChild(row)});
}
function showSlotAppointments(time,apps){
 const grid=$('agendaGrid');const existing=$('slotQuickDetails');if(existing)existing.remove();
 const panel=document.createElement('div');panel.id='slotQuickDetails';panel.className='slot-quick-details card';
 const heading=document.createElement('h3');heading.textContent=`Ore ${time} · ${apps.length} appuntamenti`;panel.append(heading);
 for(const a of apps){const b=document.createElement('button');b.className='ghost-btn';b.textContent=`${a.client} · ${a.service}`;b.onclick=()=>openAppointment(a);panel.append(b)}
 const add=document.createElement('button');add.className='primary-btn';add.textContent='+ Aggiungi appuntamento';add.onclick=()=>openAppointment({time});panel.append(add);
 grid.before(panel);panel.scrollIntoView({behavior:'smooth',block:'nearest'});
}
function escapeHtml(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function clientKey(name){return normalizeClientName(name).toLocaleLowerCase('it-IT');}
function phoneFor(name){return state.phones[clientKey(name)]||'';}
function communeFor(name){return state.communes[clientKey(name)]||'';}
function normalizePhone(value){let v=String(value||'').replace(/[^+\d]/g,'');if(v.startsWith('00'))v='+'+v.slice(2);if(/^3\d{9}$/.test(v))v='+39'+v;return /^\+?\d{8,15}$/.test(v)?v:'';}
function whatsappLink(phone,message){const p=normalizePhone(phone).replace(/^\+/,'');return p?'https://wa.me/'+p+'?text='+encodeURIComponent(message):'';}
function openWhatsApp(app){const phone=phoneFor(app.client);if(!normalizePhone(phone)){alert('Inserisci prima un numero di cellulare valido nella scheda del cliente.');return;}const d=new Date(app.date+'T12:00:00');const day=d.toLocaleDateString('it-IT',{weekday:'long',day:'numeric',month:'long'});const msg=`Ciao ${app.client}! 💈 Ti ricordiamo il tuo appuntamento per ${day} alle ${app.time}. Ti aspettiamo!`;window.open(whatsappLink(phone,msg),'_blank','noopener,noreferrer');}
function renderTomorrowReminders(){const el=$('tomorrowReminders');if(!el)return;const tomorrow=new Date();tomorrow.setDate(tomorrow.getDate()+1);const apps=state.appointments.filter(a=>a.date===iso(tomorrow)).sort((a,b)=>a.time.localeCompare(b.time));el.replaceChildren();if(!apps.length){el.textContent='Nessun appuntamento per domani.';return;}for(const a of apps){const row=document.createElement('div');row.className='reminder-row';const label=document.createElement('span');label.textContent=a.time+' · '+a.client;const btn=document.createElement('button');btn.className='ghost-btn';btn.textContent='💬 WhatsApp';btn.disabled=!normalizePhone(phoneFor(a.client));btn.title=btn.disabled?'Aggiungi il cellulare nella sezione Clienti':'';btn.onclick=()=>openWhatsApp(a);row.append(label,btn);el.append(row);}}
function renderClients(){
 const list=$('clientList');list.replaceChildren();const allClientNames=[...state.clients];
 [...state.clients].sort((a,b)=>a.localeCompare(b,'it')).forEach(c=>{
  const key=clientKey(c),apps=state.appointments.filter(a=>clientKey(a.client)===key);
  const total=apps.reduce((sum,a)=>sum+Number(a.price||0),0);
  const r=document.createElement('div');r.className='client-row';
  const info=document.createElement('div');info.className='client-info';const title=document.createElement('strong');title.textContent=c;
  const visits=document.createElement('span');visits.textContent=apps.length+' visite · '+euro(total);info.append(title,visits);
  const comune=document.createElement('input');comune.placeholder='Comune di residenza';comune.value=communeFor(c);comune.setAttribute('aria-label','Comune di '+c);
  comune.onchange=()=>{const value=comune.value.trim();if(value)state.communes[key]=value;else delete state.communes[key];save()};
  const phone=document.createElement('input');phone.type='tel';phone.placeholder='Cellulare';phone.value=phoneFor(c);phone.setAttribute('aria-label','Cellulare di '+c);
  const wa=document.createElement('button');wa.className='ghost-btn';wa.textContent='💬 WhatsApp';wa.disabled=!phoneFor(c);wa.title='Apri una conversazione WhatsApp';
  phone.onchange=()=>{const raw=phone.value.trim(),v=normalizePhone(raw);if(raw&&!v){alert('Numero non valido: inserisci un numero italiano o internazionale, ad esempio +393331234567.');phone.value=phoneFor(c);return;}if(v)state.phones[key]=v;else delete state.phones[key];wa.disabled=!v;save();renderTomorrowReminders();};
  wa.onclick=()=>{const link=whatsappLink(phoneFor(c),'Ciao '+c+'! 💈');if(link)window.open(link,'_blank','noopener,noreferrer')};
  const del=document.createElement('button');del.className='danger-btn';del.textContent='Elimina';del.onclick=()=>{if(confirm(`Eliminare ${c}? Gli appuntamenti esistenti non saranno eliminati.`)){state.clients=state.clients.filter(x=>x!==c);delete state.phones[key];delete state.communes[key];save(true);renderAll()}};
  r.append(info,comune,phone,wa,del);list.appendChild(r);
 });
 $('clientSuggestions').replaceChildren();allClientNames.sort((a,b)=>a.localeCompare(b,'it')).forEach(c=>{const opt=document.createElement('option');opt.value=c;$('clientSuggestions').append(opt)});
}

function renderStats(){}
function openAppointment(app){const isEdit=!!app.id;$('appointmentTitle').textContent=isEdit?'Modifica appuntamento':'Nuovo appuntamento';$('editingAppointmentId').value=app.id||'';$('appointmentClient').value=app.client||'';$('appointmentTime').value=app.time||'08:00';$('appointmentService').innerHTML=Object.keys(services).map(s=>`<option ${s===(app.service||'Taglio')?'selected':''}>${s}</option>`).join('');const selectedService=app.service||'Taglio';const defaultPrice=services[selectedService]?.prezzo??0;$('appointmentCustomPrice').value=(isEdit&&Number(app.price||0)!==Number(defaultPrice))?String(app.price):'';$('appointmentNotes').value=app.notes||'';$('appointmentPhone').value=phoneFor(app.client||'');$('whatsappAppointmentBtn').classList.toggle('hidden',!isEdit);$('whatsappAppointmentBtn').onclick=()=>openWhatsApp(app);$('appointmentCustomPrice').placeholder=`Lascia vuoto per usare ${euro(defaultPrice)}`;$('appointmentService').onchange=()=>{$('appointmentCustomPrice').placeholder=`Lascia vuoto per usare ${euro(services[$('appointmentService').value].prezzo)}`};$('deleteAppointmentBtn').classList.toggle('hidden',!isEdit);$('appointmentDialog').showModal()}

function closeAppointmentDialog(){
  $('appointmentDialog').close();
  
  
  
}
$('closeAppointmentDialog').onclick=closeAppointmentDialog;
$('cancelAppointmentBtn').onclick=closeAppointmentDialog;
$('appointmentDialog').addEventListener('click',e=>{if(e.target===$('appointmentDialog'))closeAppointmentDialog()});
$('appointmentDialog').addEventListener('cancel',e=>{e.preventDefault();closeAppointmentDialog()});
function normalizeClientName(name){const clean=name.trim().replace(/\s+/g,' ');return clean?clean[0].toUpperCase()+clean.slice(1):''}
$('appointmentClient').addEventListener('change',()=>{$('appointmentPhone').value=phoneFor($('appointmentClient').value)});
$('appointmentForm').addEventListener('submit',e=>{e.preventDefault();const id=$('editingAppointmentId').value||uid();const service=$('appointmentService').value;const client=normalizeClientName($('appointmentClient').value);if(!client)return;const customRaw=String($('appointmentCustomPrice').value||'').replace(',','.').trim();const customPrice=customRaw===''?null:Number(customRaw);const finalPrice=customPrice!==null&&!Number.isNaN(customPrice)?customPrice:services[service].prezzo;const obj={id,client,service,time:$('appointmentTime').value,price:finalPrice,notes:$('appointmentNotes').value.trim(),date:iso(state.date)};const idx=state.appointments.findIndex(a=>a.id===id);idx>=0?state.appointments[idx]=obj:state.appointments.push(obj);if(!state.clients.some(c=>c.toLowerCase()===obj.client.toLowerCase()))state.clients.push(obj.client);const phoneRaw=$('appointmentPhone').value.trim();if(phoneRaw){const phone=normalizePhone(phoneRaw);if(!phone){alert('Numero di cellulare non valido.');return;}state.phones[clientKey(obj.client)]=phone;}save();$('appointmentDialog').close();renderAll()});
$('deleteAppointmentBtn').onclick=()=>{const id=$('editingAppointmentId').value;if(confirm('Eliminare questo appuntamento?')){state.appointments=state.appointments.filter(a=>a.id!==id);save(true);$('appointmentDialog').close();renderAll()}};
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

function renderAll(){renderWeek();renderAgenda();renderClients();renderTomorrowReminders();renderStats();renderReport()}
$('compactAgendaBtn').onclick=()=>{agendaMode='compact';renderAgenda()};$('detailAgendaBtn').onclick=()=>{agendaMode='detail';renderAgenda()};document.querySelectorAll('.nav-btn').forEach(b=>b.onclick=()=>setView(b.dataset.view));$('prevWeek').onclick=()=>{state.date.setDate(state.date.getDate()-7);renderAll()};$('nextWeek').onclick=()=>{state.date.setDate(state.date.getDate()+7);renderAll()};$('datePicker').onchange=e=>{state.date=new Date(e.target.value);renderAll()};$('reportDate').value=iso(new Date());$('periodFilter').onchange=renderReport;$('reportDate').onchange=renderReport;$('printReportBtn').onclick=()=>window.print();$('printClientRankingBtn').onclick=printClientRanking;$('addClientBtn').onclick=()=>{const n=normalizeClientName($('newClientName').value);const raw=$('newClientPhone').value.trim();const phone=normalizePhone(raw);if(!n){alert('Inserisci il nome del cliente.');return;}if(state.clients.some(c=>clientKey(c)===clientKey(n))){alert('Cliente già presente: modifica i dati nella scheda sottostante.');return;}if(raw&&!phone){alert('Numero di cellulare non valido.');return;}state.clients.push(n);if(phone)state.phones[clientKey(n)]=phone;const comune=$('newClientCommune').value.trim();if(comune)state.communes[clientKey(n)]=comune;['newClientName','newClientPhone','newClientCommune'].forEach(id=>$(id).value='');save();renderAll()};
$('importClientsFile').onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{importClientsFromJsonText(r.result)}catch(err){alert('File clienti JSON non valido. Deve contenere una lista di nomi, oppure {clients:[...]} / {clienti:[...]}')}};r.readAsText(f);e.target.value=''};
$('exportBtn').onclick=async()=>{
  await saveQueue;
  const data={format:'barber-pro-backup',version:2,exportedAt:new Date().toISOString(),appointments:state.appointments,clients:state.clients,phones:state.phones,communes:state.communes};
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

// Copie automatiche locali nello stesso IndexedDB, distinte dall'archivio principale.
// Proteggono da errori logici, NON da cancellazione dell'archivio del browser.
// Una copia al giorno, conservata per 30 giorni, più copie protette prima delle cancellazioni.
// Le copie sono nello stesso archivio del browser: non sostituiscono un backup esterno.
async function createLocalSnapshot(force=false){
 const db=await openDb();const now=Date.now();const day=iso(new Date(now));
 const key='snapshot-'+day+(force?'-protected-'+now+'-'+Math.random().toString(36).slice(2,7):'');
 const data=await readArchive();if(!data)return;
 return new Promise((resolve,reject)=>{const tx=db.transaction('archive','readwrite');const store=tx.objectStore('archive');
 const put=()=>store.put({createdAt:new Date(now).toISOString(),data},key);
 if(force)put();else {const get=store.get(key);get.onsuccess=()=>{if(!get.result)put()};}
 tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
 });
}
async function listLocalSnapshots(){const db=await openDb();return new Promise((resolve,reject)=>{const tx=db.transaction('archive','readonly');const req=tx.objectStore('archive').getAllKeys();req.onsuccess=()=>resolve(req.result.filter(k=>String(k).startsWith('snapshot-')).sort().reverse());req.onerror=()=>reject(req.error);});}
async function cleanLocalSnapshots(){
 const keys=await listLocalSnapshots();const cutoff=Date.now()-30*24*60*60*1000;
 const daily=keys.filter(k=>!String(k).includes('-protected-'));
 const protectedKeys=keys.filter(k=>String(k).includes('-protected-'));
 const remove=[...daily.filter(k=>{const date=String(k).slice(9,19);return !/^\d{4}-\d{2}-\d{2}$/.test(date)||new Date(date+'T23:59:59').getTime()<cutoff;}),...protectedKeys.slice(30)];
 if(!remove.length)return;const db=await openDb();await new Promise((resolve,reject)=>{const tx=db.transaction('archive','readwrite');for(const key of remove)tx.objectStore('archive').delete(key);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});
}
async function restoreLocalSnapshot(key){const db=await openDb();const record=await new Promise((resolve,reject)=>{const req=db.transaction('archive','readonly').objectStore('archive').get(key);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)});if(!record||!record.data||!Array.isArray(record.data.appointments)||!Array.isArray(record.data.clients))throw Error('Copia non valida');if(!confirm('Ripristinare la copia '+key+'? I dati attuali verranno sostituiti. Esporta prima un backup esterno.'))return;await saveQueue;await createLocalSnapshot(true);state.appointments=record.data.appointments;state.clients=record.data.clients;state.phones=record.data.phones||{};state.communes=record.data.communes||{};save();await saveQueue;renderAll();alert('Copia locale ripristinata.');}
$('restoreLocalBtn').onclick=async()=>{try{const keys=await listLocalSnapshots();const el=$('localBackupList');el.replaceChildren();if(!keys.length){el.textContent='Nessuna copia locale disponibile.';return;}for(const key of keys){const btn=document.createElement('button');btn.className='ghost-btn';btn.textContent='Ripristina '+key.replace('snapshot-','');btn.onclick=()=>restoreLocalSnapshot(key).catch(e=>alert(e.message));el.append(btn);}}catch(e){alert('Impossibile leggere le copie locali: '+e.message)}};
// Parser vCard 3/4: supporto base a FN, N e TEL, linee ripiegate.
function parseVcf(text){const cards=String(text).replace(/\r\n/g,'\n').replace(/\r/g,'\n').replace(/\n[ \t]/g,'').split(/BEGIN:VCARD/i).slice(1);const out=[];for(const card of cards){const body=card.split(/END:VCARD/i)[0];const lines=body.split('\n');let name='',fallback='',phone='';for(const line of lines){const idx=line.indexOf(':');if(idx<0)continue;const field=line.slice(0,idx).toUpperCase().split(';')[0].replace(/^ITEM\d+\./,'');const value=line.slice(idx+1).replace(/\\n/gi,' ').replace(/\\,/g,',').trim();if(field==='FN')name=value;else if(field==='N')fallback=value.split(';').filter(Boolean).reverse().join(' ');else if(field==='TEL'&&!phone)phone=normalizePhone(value.replace(/^tel:/i,''));}if(name||fallback)out.push({name:normalizeClientName(name||fallback),phone});}return out;}
$('importVcfFile').onchange=async e=>{const f=e.target.files?.[0];e.target.value='';if(!f)return;try{const entries=parseVcf(await f.text());if(!entries.length)throw Error('Nessun contatto riconosciuto. Esporta i contatti in formato vCard (.vcf).');if(!confirm('Importare '+entries.length+' contatti? I nomi già presenti verranno mantenuti; i cellulari esistenti non saranno sovrascritti.'))return;let added=0,numbers=0;for(const entry of entries){if(!state.clients.some(c=>clientKey(c)===clientKey(entry.name))){state.clients.push(entry.name);added++;}const key=clientKey(entry.name);if(entry.phone&&!state.phones[key]){state.phones[key]=entry.phone;numbers++;}}save();await saveQueue;renderAll();$('contactImportStatus').textContent=`Importati ${added} nuovi clienti e ${numbers} numeri. Controlla eventuali omonimi.`;}catch(err){alert('Importazione VCF non riuscita: '+err.message)}};

load().then(async()=>{renderAll();if(!window.archiveUnavailable){try{await createLocalSnapshot();await cleanLocalSnapshots();}catch(e){console.error('Backup locale:',e);}}});

$('restoreBackupFile').onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=async()=>{try{const d=JSON.parse(r.result);if(!Array.isArray(d.appointments)||!Array.isArray(d.clients)||!d.appointments.every(a=>a&&typeof a==='object'&&typeof a.id==='string'&&typeof a.date==='string')||!d.clients.every(c=>typeof c==='string'))throw Error('Formato errato');if(!confirm('Ripristinare il backup? I dati attualmente salvati su questo dispositivo verranno sostituiti.'))return;await saveQueue;await createLocalSnapshot(true);state.appointments=d.appointments;state.clients=d.clients;state.phones=(d.phones&&typeof d.phones==='object'&&!Array.isArray(d.phones))?d.phones:{};state.communes=(d.communes&&typeof d.communes==='object'&&!Array.isArray(d.communes))?d.communes:{};save();await saveQueue;renderAll();alert('Backup ripristinato correttamente.')}catch(err){alert('Backup non valido: è necessario un file esportato da Barber Pro.')}};r.readAsText(f);e.target.value='';};
