const DEFAULT_SERVICES={"Taglio e barba modellata":{prezzo:20,durata:1},"Taglio":{prezzo:15,durata:1},"Taglio e shampoo":{prezzo:20,durata:1},"Shampoo":{prezzo:7,durata:1},"Taglio bambini":{prezzo:12,durata:1},"Barba solo macchinetta":{prezzo:4,durata:1},"Barba modellata":{prezzo:8,durata:1},"Barba tipo rasoio":{prezzo:7,durata:2}};
let services=structuredClone(DEFAULT_SERVICES);
const DEFAULT_APP_NAME='Barber Pro';
const slots=[];for(let h=8;h<=21;h++){slots.push(`${String(h).padStart(2,'0')}:00`);if(h<21)slots.push(`${String(h).padStart(2,'0')}:30`)}
const $=id=>document.getElementById(id);const state={date:new Date(),appointments:[],clients:[],phones:{},communes:{},closures:[],reminders:{},appName:DEFAULT_APP_NAME};
function backupStamp(d=new Date()){const z=n=>String(n).padStart(2,'0');return `${z(d.getDate())}-${z(d.getMonth()+1)}-${d.getFullYear()}_${z(d.getHours())}-${z(d.getMinutes())}-${z(d.getSeconds())}`}function backupDateLabel(d){return new Date(d).toLocaleString('it-IT',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit'})}function iso(d){return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10)}function euro(n){const v=Number(n||0);return `${Number.isInteger(v)?v.toFixed(0):v.toFixed(2)}€`}function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2)}
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
    state.appointments=data.appointments;state.clients=data.clients;state.phones=(data.phones&&typeof data.phones==='object'&&!Array.isArray(data.phones))?data.phones:{};state.communes=(data.communes&&typeof data.communes==='object'&&!Array.isArray(data.communes))?data.communes:{};state.closures=Array.isArray(data.closures)?data.closures:[];state.reminders=(data.reminders&&typeof data.reminders==='object'&&!Array.isArray(data.reminders))?data.reminders:{};state.appName=validAppName(data.appName);services=validServices(data.services);
  }catch(err){
    console.error(err);window.archiveUnavailable=true;
    alert('ATTENZIONE: impossibile aprire l’archivio locale. Non inserire o modificare dati: verifica le impostazioni del browser e recupera un backup.');
  }
  updateBackupNotice();
}
function save(protect=false){
  if(window.archiveUnavailable){alert('Archivio non disponibile: modifiche non salvate.');return;}
  const snapshot=structuredClone({appointments:state.appointments,clients:state.clients,phones:state.phones,communes:state.communes,closures:state.closures,reminders:state.reminders,appName:state.appName,services});
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
  el.style.display='block';if($('backupCenterStatus'))refreshBackupCenter();
}
function startOfWeek(d){const x=new Date(d);const day=(x.getDay()+6)%7;x.setDate(x.getDate()-day);x.setHours(0,0,0,0);return x}

function validAppName(name){
 const value=typeof name==='string'?name.trim():'';
 return value&&value.length<=40?value:DEFAULT_APP_NAME;
}
function validServices(data){
 if(!data||typeof data!=='object'||Array.isArray(data))return structuredClone(DEFAULT_SERVICES);
 const clean={};
 for(const [name,item] of Object.entries(data).slice(0,100)){
  const label=name.trim();
  const price=Number(item?.prezzo),duration=Number(item?.durata);
  if(label&&label.length<=70&&Number.isFinite(price)&&price>=0&&price<=10000){
   clean[label]={prezzo:price,durata:Number.isFinite(duration)&&duration>=0.5&&duration<=16?duration:1};
  }
 }
 return Object.keys(clean).length?clean:structuredClone(DEFAULT_SERVICES);
}
function applyAppName(){
 document.title=state.appName+' · Gestionale';
 document.querySelectorAll('[data-app-name]').forEach(el=>el.textContent=state.appName);
}
function renderServiceSettings(){
 const nameInput=$('businessNameInput');if(!nameInput)return;
 if(document.activeElement!==nameInput)nameInput.value=state.appName;
 const list=$('serviceSettingsList');list.replaceChildren();
 for(const [name,item] of Object.entries(services)){
  const row=document.createElement('div');row.className='service-edit-row';
  const label=document.createElement('strong');label.textContent=name;
  const price=document.createElement('input');price.type='number';price.min='0';price.max='10000';price.step='0.01';price.value=String(item.prezzo);price.setAttribute('aria-label','Prezzo di '+name);
  const duration=document.createElement('select');duration.setAttribute('aria-label','Durata di '+name);
  for(const value of [0.5,1,1.5,2,3,4]){const option=document.createElement('option');option.value=String(value);option.textContent=(value*30)+' min';option.selected=value===item.durata;duration.append(option)}
  const edit=document.createElement('button');edit.type='button';edit.className='primary-btn service-save-btn';edit.textContent='Salva';
  edit.onclick=()=>{
   const newPrice=Number(price.value);
   if(price.value.trim()===''||!Number.isFinite(newPrice)||newPrice<0||newPrice>10000){alert('Inserisci un prezzo valido.');return}
   services[name]={prezzo:Math.round(newPrice*100)/100,durata:Number(duration.value)};
   save(true);renderServiceSettings();alert('Servizio aggiornato. Gli appuntamenti già salvati mantengono il prezzo originale.');
  };
  const rename=document.createElement('button');rename.type='button';rename.className='ghost-btn';rename.textContent='Rinomina';
  rename.onclick=()=>{
   const newName=prompt('Nuovo nome del servizio:',name);
   if(newName===null)return;
   const next=newName.trim();
   if(!next||next.length>70){alert('Inserisci un nome di massimo 70 caratteri.');return}
   if(next!==name&&Object.keys(services).some(x=>x.toLocaleLowerCase('it')===next.toLocaleLowerCase('it'))){alert('Esiste già un servizio con questo nome.');return}
   if(next!==name){const updated={};for(const [key,val] of Object.entries(services))updated[key===name?next:key]=val;services=updated;save(true);renderServiceSettings()}
  };
  const remove=document.createElement('button');remove.type='button';remove.className='danger-btn';remove.textContent='Elimina';
  remove.onclick=()=>{
   if(Object.keys(services).length===1){alert('Deve rimanere almeno un servizio.');return}
   if(!confirm('Eliminare "'+name+'" dal listino? Gli appuntamenti già registrati non saranno eliminati.'))return;
   delete services[name];save(true);renderServiceSettings();
  };
  const actions=document.createElement('details');actions.className='service-more';
  const trigger=document.createElement('summary');trigger.textContent='⋯';trigger.title='Altre azioni per '+name;trigger.setAttribute('aria-label','Altre azioni per '+name);
  const menu=document.createElement('div');menu.className='service-more-menu';menu.append(rename,remove);actions.append(trigger,menu);
  const nameCell=document.createElement('div');nameCell.className='service-name-cell';nameCell.append(label);
  const priceCell=document.createElement('label');priceCell.className='service-price-cell';const priceCaption=document.createElement('span');priceCaption.textContent='Prezzo (€)';priceCell.append(priceCaption,price);
  const durationCell=document.createElement('label');durationCell.className='service-duration-cell';const durationCaption=document.createElement('span');durationCaption.textContent='Durata';durationCell.append(durationCaption,duration);
  row.append(nameCell,priceCell,durationCell,edit,actions);list.append(row);

 }
}
function setupServiceSettings(){
 $('saveBusinessNameBtn').onclick=()=>{
  const raw=$('businessNameInput').value.trim();
  if(!raw||raw.length>40){alert('Il nome deve contenere da 1 a 40 caratteri.');return}
  state.appName=raw;save(true);applyAppName();alert('Nome aggiornato nel gestionale. Il nome dell’icona installata sull’iPad potrebbe non cambiare automaticamente.');
 };
 $('addServiceForm').onsubmit=e=>{
  e.preventDefault();
  const name=$('newServiceLabel').value.trim();
  const raw=$('newServicePrice').value,price=Number(raw),duration=Number($('newServiceDuration').value);
  if(!name||name.length>70||raw.trim()===''||!Number.isFinite(price)||price<0||price>10000){alert('Controlla nome e prezzo del servizio.');return}
  if(Object.keys(services).some(x=>x.toLocaleLowerCase('it')===name.toLocaleLowerCase('it'))){alert('Il servizio esiste già.');return}
  services[name]={prezzo:Math.round(price*100)/100,durata:duration};
  save(true);$('addServiceForm').reset();renderServiceSettings();
 };
}
function setView(name){document.querySelectorAll('.view,.nav-btn').forEach(e=>e.classList.remove('active'));$(name).classList.add('active');document.querySelector(`[data-view="${name}"]`).classList.add('active');$('pageTitle').textContent={agenda:'Agenda',clienti:'Clienti',report:'Gestionale',promemoria:'Promemoria WhatsApp',chiusure:'Ferie e chiusure',backup:'Centro backup',servizi:'Servizi e impostazioni'}[name];if(name==='report')renderReport();if(name==='promemoria')renderTomorrowReminders();if(name==='chiusure')renderClosures();document.body.classList.toggle('in-backup-view',name==='backup');if(name==='backup')refreshBackupCenter();if(name==='servizi')renderServiceSettings();scheduleSectionHelp(name)}
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
function closureReason(date){
 const day=typeof date==='string'?new Date(date+'T12:00:00'):date;
 const dateKey=typeof date==='string'?date:iso(date);
 const special=state.closures.find(c=>dateKey>=c.start&&dateKey<=c.end);
 if(special)return special.reason||'Chiusura straordinaria';
 return italianHoliday(day)||(day.getDay()===1?'Riposo settimanale':day.getDay()===0?'Domenica':'');
}
function renderClosures(){
 const el=$('closuresList');if(!el)return;el.replaceChildren();
 const list=[...state.closures].sort((a,b)=>a.start.localeCompare(b.start));
 if(!list.length){const empty=document.createElement('p');empty.className='muted';empty.textContent='Nessuna chiusura straordinaria registrata. Lunedì, domeniche e festività sono già evidenziati automaticamente.';el.append(empty);}
 for(const c of list){const row=document.createElement('div');row.className='closure-row';const info=document.createElement('span');info.textContent=`${c.start}${c.end!==c.start?' → '+c.end:''} · ${c.reason}`;const del=document.createElement('button');del.className='ghost-btn';del.type='button';del.textContent='Elimina';del.onclick=()=>{if(!confirm('Eliminare questa chiusura?'))return;state.closures=state.closures.filter(x=>x.id!==c.id);save(true);renderAll()};row.append(info,del);el.append(row)}
}
function renderWeek(){const base=startOfWeek(state.date);$('weekStrip').innerHTML='';['Lun','Mar','Mer','Gio','Ven','Sab','Dom'].forEach((n,i)=>{const d=new Date(base);d.setDate(base.getDate()+i);const b=document.createElement('button');const holiday=italianHoliday(d);const isSunday=d.getDay()===0;const isRestMonday=d.getDay()===1;const custom=state.closures.find(c=>iso(d)>=c.start&&iso(d)<=c.end);const marked=holiday||isSunday||isRestMonday||custom;const marker=custom?'Chiuso':holiday?'Festivo':isRestMonday?'Riposo':' ';b.className='day-pill'+(marked?' holiday':'')+(iso(d)===iso(state.date)?' active':'');if(marked){b.title=custom?.reason||holiday||(isRestMonday?'Riposo settimanale':'Domenica');b.setAttribute('aria-label',`${n} ${d.getDate()}: ${b.title}`)}b.innerHTML=`<span>${n}</span><strong>${d.getDate()}</strong>${marked?'<small class="holiday-mark">'+marker+'</small>':''}`;b.onclick=()=>{state.date=d;renderAll()};$('weekStrip').appendChild(b)})}
let agendaMode='compact';
function appointmentStateClass(a){return a.status==='completed'?'completed':a.status==='cancelled'?'cancelled':a.status==='noshow'?'noshow':'booked'}
function quickAppointmentCard(a){
 const card=document.createElement('div');card.className='quick-app-card state-'+appointmentStateClass(a);
 const top=document.createElement('div');top.className='quick-app-top';
 const info=document.createElement('div');info.className='quick-app-info';
 const name=document.createElement('strong');name.textContent=a.client;
 const service=document.createElement('span');service.textContent=`${a.service} · ${euro(a.price)}`;
 info.append(name,service);
 const badge=document.createElement('span');badge.className='quick-state-badge state-'+appointmentStateClass(a);
 badge.textContent=a.status==='completed'?'✓ Completato · Pagato':a.status==='cancelled'?'✕ Annullato':a.status==='noshow'?'Assente':'● Prenotato';
 top.append(info,badge);card.append(top);
 const actions=document.createElement('div');actions.className='quick-app-actions';
 const edit=document.createElement('button');edit.type='button';edit.className='ghost-btn';edit.textContent='Modifica';edit.onclick=()=>openAppointment(a);actions.append(edit);
 if(a.status==='booked'||!a.status){
  const cancel=document.createElement('button');cancel.type='button';cancel.className='quick-cancel-btn';cancel.textContent='Annulla';cancel.onclick=()=>requestQuickStatus(a.id,'cancelled');
  const complete=document.createElement('button');complete.type='button';complete.className='quick-complete-btn';complete.textContent='✓ Segna completato';complete.onclick=()=>requestQuickStatus(a.id,'completed');actions.append(cancel,complete);
 }else if(a.status==='cancelled'||a.status==='noshow'){
  const restore=document.createElement('button');restore.type='button';restore.className='ghost-btn';restore.textContent='Ripristina';restore.onclick=()=>requestQuickStatus(a.id,'booked');actions.append(restore);
 }
 card.append(actions);return card;
}
let pendingQuickStatus=null;
function requestQuickStatus(id,status){
 const a=state.appointments.find(x=>x.id===id);if(!a)return;
 pendingQuickStatus={id,status};
 const label=status==='completed'?'Completare e registrare il pagamento':status==='cancelled'?'Annullare appuntamento':'Ripristinare appuntamento';
 $('quickStatusTitle').textContent=label+'?';
 $('quickStatusDescription').textContent=`${a.client} · ${a.date} alle ${a.time} · ${a.service}`+(status==='completed'?`\nVerrà registrato automaticamente come pagato (${euro(a.price)}) e incluso negli incassi.`:status==='cancelled'?'\nL’appuntamento resterà nello storico e non sarà conteggiato negli incassi.':'\nL’appuntamento tornerà prenotato e non pagato.');
 const btn=$('confirmQuickStatusBtn');btn.textContent=status==='completed'?'✓ Conferma completamento':status==='cancelled'?'Conferma annullamento':'Conferma ripristino';btn.className=status==='cancelled'?'danger-btn':'primary-btn';
 $('quickStatusDialog').showModal();
}
function applyQuickStatus(){
 if(!pendingQuickStatus)return;
 const {id,status}=pendingQuickStatus;pendingQuickStatus=null;
 const a=state.appointments.find(x=>x.id===id);if(!a){$('quickStatusDialog').close();return;}
 a.status=status;a.paid=status==='completed';
 save(true);$('quickStatusDialog').close();renderAll();
 if(document.getElementById('slotQuickDetails')){const apps=state.appointments.filter(x=>x.date===a.date&&x.time===a.time&&x.status!=='cancelled');if(apps.length)showSlotAppointments(a.time,apps);}
}
function renderAgenda(){
 const ds=iso(state.date);$('datePicker').value=ds;
 $('selectedDateLabel').textContent=state.date.toLocaleDateString('it-IT',{weekday:'long',day:'2-digit',month:'long',year:'numeric'});
 const grid=$('agendaGrid');grid.replaceChildren();document.getElementById('slotQuickDetails')?.remove();
 const dayApps=state.appointments.filter(a=>a.date===ds);
 const cancelledApps=dayApps.filter(a=>a.status==='cancelled').sort((a,b)=>a.time.localeCompare(b.time));
 const archiveBtn=$('cancelledAppointmentsBtn');const archiveCount=$('cancelledAppointmentsCount');
 archiveCount.textContent=String(cancelledApps.length);archiveBtn.setAttribute('aria-label',`Appuntamenti annullati: ${cancelledApps.length}. Apri archivio del giorno`);
 const busy=slots.filter(t=>dayApps.some(a=>a.time===t&&a.status!=='cancelled')).length;
 const booked=dayApps.filter(a=>!a.status||a.status==='booked').length;
 const completed=dayApps.filter(a=>a.status==='completed').length;
 $('agendaSummary').textContent=`${slots.length-busy} orari liberi · ${busy} occupati · ${booked} prenotati · ${completed} completati${closureReason(ds)?' · 🔴 '+closureReason(ds):''}`;
 $('compactAgendaBtn').classList.toggle('active-mode',agendaMode==='compact');
 $('detailAgendaBtn').classList.toggle('active-mode',agendaMode==='detail');
 grid.className=agendaMode==='compact'?'agenda-grid compact-grid':'agenda-grid';
 if(agendaMode==='compact'){
  for(const slot of slots){
   const active=dayApps.filter(a=>a.time===slot&&a.status!=='cancelled');
   const b=document.createElement('button');b.type='button';b.className='compact-slot '+(active.length?'occupied':'available');
   const time=document.createElement('strong');time.textContent=slot;
   const label=document.createElement('span');label.textContent=active.length?`${active.length} appuntament${active.length===1?'o':'i'}`:'Libero';
   b.append(time,label);b.title=active.length?active.map(a=>a.client+' · '+statusLabel(a.status)).join(', '):'Prenota alle '+slot;
   b.onclick=()=>{if(!active.length){openAppointment({time:slot});return;}showSlotAppointments(slot,active)};
   grid.appendChild(b);
  }
  return;
 }
 slots.forEach(slot=>{
  const apps=dayApps.filter(a=>a.time===slot&&a.status!=='cancelled');const row=document.createElement('div');row.className='slot';
  const time=document.createElement('div');time.className='slot-time';time.textContent=slot;
  const list=document.createElement('div');list.className='apps';
  if(apps.length)apps.forEach(a=>list.append(quickAppointmentCard(a)));
  else{const empty=document.createElement('div');empty.className='empty';empty.textContent='Libero';list.append(empty)}
  const add=document.createElement('button');add.className='primary-btn';add.textContent='+ Prenota';add.onclick=()=>openAppointment({time:slot});
  row.append(time,list,add);grid.appendChild(row);
 });
}
function showSlotAppointments(time,apps){
 const grid=$('agendaGrid');document.getElementById('slotQuickDetails')?.remove();
 const panel=document.createElement('div');panel.id='slotQuickDetails';panel.className='slot-quick-details card';
 const heading=document.createElement('h3');heading.textContent=`Ore ${time} · ${apps.length} appuntamenti`;panel.append(heading);
 for(const a of apps)panel.append(quickAppointmentCard(a));
 const add=document.createElement('button');add.className='primary-btn';add.textContent='+ Aggiungi appuntamento';add.onclick=()=>openAppointment({time});panel.append(add);
 grid.before(panel);panel.scrollIntoView({behavior:'smooth',block:'nearest'});
}
function showCancelledAppointments(){
 const ds=iso(state.date);
 const cancelled=state.appointments.filter(a=>a.date===ds&&a.status==='cancelled').sort((a,b)=>a.time.localeCompare(b.time));
 const dialog=$('cancelledAppointmentsDialog');const list=$('cancelledAppointmentsList');list.replaceChildren();
 $('cancelledArchiveDate').textContent=state.date.toLocaleDateString('it-IT',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
 if(!cancelled.length){const empty=document.createElement('p');empty.className='muted';empty.textContent='Nessun appuntamento annullato per questa data.';list.append(empty);}
 for(const a of cancelled){
  const item=document.createElement('div');item.className='cancelled-archive-item';
  const info=document.createElement('div');info.className='cancelled-archive-info';
  const heading=document.createElement('strong');heading.textContent=`${a.time} · ${a.client}`;
  const detail=document.createElement('span');detail.textContent=`${a.service} · ${euro(a.price)}`;
  info.append(heading,detail);
  const restore=document.createElement('button');restore.type='button';restore.className='ghost-btn';restore.textContent='↶ Ripristina';
  restore.onclick=()=>{dialog.close();requestQuickStatus(a.id,'booked')};
  item.append(info,restore);list.append(item);
 }
 dialog.showModal();
}
function escapeHtml(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function clientKey(name){return normalizeClientName(name).toLocaleLowerCase('it-IT');}
function phoneFor(name){return state.phones[clientKey(name)]||'';}
function communeFor(name){return state.communes[clientKey(name)]||'';}
function normalizePhone(value){let v=String(value||'').replace(/[^+\d]/g,'');if(v.startsWith('00'))v='+'+v.slice(2);if(/^3\d{9}$/.test(v))v='+39'+v;return /^\+?\d{8,15}$/.test(v)?v:'';}
function whatsappLink(phone,message){const p=normalizePhone(phone).replace(/^\+/,'');return p?'https://wa.me/'+p+'?text='+encodeURIComponent(message):'';}
function openWhatsApp(app){
 const phone=phoneFor(app.client);
 if(!normalizePhone(phone)){alert('Inserisci prima un numero di cellulare valido nella scheda del cliente.');return;}
 const d=new Date(app.date+'T12:00:00');
 const day=d.toLocaleDateString('it-IT',{weekday:'long',day:'numeric',month:'long'});
 const msg=`Ciao ${app.client}! 💈 Ti ricordiamo il tuo appuntamento per ${day} alle ${app.time}. Ti aspettiamo!`;
 const url=whatsappLink(phone,msg);
 // Apertura richiesta direttamente dal tocco dell'utente, compatibile con Safari/iPad.
 const win=window.open(url,'_blank');
 if(!win){alert('WhatsApp non si è aperto. Consenti l’apertura del collegamento e riprova.');return;}
 state.reminders[app.id]={status:'opened',at:new Date().toISOString(),phone};
 save();renderTomorrowReminders();
}
function setReminderStatus(id,status){
 if(status==='pending')delete state.reminders[id];
 else state.reminders[id]={...(state.reminders[id]||{}),status,at:new Date().toISOString()};
 save();renderTomorrowReminders();
}
function renderTomorrowReminders(){
 const el=$('tomorrowReminders');if(!el)return;
 const filter=$('reminderDayFilter')?.value||'tomorrow';
 const d=new Date();if(filter==='tomorrow')d.setDate(d.getDate()+1);
 const date=iso(d);
 const apps=state.appointments.filter(a=>a.date===date&&a.status!=='cancelled'&&a.status!=='noshow').sort((a,b)=>a.time.localeCompare(b.time));
 el.replaceChildren();
 if(!apps.length){el.textContent='Nessun appuntamento per la data selezionata.';return;}
 for(const a of apps){
  const row=document.createElement('div');row.className='reminder-row';
  const label=document.createElement('span');label.textContent=a.time+' · '+a.client;
  const status=state.reminders[a.id]?.status||'pending';
  const badge=document.createElement('span');badge.className='reminder-status '+status;
  badge.textContent={pending:'Da inviare',opened:'Aperto su WhatsApp',sent:'Inviato (confermato)'}[status];
  const btn=document.createElement('button');btn.className='ghost-btn';btn.textContent='💬 WhatsApp';
  btn.disabled=!normalizePhone(phoneFor(a.client));
  btn.title=btn.disabled?'Aggiungi il cellulare nella sezione Clienti':'Apre WhatsApp; non conferma l’invio';
  btn.onclick=()=>openWhatsApp(a);
  const sent=document.createElement('button');sent.className='ghost-btn';sent.textContent='✓ Inviato';
  sent.disabled=status==='sent';sent.onclick=()=>setReminderStatus(a.id,'sent');
  const reset=document.createElement('button');reset.className='ghost-btn';reset.textContent='↺ Da inviare';
  reset.disabled=status==='pending';reset.onclick=()=>setReminderStatus(a.id,'pending');
  row.append(label,badge,btn,sent,reset);el.append(row);
 }
}
function renderClients(){
 const list=$('clientList');list.replaceChildren();const allClientNames=[...state.clients];const search=($('clientSearch')?.value||'').trim().toLocaleLowerCase('it-IT');
 [...state.clients].filter(c=>!search||c.toLocaleLowerCase('it-IT').includes(search)||phoneFor(c).includes(search)).sort((a,b)=>a.localeCompare(b,'it')).forEach(c=>{
  const key=clientKey(c),apps=state.appointments.filter(a=>clientKey(a.client)===key);
  const completed=apps.filter(isPaidVisit);const total=completed.reduce((sum,a)=>sum+Number(a.price||0),0);
  const r=document.createElement('div');r.className='client-row';
  const info=document.createElement('div');info.className='client-info';const title=document.createElement('strong');title.textContent=c;
  const visits=document.createElement('span');visits.textContent=apps.filter(a=>a.status==='completed').length+' visite completate · '+euro(total)+' incassati';info.append(title,visits);
  const comune=document.createElement('input');comune.placeholder='Comune di residenza';comune.value=communeFor(c);comune.setAttribute('aria-label','Comune di '+c);
  comune.onchange=()=>{const value=comune.value.trim();if(value)state.communes[key]=value;else delete state.communes[key];save()};
  const phone=document.createElement('input');phone.type='tel';phone.placeholder='Cellulare';phone.value=phoneFor(c);phone.setAttribute('aria-label','Cellulare di '+c);
  const wa=document.createElement('button');wa.className='ghost-btn';wa.textContent='💬 WhatsApp';wa.disabled=!phoneFor(c);wa.title='Apri una conversazione WhatsApp';
  phone.onchange=()=>{const previous=phoneFor(c);const raw=phone.value.trim(),v=normalizePhone(raw);if(raw&&!v){alert('Numero non valido: inserisci un numero italiano o internazionale, ad esempio +393331234567.');phone.value=previous;return;}if(v!==previous&&!confirm('Confermi la modifica del cellulare di '+c+'?\\n\\nVecchio numero: '+(previous||'(nessuno)')+'\\nNuovo numero: '+(v||'(nessuno)'))){phone.value=previous;return;}if(v)state.phones[key]=v;else delete state.phones[key];wa.disabled=!v;save();renderTomorrowReminders();};
  wa.onclick=()=>{const link=whatsappLink(phoneFor(c),'Ciao '+c+'! 💈');if(link)window.open(link,'_blank','noopener,noreferrer')};
  const del=document.createElement('button');del.className='danger-btn';del.textContent='Elimina';del.onclick=()=>{if(confirm(`Eliminare ${c}? Gli appuntamenti esistenti non saranno eliminati.`)){state.clients=state.clients.filter(x=>x!==c);delete state.phones[key];delete state.communes[key];save(true);renderAll()}};
  const history=document.createElement('details');history.className='client-history';
  const summary=document.createElement('summary');const completedVisits=apps.filter(a=>a.status==='completed');const last=completedVisits.slice().sort((a,b)=>b.date.localeCompare(a.date))[0];summary.textContent='Storico: '+completedVisits.length+' visite · '+euro(total)+' incassati'+(last?' · Ultima visita '+last.date:'');history.append(summary);
  for(const a of visitHistory(c)){const line=document.createElement('div');line.className='history-line';
    line.textContent=`${a.date} ${a.time} · ${a.service} · ${euro(a.price)} · ${statusLabel(a.status)}${isPaidVisit(a)?' · Pagato':''}`;
    history.append(line);
  }
  r.append(info,comune,phone,wa,history,del);list.appendChild(r);
 });
 $('clientSuggestions').replaceChildren();allClientNames.sort((a,b)=>a.localeCompare(b,'it')).forEach(c=>{const opt=document.createElement('option');opt.value=c;$('clientSuggestions').append(opt)});
}

function renderStats(){}
function isPaidVisit(a){return a.status==='completed' && a.paid===true}
function statusLabel(s){return ({booked:'Prenotato',completed:'Completato',cancelled:'Annullato',noshow:'Assente'})[s]||'Prenotato'}
function visitHistory(name){
 return state.appointments.filter(a=>clientKey(a.client)===clientKey(name))
   .sort((a,b)=>(b.date+' '+b.time).localeCompare(a.date+' '+a.time));
}
function openAppointment(app){const isEdit=!!app.id;$('appointmentTitle').textContent=isEdit?'Modifica appuntamento':'Nuovo appuntamento';$('editingAppointmentId').value=app.id||'';$('appointmentClient').value=app.client||'';$('appointmentTime').value=app.time||'08:00';$('appointmentService').replaceChildren();
 const selectedName=app.service||'Taglio';
 for(const name of Object.keys(services)){const opt=document.createElement('option');opt.value=name;opt.textContent=name;opt.selected=name===selectedName;$('appointmentService').append(opt)}
 if(app.service&&!services[app.service]){const old=document.createElement('option');old.value=app.service;old.textContent=app.service+' (servizio non più in elenco)';old.selected=true;$('appointmentService').append(old)}const selectedService=app.service||'Taglio';const defaultPrice=services[selectedService]?.prezzo??Number(app.price||0);$('appointmentCustomPrice').value=(isEdit&&Number(app.price||0)!==Number(defaultPrice))?String(app.price):'';$('appointmentNotes').value=app.notes||'';
 $('appointmentStatus').value=app.status||'booked';
 $('appointmentPaid').checked=app.paid===true;
 $('appointmentPaid').disabled=(app.status||'booked')!=='completed';
 $('appointmentStatus').onchange=()=>{$('appointmentPaid').disabled=$('appointmentStatus').value!=='completed';if($('appointmentPaid').disabled)$('appointmentPaid').checked=false};$('appointmentPhone').value=phoneFor(app.client||'');$('whatsappAppointmentBtn').classList.toggle('hidden',!isEdit);$('whatsappAppointmentBtn').onclick=()=>openWhatsApp(app);$('appointmentCustomPrice').placeholder=`Lascia vuoto per usare ${euro(defaultPrice)}`;$('appointmentService').onchange=()=>{$('appointmentCustomPrice').placeholder=`Lascia vuoto per usare ${euro((services[$('appointmentService').value]?.prezzo??Number(app.price||0)))}`};$('deleteAppointmentBtn').classList.toggle('hidden',!isEdit);$('appointmentDialog').showModal()}

function closeAppointmentDialog(){
  $('appointmentDialog').close();
  
  
  
}
$('closeAppointmentDialog').onclick=closeAppointmentDialog;
$('cancelAppointmentBtn').onclick=closeAppointmentDialog;
$('appointmentDialog').addEventListener('click',e=>{if(e.target===$('appointmentDialog'))closeAppointmentDialog()});
$('appointmentDialog').addEventListener('cancel',e=>{e.preventDefault();closeAppointmentDialog()});
function normalizeClientName(name){const clean=name.trim().replace(/\s+/g,' ');return clean?clean[0].toUpperCase()+clean.slice(1):''}
$('appointmentClient').addEventListener('change',()=>{$('appointmentPhone').value=phoneFor($('appointmentClient').value)});
$('appointmentForm').addEventListener('submit',e=>{e.preventDefault();const reason=closureReason(iso(state.date));if(reason&&!confirm('Giorno di riposo o chiusura: '+reason+'\n\nVuoi autorizzare comunque questa prenotazione?'))return;const id=$('editingAppointmentId').value||uid();const service=$('appointmentService').value;const client=normalizeClientName($('appointmentClient').value);if(!client)return;const customRaw=String($('appointmentCustomPrice').value||'').replace(',','.').trim();const customPrice=customRaw===''?null:Number(customRaw);const finalPrice=customPrice!==null&&!Number.isNaN(customPrice)?customPrice:(services[service]?.prezzo??Number(state.appointments.find(a=>a.id===id)?.price||0));const obj={id,client,service,time:$('appointmentTime').value,price:finalPrice,notes:$('appointmentNotes').value.trim(),status:$('appointmentStatus').value,paid:$('appointmentStatus').value==='completed'&&$('appointmentPaid').checked,date:iso(state.date)};const idx=state.appointments.findIndex(a=>a.id===id);idx>=0?state.appointments[idx]=obj:state.appointments.push(obj);if(!state.clients.some(c=>c.toLowerCase()===obj.client.toLowerCase()))state.clients.push(obj.client);const phoneRaw=$('appointmentPhone').value.trim();if(phoneRaw){const phone=normalizePhone(phoneRaw);if(!phone){alert('Numero di cellulare non valido.');return;}const old=phoneFor(obj.client);if(old!==phone&&!confirm('Confermi la modifica del numero nell’anagrafica di '+obj.client+'?\\n\\nVecchio: '+(old||'(nessuno)')+'\\nNuovo: '+phone))return;state.phones[clientKey(obj.client)]=phone;}save();$('appointmentDialog').close();renderAll()});
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
  const paidApps=apps.filter(isPaidVisit);const total=paidApps.reduce((x,a)=>x+Number(a.price||0),0);
  const byClient={};
  paidApps.forEach(a=>{
    if(!byClient[a.client])byClient[a.client]={client:a.client,spent:0,visits:0};
    byClient[a.client].spent+=Number(a.price||0);
    byClient[a.client].visits+=1;
  });
  const ranking=Object.values(byClient).sort((a,b)=>b.spent-a.spent||b.visits-a.visits||a.client.localeCompare(b.client));
  const completedByClient={};
  apps.filter(a=>a.status==='completed').forEach(a=>{const k=clientKey(a.client);if(!completedByClient[k])completedByClient[k]={client:a.client,visits:0,spent:0};completedByClient[k].visits++;});
  paidApps.forEach(a=>{const k=clientKey(a.client);if(completedByClient[k])completedByClient[k].spent+=Number(a.price||0)});
  const rankingVisits=Object.values(completedByClient).sort((a,b)=>b.visits-a.visits||b.spent-a.spent||a.client.localeCompare(b.client));
  return {type,ref,s,e,apps,paidApps,total,ranking,rankingVisits,label:periodLabel(type,s,e,ref)};
}
function renderReport(){
  const data=getFilteredReportData();
  const clients=data.ranking.length;
  $('metricIncome').textContent=euro(data.total);
  $('metricCount').textContent=data.apps.length;
  $('metricClients').textContent=clients;
  const rows=data.ranking.map((r,i)=>`<tr><td>${i+1}</td><td>${r.client}</td><td>${r.visits}</td><td>${euro(r.spent)}</td></tr>`).join('');
  $('clientRanking').innerHTML=`<h3>Classifica clienti</h3><p class="muted">Periodo: ${data.label}</p><div class="ranking-table-wrap"><table class="ranking-table"><thead><tr><th>#</th><th>Cliente</th><th>Visite</th><th>Spesa totale</th></tr></thead><tbody>${rows||'<tr><td colspan="4">Nessun dato nel periodo selezionato</td></tr>'}</tbody></table></div>`;
  renderRevenueChart(data);renderServiceRanking(data);
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
function renderServiceRanking(data){
 const root=$('serviceRanking');root.replaceChildren();const counts=new Map();
 for(const a of data.apps.filter(a=>a.status==='completed'))counts.set(a.service,(counts.get(a.service)||0)+1);
 const items=[...counts].sort((a,b)=>b[1]-a[1]);
 if(!items.length){root.textContent='Nessun servizio completato nel periodo.';return;}
 const table=document.createElement('table');table.className='ranking-table';
 const head=document.createElement('thead');head.innerHTML='<tr><th>Servizio</th><th>Visite completate</th></tr>';table.append(head);
 const body=document.createElement('tbody');for(const [name,count] of items){const row=document.createElement('tr');const c1=document.createElement('td'),c2=document.createElement('td');c1.textContent=name;c2.textContent=count;row.append(c1,c2);body.append(row)}table.append(body);root.append(table);
}
function renderRevenueChart(data){
 const root=$('revenueChart');root.replaceChildren();root.classList.remove('chart-has-data');const totals=new Map();
 const format=(date)=>{const d=new Date(date+'T12:00:00');if(data.type==='year')return date.slice(0,7);if(data.type==='all')return date.slice(0,7);if(data.type==='month')return date.slice(8,10);if(data.type==='week')return d.toLocaleDateString('it-IT',{weekday:'short',day:'numeric'});return date.slice(11)||date.slice(0,10)};
 for(const a of data.paidApps){const k=format(a.date);totals.set(k,(totals.get(k)||0)+Number(a.price||0));}
 if(!totals.size){root.textContent='Nessun incasso registrato nel periodo.';return;}
 const entries=[...totals].sort((a,b)=>a[0].localeCompare(b[0],'it',{numeric:true}));const max=Math.max(1,...entries.map(x=>x[1]));
 for(const [name,value] of entries){const item=document.createElement('div');item.className='revenue-bar-item';const bar=document.createElement('div');bar.className='revenue-bar';bar.style.height=Math.max(3,Math.round(value/max*150))+'px';bar.title=name+': '+euro(value);const amount=document.createElement('strong');amount.textContent=euro(value);const label=document.createElement('span');label.textContent=name;item.append(amount,bar,label);root.append(item)}
}
async function refreshBackupCenter(){
 const stamp=Number(localStorage.getItem('barber-last-external-backup')||0);
 const label=stamp?new Date(stamp).toLocaleString('it-IT'):'Mai confermato';
 const target=$('backupCenterStatus');target.textContent='Ultimo backup esterno confermato: '+label+' · Copie locali in caricamento...';
 try{const keys=await listLocalSnapshots();target.textContent='Ultimo backup esterno confermato: '+label+' · Copie locali disponibili: '+keys.length;}
 catch(e){target.textContent='Ultimo backup esterno confermato: '+label+' · Impossibile leggere le copie locali: '+e.message;}
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


// Guida contestuale: un solo pop-up per sezione, automaticamente al primo accesso.
const sectionHelp={
 agenda:{title:'Agenda intelligente',intro:'Gestisci gli appuntamenti e controlla subito gli orari disponibili.',items:['Verde indica uno slot libero; rosso indica uno slot con appuntamenti.','Tocca un orario per prenotare o consultare gli appuntamenti.','Scegli Vista compatta o Vista dettagliata.','Nei giorni di riposo puoi comunque prenotare, dopo una conferma.']},
 promemoria:{title:'Promemoria WhatsApp',intro:'Prepara rapidamente i messaggi per i clienti.',items:['Scegli gli appuntamenti di oggi oppure di domani.','Tocca WhatsApp per aprire il messaggio già compilato.','“Aperto su WhatsApp” non significa che il messaggio sia stato inviato.','Puoi segnare manualmente Inviato o Da inviare.']},
 clienti:{title:'Anagrafica e storico',intro:'Tieni aggiornati i contatti e consulta le visite.',items:['Cerca per nome, cognome o numero di cellulare.','Modifica comune e cellulare direttamente nella scheda cliente.','Le modifiche al numero richiedono conferma.','Apri lo storico per consultare visite e importi.']},
 chiusure:{title:'Ferie e chiusure',intro:'Segna i giorni non lavorativi senza perdere la libertà di prenotare.',items:['Lunedì, domeniche e festività sono già evidenziati in rosso.','Registra un periodo di ferie o una chiusura straordinaria.','Puoi comunque prenotare in un giorno chiuso autorizzando l’eccezione.']},
 servizi:{title:'Servizi e nome dell’app',intro:'Personalizza il listino e il nome visualizzato nel gestionale.',items:['Modifica il nome che compare nell’interfaccia e nel titolo della pagina.','Aggiungi, rinomina o elimina i servizi dal listino.','Imposta il prezzo predefinito e la durata di ogni servizio.','I prezzi e i nomi degli appuntamenti già registrati non cambiano automaticamente.','Per cambiare il nome sotto l’icona nella Home dell’iPad può essere necessario aggiungere di nuovo il collegamento.']},
 report:{title:'Gestionale',intro:'Controlla incassi e attività del negozio.',items:['Filtra per giorno, settimana, mese o anno.','Gli incassi includono soltanto gli appuntamenti completati e pagati.','Consulta grafici, servizi più richiesti e classifiche clienti.','Stampa i report quando necessario.']},
 backup:{title:'Centro backup',intro:'Proteggi i dati salvati sul dispositivo.',items:['Le copie locali sono conservate sul dispositivo e non sostituiscono un backup esterno.','Esporta periodicamente il JSON e salvalo in File → iCloud Drive.','Puoi ripristinare un backup JSON o una copia locale.','Verifica sempre che il file esportato sia stato effettivamente salvato.']}
};
let currentView='agenda';
function showSectionHelp(view){
 const data=sectionHelp[view];if(!data)return;
 $('helpTitle').textContent=data.title;$('helpIntro').textContent=data.intro;
 $('helpItems').replaceChildren();
 for(const item of data.items){const li=document.createElement('li');li.textContent=item;$('helpItems').append(li)}
 $('helpDialog').showModal();
 try{localStorage.setItem('barber-help-seen-'+view,'1')}catch(e){}
}
function scheduleSectionHelp(view){
 currentView=view;
 try{if(localStorage.getItem('barber-help-seen-'+view)==='1')return}catch(e){return}
 // Defer until the view is rendered, without interrupting another modal.
 requestAnimationFrame(()=>{if(currentView===view&&!$('appointmentDialog').open&&!$('clientPickerDialog').open&&!$('helpDialog').open)showSectionHelp(view)});
}
$('openHelpBtn').onclick=()=>showSectionHelp(currentView);
function closeHelp(){if($('helpDialog').open)$('helpDialog').close()}
$('closeHelpBtn').onclick=closeHelp;
$('dismissHelpBtn').onclick=closeHelp;
$('helpDialog').addEventListener('click',e=>{if(e.target===$('helpDialog'))closeHelp()});

// Selettore clienti indipendente dalla datalist del browser (migliore su iPad).
function renderClientPicker(){
 const q=$('clientPickerSearch').value.trim().toLocaleLowerCase('it-IT');
 const results=$('clientPickerResults');results.replaceChildren();
 const matches=state.clients.filter(c=>c.toLocaleLowerCase('it-IT').includes(q)||phoneFor(c).includes(q)).sort((a,b)=>a.localeCompare(b,'it')).slice(0,80);
 if(!matches.length){const p=document.createElement('p');p.className='muted';p.textContent='Nessun cliente trovato. Puoi inserirne uno nuovo qui sotto.';results.append(p)}
 for(const name of matches){
  const b=document.createElement('button');b.type='button';b.className='picker-option';b.setAttribute('role','listitem');
  const title=document.createElement('strong');title.textContent=name;
  const phone=document.createElement('small');phone.textContent=phoneFor(name)||'Nessun cellulare';
  const arrow=document.createElement('span');arrow.textContent='›';
  b.append(title,phone,arrow);
  b.onclick=()=>{$('appointmentClient').value=name;$('appointmentPhone').value=phoneFor(name);$('clientPickerDialog').close()};
  results.append(b);
 }
}
function openClientPicker(){
 $('clientPickerSearch').value='';$('clientPickerNewName').value='';
 renderClientPicker();$('clientPickerDialog').showModal();
 $('clientPickerSearch').focus();
}
$('openClientPickerBtn').onclick=openClientPicker;
$('appointmentClient').addEventListener('click',openClientPicker);
$('clientPickerSearch').addEventListener('input',renderClientPicker);
$('closeClientPickerBtn').onclick=()=>$('clientPickerDialog').close();
$('clientPickerDialog').addEventListener('click',e=>{if(e.target===$('clientPickerDialog'))$('clientPickerDialog').close()});
$('clientPickerNewBtn').onclick=()=>{
 const name=normalizeClientName($('clientPickerNewName').value||$('clientPickerSearch').value);
 if(!name){alert('Scrivi il nome del nuovo cliente.');$('clientPickerNewName').focus();return}
 const existing=state.clients.find(c=>clientKey(c)===clientKey(name));
 $('appointmentClient').value=existing||name;
 $('appointmentPhone').value=phoneFor(existing||name);
 $('clientPickerDialog').close();
};
function renderAll(){applyAppName();renderServiceSettings();renderWeek();renderAgenda();renderClients();renderTomorrowReminders();renderStats();renderReport();renderClosures()}
$('cancelledAppointmentsBtn').onclick=showCancelledAppointments;$('closeCancelledArchiveBtn').onclick=()=>$('cancelledAppointmentsDialog').close();$('confirmQuickStatusBtn').onclick=applyQuickStatus;$('cancelQuickStatusBtn').onclick=()=>{$('quickStatusDialog').close();pendingQuickStatus=null};$('quickStatusDialog').addEventListener('close',()=>{pendingQuickStatus=null});$('reminderDayFilter').onchange=renderTomorrowReminders;$('clientSearch').oninput=renderClients;$('closureForm').onsubmit=e=>{e.preventDefault();const start=$('closureStart').value,end=$('closureEnd').value,reason=$('closureReason').value.trim()||'Chiusura straordinaria';if(!start||!end||end<start){alert('Controlla le date della chiusura.');return;}state.closures.push({id:uid(),start,end,reason});save();$('closureForm').reset();renderAll();alert('Chiusura registrata. Gli appuntamenti rimangono possibili previa conferma.')};$('compactAgendaBtn').onclick=()=>{agendaMode='compact';renderAgenda()};$('detailAgendaBtn').onclick=()=>{agendaMode='detail';renderAgenda()};document.querySelectorAll('.nav-btn').forEach(b=>b.onclick=()=>setView(b.dataset.view));$('prevWeek').onclick=()=>{state.date.setDate(state.date.getDate()-7);renderAll()};$('nextWeek').onclick=()=>{state.date.setDate(state.date.getDate()+7);renderAll()};$('datePicker').onchange=e=>{state.date=new Date(e.target.value);renderAll()};$('reportDate').value=iso(new Date());$('periodFilter').onchange=renderReport;$('reportDate').onchange=renderReport;$('printReportBtn').onclick=()=>window.print();$('printClientRankingBtn').onclick=printClientRanking;$('addClientBtn').onclick=()=>{const n=normalizeClientName($('newClientName').value);const raw=$('newClientPhone').value.trim();const phone=normalizePhone(raw);if(!n){alert('Inserisci il nome del cliente.');return;}if(state.clients.some(c=>clientKey(c)===clientKey(n))){alert('Cliente già presente: modifica i dati nella scheda sottostante.');return;}if(raw&&!phone){alert('Numero di cellulare non valido.');return;}state.clients.push(n);if(phone)state.phones[clientKey(n)]=phone;const comune=$('newClientCommune').value.trim();if(comune)state.communes[clientKey(n)]=comune;['newClientName','newClientPhone','newClientCommune'].forEach(id=>$(id).value='');save();renderAll()};
$('backupExportBtn').onclick=()=>$('exportBtn').click();$('backupImportFile').onchange=e=>{const file=e.target.files?.[0];e.target.value='';if(!file)return;const input=$('restoreBackupFile');const transfer=new DataTransfer();transfer.items.add(file);input.files=transfer.files;input.dispatchEvent(new Event('change'));};$('refreshLocalBtn').onclick=()=>{$('restoreLocalBtn').click();refreshBackupCenter()};
$('importClientsFile').onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{importClientsFromJsonText(r.result)}catch(err){alert('File clienti JSON non valido. Deve contenere una lista di nomi, oppure {clients:[...]} / {clienti:[...]}')}};r.readAsText(f);e.target.value=''};
$('exportBtn').onclick=async()=>{
  await saveQueue;
  const data={format:'barber-pro-backup',version:6,exportedAt:new Date().toISOString(),appointments:state.appointments,clients:state.clients,phones:state.phones,communes:state.communes,closures:state.closures,reminders:state.reminders,appName:state.appName,services};
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;
  a.download='BarberPro_Backup_'+backupStamp()+'.json';document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),60000);
  // L'esportazione non garantisce che il file sia stato effettivamente salvato su iCloud.
  if(confirm('Hai salvato il file di backup nell’app File, preferibilmente in iCloud Drive? Premi OK solo dopo aver verificato.')){
    localStorage.setItem('barber-last-external-backup',String(Date.now()));updateBackupNotice();refreshBackupCenter();
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
async function restoreLocalSnapshot(key){const db=await openDb();const record=await new Promise((resolve,reject)=>{const req=db.transaction('archive','readonly').objectStore('archive').get(key);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)});if(!record||!record.data||!Array.isArray(record.data.appointments)||!Array.isArray(record.data.clients))throw Error('Copia non valida');if(!confirm('Ripristinare la copia del '+(record.createdAt?backupDateLabel(record.createdAt):key)+'? I dati attuali verranno sostituiti. Esporta prima un backup esterno.'))return;await saveQueue;await createLocalSnapshot(true);state.appointments=record.data.appointments;state.clients=record.data.clients;state.phones=record.data.phones||{};state.communes=record.data.communes||{};state.closures=record.data.closures||[];state.reminders=record.data.reminders||{};state.appName=validAppName(record.data.appName);services=validServices(record.data.services);save();await saveQueue;renderAll();alert('Copia locale ripristinata.');}
$('restoreLocalBtn').onclick=async()=>{try{const keys=await listLocalSnapshots();const db=await openDb();const el=$('localBackupList');el.replaceChildren();if(!keys.length){el.textContent='Nessuna copia locale disponibile.';return;}for(const key of keys){const btn=document.createElement('button');btn.className='ghost-btn';const record=await new Promise((resolve,reject)=>{const req=db.transaction('archive','readonly').objectStore('archive').get(key);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)});btn.textContent='Ripristina copia del '+(record?.createdAt?backupDateLabel(record.createdAt):key.replace('snapshot-',''));btn.onclick=()=>restoreLocalSnapshot(key).catch(e=>alert(e.message));el.append(btn);}}catch(e){alert('Impossibile leggere le copie locali: '+e.message)}};
// Parser vCard 3/4: supporto base a FN, N e TEL, linee ripiegate.
function parseVcf(text){const cards=String(text).replace(/\r\n/g,'\n').replace(/\r/g,'\n').replace(/\n[ \t]/g,'').split(/BEGIN:VCARD/i).slice(1);const out=[];for(const card of cards){const body=card.split(/END:VCARD/i)[0];const lines=body.split('\n');let name='',fallback='',phone='';for(const line of lines){const idx=line.indexOf(':');if(idx<0)continue;const field=line.slice(0,idx).toUpperCase().split(';')[0].replace(/^ITEM\d+\./,'');const value=line.slice(idx+1).replace(/\\n/gi,' ').replace(/\\,/g,',').trim();if(field==='FN')name=value;else if(field==='N')fallback=value.split(';').filter(Boolean).reverse().join(' ');else if(field==='TEL'&&!phone)phone=normalizePhone(value.replace(/^tel:/i,''));}if(name||fallback)out.push({name:normalizeClientName(name||fallback),phone});}return out;}
$('importVcfFile').onchange=async e=>{const f=e.target.files?.[0];e.target.value='';if(!f)return;try{const entries=parseVcf(await f.text());if(!entries.length)throw Error('Nessun contatto riconosciuto. Esporta i contatti in formato vCard (.vcf).');if(!confirm('Importare '+entries.length+' contatti? I nomi già presenti verranno mantenuti; i cellulari esistenti non saranno sovrascritti.'))return;let added=0,numbers=0;for(const entry of entries){if(!state.clients.some(c=>clientKey(c)===clientKey(entry.name))){state.clients.push(entry.name);added++;}const key=clientKey(entry.name);if(entry.phone&&!state.phones[key]){state.phones[key]=entry.phone;numbers++;}}save();await saveQueue;renderAll();$('contactImportStatus').textContent=`Importati ${added} nuovi clienti e ${numbers} numeri. Controlla eventuali omonimi.`;}catch(err){alert('Importazione VCF non riuscita: '+err.message)}};

setupServiceSettings();load().then(async()=>{renderAll();scheduleSectionHelp('agenda');if(!window.archiveUnavailable){try{await createLocalSnapshot();await cleanLocalSnapshots();}catch(e){console.error('Backup locale:',e);}}});

$('restoreBackupFile').onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=async()=>{try{const d=JSON.parse(r.result);if(!Array.isArray(d.appointments)||!Array.isArray(d.clients)||!d.appointments.every(a=>a&&typeof a==='object'&&typeof a.id==='string'&&typeof a.date==='string')||!d.clients.every(c=>typeof c==='string'))throw Error('Formato errato');if(!confirm('Ripristinare il backup? I dati attualmente salvati su questo dispositivo verranno sostituiti.'))return;await saveQueue;await createLocalSnapshot(true);state.appointments=d.appointments;state.clients=d.clients;state.phones=(d.phones&&typeof d.phones==='object'&&!Array.isArray(d.phones))?d.phones:{};state.communes=(d.communes&&typeof d.communes==='object'&&!Array.isArray(d.communes))?d.communes:{};state.closures=Array.isArray(d.closures)?d.closures:[];state.reminders=(d.reminders&&typeof d.reminders==='object'&&!Array.isArray(d.reminders))?d.reminders:{};state.appName=validAppName(d.appName);services=validServices(d.services);save();await saveQueue;renderAll();alert('Backup ripristinato correttamente.')}catch(err){alert('Backup non valido: è necessario un file esportato da Barber Pro.')}};r.readAsText(f);e.target.value='';};
