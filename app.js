const DEFAULT_SERVICES={"Taglio e barba modellata":{prezzo:20,durata:1},"Taglio":{prezzo:15,durata:1},"Taglio e shampoo":{prezzo:20,durata:1},"Shampoo":{prezzo:7,durata:1},"Taglio bambini":{prezzo:12,durata:1},"Barba solo macchinetta":{prezzo:4,durata:1},"Barba modellata":{prezzo:8,durata:1},"Barba tipo rasoio":{prezzo:7,durata:2}};
let services=structuredClone(DEFAULT_SERVICES);
const DEFAULT_APP_NAME='Barber Pro';
const slots=[];for(let h=8;h<=21;h++){slots.push(`${String(h).padStart(2,'0')}:00`);if(h<21)slots.push(`${String(h).padStart(2,'0')}:30`)}
const $=id=>document.getElementById(id);const state={date:new Date(),appointments:[],clients:[],phones:{},communes:{},closures:[],reminders:{},appName:DEFAULT_APP_NAME,brandImage:null};
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
// Indici temporanei in memoria: NON modificano il database o il formato dei backup.
let performanceIndex=null;
function invalidatePerformanceIndex(){performanceIndex=null;}
function getPerformanceIndex(){
 if(performanceIndex)return performanceIndex;
 const byDate=new Map(),byClient=new Map();
 for(const a of state.appointments){
  if(!byDate.has(a.date))byDate.set(a.date,[]);
  byDate.get(a.date).push(a);
  const key=clientKey(a.client||'');
  if(!byClient.has(key))byClient.set(key,[]);
  byClient.get(key).push(a);
 }
 return performanceIndex={byDate,byClient};
}
function appointmentsForDate(date){return getPerformanceIndex().byDate.get(date)||[];}
function appointmentsForClient(name){return getPerformanceIndex().byClient.get(clientKey(name))||[];}
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
    state.appointments=data.appointments;invalidatePerformanceIndex();state.clients=data.clients;state.phones=(data.phones&&typeof data.phones==='object'&&!Array.isArray(data.phones))?data.phones:{};state.communes=(data.communes&&typeof data.communes==='object'&&!Array.isArray(data.communes))?data.communes:{};state.closures=Array.isArray(data.closures)?data.closures:[];state.reminders=(data.reminders&&typeof data.reminders==='object'&&!Array.isArray(data.reminders))?data.reminders:{};state.appName=validAppName(data.appName);services=validServices(data.services);state.brandImage=validBrandImage(data.brandImage);
  }catch(err){
    console.error(err);window.archiveUnavailable=true;
    alert('ATTENZIONE: impossibile aprire l’archivio locale. Non inserire o modificare dati: verifica le impostazioni del browser e recupera un backup.');
  }
  updateBackupNotice();
}
function save(protect=false){
  invalidatePerformanceIndex();
  if(window.archiveUnavailable){alert('Archivio non disponibile: modifiche non salvate.');return;}
  const snapshot=structuredClone({appointments:state.appointments,clients:state.clients,phones:state.phones,communes:state.communes,closures:state.closures,reminders:state.reminders,appName:state.appName,services,brandImage:state.brandImage});
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
   clean[label]={prezzo:price,durata:Number.isFinite(duration)&&duration>=1/3&&duration<=16?duration:1};
  }
 }
 return Object.keys(clean).length?clean:structuredClone(DEFAULT_SERVICES);
}
function validBrandImage(value){return typeof value==='string' && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(value) && value.length<700000 ? value : null;}
function applyBrandImage(){
 const src=state.brandImage||'icon.svg';
 for(const id of ['homeBrandImage','brandImagePreview']){const el=$(id);if(el)el.src=src;}
 const status=$('brandImageStatus');if(status)status.textContent=state.brandImage?'Immagine personalizzata salvata':'Immagine predefinita';
}
function setupBrandImage(){
 const input=$('brandImageFile');if(!input)return;
 input.onchange=async()=>{
  const file=input.files?.[0];input.value='';if(!file)return;
  if(!file.type.startsWith('image/')){alert('Seleziona un’immagine valida.');return;}
  if(file.size>12*1024*1024){alert('L’immagine è troppo grande (massimo 12 MB).');return;}
  try{
   const bitmap=await createImageBitmap(file);const ratio=Math.min(1,1000/Math.max(bitmap.width,bitmap.height));
   const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*ratio));canvas.height=Math.max(1,Math.round(bitmap.height*ratio));
   canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close?.();
   let encoded=canvas.toDataURL('image/jpeg',0.77);
   if(encoded.length>650000){const scale=Math.sqrt(500000/encoded.length);const small=document.createElement('canvas');small.width=Math.max(1,Math.round(canvas.width*scale));small.height=Math.max(1,Math.round(canvas.height*scale));small.getContext('2d').drawImage(canvas,0,0,small.width,small.height);encoded=small.toDataURL('image/jpeg',0.65);}
   if(!validBrandImage(encoded))throw Error('Immagine troppo grande');
   if(window.archiveUnavailable)throw Error('Archivio locale non disponibile');
   state.brandImage=encoded;save(true);await saveQueue;applyBrandImage();
  }catch(err){alert('Impossibile salvare l’immagine: '+err.message);}
 };
 $('resetBrandImage').onclick=async()=>{if(!confirm('Ripristinare l’immagine iniziale della Home?'))return;state.brandImage=null;save(true);await saveQueue;applyBrandImage();};
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
  for(const value of [1/3,2/3,0.5,1,1.5,2,3,4]){const option=document.createElement('option');option.value=String(value);option.textContent=Math.round(value*30)+' min';option.selected=value===item.durata;duration.append(option)}
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
function renderHome(){
 const today=iso(new Date());const apps=state.appointments.filter(a=>a.date===today&&a.status!=='cancelled');
 const pending=apps.filter(a=>!a.status||a.status==='booked');
 const done=apps.filter(a=>a.status==='completed');
 const upcoming=apps.filter(a=>a.status==='booked' && a.time>=new Date().toTimeString().slice(0,5)).sort((a,b)=>a.time.localeCompare(b.time))[0];
 $('homeTodayLabel').textContent=new Date().toLocaleDateString('it-IT',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
 $('homeTotal').textContent=String(apps.length);$('homePending').textContent=String(pending.length);
 $('homeCompleted').textContent=String(done.length);$('homeNextTime').textContent=upcoming?.time||'—';$('homeNextClient').textContent=upcoming?upcoming.client+' · '+upcoming.service:'Nessuno in programma';
 const last=Number(localStorage.getItem('barber-last-external-backup'));
 $('homeBackupLabel').textContent=last?'Ultimo backup esterno confermato: '+new Date(last).toLocaleString('it-IT',{dateStyle:'short',timeStyle:'short'}):'Nessun backup esterno confermato: esporta una copia su iCloud Drive.';
}
function setView(name){document.querySelectorAll('.view,.nav-btn').forEach(e=>e.classList.remove('active'));$(name).classList.add('active');$('pageTitle').textContent={home:'Home',agenda:'Agenda',clienti:'Clienti',report:'Gestionale',promemoria:'Promemoria WhatsApp',chiusure:'Ferie e chiusure',backup:'Centro backup',servizi:'Servizi e impostazioni'}[name];if(name==='home')renderHome();if(name==='clienti')renderClients();window.scrollTo(0,0);if(name==='report')renderReport();if(name==='promemoria')renderTomorrowReminders();if(name==='chiusure')renderClosures();document.body.classList.toggle('in-backup-view',name==='backup');if(name==='backup')refreshBackupCenter();if(name==='servizi')renderServiceSettings();if(name!=='home')scheduleSectionHelp(name)}
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
function renderWeek(){const base=startOfWeek(state.date);$('weekStrip').innerHTML='';['Lun','Mar','Mer','Gio','Ven','Sab','Dom'].forEach((n,i)=>{const d=new Date(base);d.setDate(base.getDate()+i);const b=document.createElement('button');const holiday=italianHoliday(d);const isSunday=d.getDay()===0;const isRestMonday=d.getDay()===1;const custom=state.closures.find(c=>iso(d)>=c.start&&iso(d)<=c.end);const marked=holiday||isSunday||isRestMonday||custom;const marker=custom?'Chiuso':holiday?'Festivo':isRestMonday?'Riposo':' ';b.className='day-pill'+(marked?' holiday':'')+(iso(d)===iso(state.date)?' active':'');if(marked){b.title=custom?.reason||holiday||(isRestMonday?'Riposo settimanale':'Domenica');b.setAttribute('aria-label',`${n} ${d.getDate()}: ${b.title}`)}b.innerHTML=`<span>${n}</span><strong>${d.getDate()}</strong>${marked?'<small class="holiday-mark">'+marker+'</small>':''}`;b.onclick=()=>{state.date=d;renderAgendaDay()};$('weekStrip').appendChild(b)})}
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
function minutesOf(t){const [h,m]=String(t||'').split(':').map(Number);return Number.isFinite(h)&&Number.isFinite(m)?h*60+m:0;}
function durationMinutes(a){const raw=Number(a.duration??services[a.service]?.durata??1);return Number.isFinite(raw)&&raw>0?Math.round(raw*30):30;}
function occupies(a,start,end){if(a.status==='cancelled'||a.status==='noshow')return false;const t=minutesOf(a.time);return t<end&&t+durationMinutes(a)>start;}
function slotCoverage(apps,time){const start=minutesOf(time),end=start+30;const ranges=apps.filter(a=>occupies(a,start,end)).map(a=>[Math.max(start,minutesOf(a.time)),Math.min(end,minutesOf(a.time)+durationMinutes(a))]).sort((a,b)=>a[0]-b[0]);let covered=0,lo=-1,hi=-1;for(const [a,b] of ranges){if(lo<0){lo=a;hi=b}else if(a<=hi){hi=Math.max(hi,b)}else{covered+=hi-lo;lo=a;hi=b}}if(lo>=0)covered+=hi-lo;return Math.min(30,covered);}
function firstAvailableMinute(apps,time){const start=minutesOf(time);for(let m=start;m<start+30;m++){if(!apps.some(a=>occupies(a,m,m+1)))return `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;}return null;}
function overlapAppointments(candidate){const start=minutesOf(candidate.time),end=start+durationMinutes(candidate);return appointmentsForDate(candidate.date).filter(a=>a.id!==candidate.id&&occupies(a,start,end));}
function renderAgenda(){
 const ds=iso(state.date);$('datePicker').value=ds;
 $('selectedDateLabel').textContent=state.date.toLocaleDateString('it-IT',{weekday:'long',day:'2-digit',month:'long',year:'numeric'});
 const grid=$('agendaGrid');grid.replaceChildren();document.getElementById('slotQuickDetails')?.remove();
 const dayApps=appointmentsForDate(ds);
 const cancelledApps=dayApps.filter(a=>a.status==='cancelled').sort((a,b)=>a.time.localeCompare(b.time));
 const archiveBtn=$('cancelledAppointmentsBtn');const archiveCount=$('cancelledAppointmentsCount');
 archiveCount.textContent=String(cancelledApps.length);archiveBtn.setAttribute('aria-label',`Appuntamenti annullati: ${cancelledApps.length}. Apri archivio del giorno`);
 const coverage=new Map(slots.map(t=>[t,slotCoverage(dayApps,t)]));
 const busy=slots.filter(t=>coverage.get(t)===30).length;const partial=slots.filter(t=>{const n=coverage.get(t);return n>0&&n<30}).length;
 const booked=dayApps.filter(a=>!a.status||a.status==='booked').length;
 const completed=dayApps.filter(a=>a.status==='completed').length;
 $('agendaSummary').textContent=`${slots.length-busy-partial} fasce libere · ${partial} parziali · ${busy} piene · ${booked} prenotati · ${completed} completati${closureReason(ds)?' · 🔴 '+closureReason(ds):''}`;
 $('compactAgendaBtn').classList.toggle('active-mode',agendaMode==='compact');
 $('detailAgendaBtn').classList.toggle('active-mode',agendaMode==='detail');
 grid.className=agendaMode==='compact'?'agenda-grid compact-grid':'agenda-grid';
 if(agendaMode==='compact'){
  for(const slot of slots){
   const startMinute=minutesOf(slot),active=dayApps.filter(a=>occupies(a,startMinute,startMinute+30));
   const used=coverage.get(slot),free=30-used;
   const b=document.createElement('button');b.type='button';b.className='compact-slot '+(used===30?'occupied':used>0?'partial':'available');
   const time=document.createElement('strong');time.textContent=slot;
   const label=document.createElement('span');label.textContent=used===30?'Pieno · 0 min':used>0?`${free} min liberi`:'Libero · 30 min';
   b.append(time,label);b.title=active.length?active.map(a=>`${a.time} ${a.client} · ${durationMinutes(a)} min`).join(' | '):'Prenota alle '+slot;
   b.onclick=()=>{const next=firstAvailableMinute(dayApps,slot);if(!active.length&&next){openAppointment({time:next});return;}showSlotAppointments(slot,active)};
   grid.appendChild(b);
  }
  return;
 }
 slots.forEach(slot=>{
  const apps=dayApps.filter(a=>occupies(a,minutesOf(slot),minutesOf(slot)+30));const row=document.createElement('div');row.className='slot';
  const time=document.createElement('div');time.className='slot-time';time.textContent=slot;const used=coverage.get(slot);row.classList.add(used===30?'slot-full':used>0?'slot-partial':'slot-free');
  const list=document.createElement('div');list.className='apps';
  if(apps.length)apps.forEach(a=>list.append(quickAppointmentCard(a)));
  else{const empty=document.createElement('div');empty.className='empty';empty.textContent='Libero · 30 min';list.append(empty)}
  const add=document.createElement('button');add.className='primary-btn';add.textContent=used===30?'Pieno':`+ Prenota (${30-used} min liberi)`;add.disabled=used===30;add.onclick=()=>{const next=firstAvailableMinute(dayApps,slot);if(next)openAppointment({time:next})};
  row.append(time,list,add);grid.appendChild(row);
 });
}
function showSlotAppointments(time,apps){
 const grid=$('agendaGrid');document.getElementById('slotQuickDetails')?.remove();
 const panel=document.createElement('div');panel.id='slotQuickDetails';panel.className='slot-quick-details card';
 const heading=document.createElement('h3');heading.textContent=`Ore ${time} · ${apps.length} appuntamenti`;panel.append(heading);
 for(const a of apps)panel.append(quickAppointmentCard(a));
 const add=document.createElement('button');add.className='primary-btn';add.textContent='+ Aggiungi appuntamento';add.onclick=()=>{const next=firstAvailableMinute(appointmentsForDate(iso(state.date)),time);if(next)openAppointment({time:next});else alert('Fascia piena.')};panel.append(add);
 grid.before(panel);panel.scrollIntoView({behavior:'smooth',block:'nearest'});
}
function showCancelledAppointments(){
 const ds=iso(state.date);
 const cancelled=appointmentsForDate(ds).filter(a=>a.status==='cancelled').sort((a,b)=>a.time.localeCompare(b.time));
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
let clientPageSize=60;let clientSuggestionsVersion=-1;
function renderClients(){
 const list=$('clientList');list.replaceChildren();const search=($('clientSearch')?.value||'').trim().toLocaleLowerCase('it-IT');
 const matching=state.clients.filter(c=>!search||c.toLocaleLowerCase('it-IT').includes(search)||phoneFor(c).includes(search)).sort((a,b)=>a.localeCompare(b,'it'));
 const fragment=document.createDocumentFragment();
 matching.slice(0,clientPageSize).forEach(c=>{
  const key=clientKey(c),apps=state.appointments.filter(a=>clientKey(a.client)===key);
  const completed=apps.filter(isPaidVisit);const total=completed.reduce((sum,a)=>sum+Number(a.price||0),0);
  const r=document.createElement('div');r.className='client-row';
  const info=document.createElement('div');info.className='client-info';const title=document.createElement('strong');title.textContent=c;
  const visits=document.createElement('span');visits.textContent=apps.filter(a=>a.status==='completed').length+' visite completate · '+euro(total)+' incassati';info.append(title,visits);
  const lastVisit=apps.filter(a=>a.status==='completed').sort((a,b)=>(b.date+' '+b.time).localeCompare(a.date+' '+a.time))[0];
  const serviceCounts={};apps.filter(a=>a.status==='completed').forEach(a=>{serviceCounts[a.service]=(serviceCounts[a.service]||0)+1});
  const favorite=Object.entries(serviceCounts).sort((a,b)=>b[1]-a[1])[0];
  const insights=document.createElement('span');insights.className='client-insights';insights.textContent='Ultima visita: '+(lastVisit?new Date(lastVisit.date+'T12:00:00').toLocaleDateString('it-IT'):'—')+' · Servizio abituale: '+(favorite?.[0]||'—');info.append(insights);
  const comune=document.createElement('input');comune.placeholder='Comune di residenza';comune.value=communeFor(c);comune.setAttribute('aria-label','Comune di '+c);
  comune.onchange=()=>{const value=comune.value.trim();if(value)state.communes[key]=value;else delete state.communes[key];save()};
  const phone=document.createElement('input');phone.type='tel';phone.placeholder='Cellulare';phone.value=phoneFor(c);phone.setAttribute('aria-label','Cellulare di '+c);
  const wa=document.createElement('button');wa.className='ghost-btn';wa.textContent='💬 WhatsApp';wa.disabled=!phoneFor(c);wa.title='Apri una conversazione WhatsApp';
  phone.onchange=()=>{const previous=phoneFor(c);const raw=phone.value.trim(),v=normalizePhone(raw);if(raw&&!v){alert('Numero non valido: inserisci un numero italiano o internazionale, ad esempio +393331234567.');phone.value=previous;return;}if(v!==previous&&!confirm('Confermi la modifica del cellulare di '+c+'?\\n\\nVecchio numero: '+(previous||'(nessuno)')+'\\nNuovo numero: '+(v||'(nessuno)'))){phone.value=previous;return;}if(v)state.phones[key]=v;else delete state.phones[key];wa.disabled=!v;save();renderTomorrowReminders();};
  wa.onclick=()=>{const link=whatsappLink(phoneFor(c),'Ciao '+c+'! 💈');if(link)window.open(link,'_blank','noopener,noreferrer')};
  const del=document.createElement('button');del.className='danger-btn';del.textContent='Elimina';del.onclick=()=>{if(confirm(`Eliminare ${c}? Gli appuntamenti esistenti non saranno eliminati.`)){state.clients=state.clients.filter(x=>x!==c);delete state.phones[key];delete state.communes[key];save(true);renderAll()}};
  const history=document.createElement('details');history.className='client-history';
  const summary=document.createElement('summary');const completedVisits=apps.filter(a=>a.status==='completed');const last=completedVisits.slice().sort((a,b)=>b.date.localeCompare(a.date))[0];summary.textContent='Storico: '+completedVisits.length+' visite · '+euro(total)+' incassati'+(last?' · Ultima visita '+last.date:'');history.append(summary);
  // Storico creato soltanto alla prima apertura della scheda cliente.
  history.addEventListener('toggle',()=>{if(!history.open||history.dataset.loaded)return;history.dataset.loaded='1';
   for(const a of visitHistory(c)){const line=document.createElement('div');line.className='history-line';
    line.textContent=`${a.date} ${a.time} · ${a.service} · ${euro(a.price)} · ${statusLabel(a.status)}${isPaidVisit(a)?' · Pagato':''}`;history.append(line);}
  });
  r.append(info,comune,phone,wa,history,del);fragment.appendChild(r);
 });
 list.appendChild(fragment);
 if(matching.length>clientPageSize){const more=document.createElement('button');more.type='button';more.className='ghost-btn';more.textContent=`Mostra altri clienti (${matching.length-clientPageSize} rimanenti)`;more.onclick=()=>{clientPageSize+=60;renderClients()};list.append(more);}
 // Le opzioni sono necessarie solo durante la prenotazione; non ricrearle ad ogni ricerca.
 if(clientSuggestionsVersion!==state.clients.length){clientSuggestionsVersion=state.clients.length;const suggestions=$('clientSuggestions');suggestions.replaceChildren();const options=document.createDocumentFragment();state.clients.forEach(c=>{const opt=document.createElement('option');opt.value=c;options.append(opt)});suggestions.append(options);}
}

function renderStats(){}
function isPaidVisit(a){return a.status==='completed' && a.paid===true}
function isPlannedVisit(a){return a.status!=='cancelled'&&a.status!=='noshow'}
function statusLabel(s){return ({booked:'Prenotato',completed:'Completato',cancelled:'Annullato',noshow:'Assente'})[s]||'Prenotato'}
function visitHistory(name){
 return state.appointments.filter(a=>clientKey(a.client)===clientKey(name))
   .sort((a,b)=>(b.date+' '+b.time).localeCompare(a.date+' '+a.time));
}
function openAppointment(app){const isEdit=!!app.id;$('appointmentTitle').textContent=isEdit?'Modifica appuntamento':'Nuovo appuntamento';$('editingAppointmentId').value=app.id||'';$('appointmentClient').value=app.client||'';$('appointmentTime').value=app.time||'08:00';$('appointmentTime').step='60';$('appointmentService').replaceChildren();
 const selectedName=app.service||'Taglio';
 for(const name of Object.keys(services)){const opt=document.createElement('option');opt.value=name;opt.textContent=name;opt.selected=name===selectedName;$('appointmentService').append(opt)}
 if(app.service&&!services[app.service]){const old=document.createElement('option');old.value=app.service;old.textContent=app.service+' (servizio non più in elenco)';old.selected=true;$('appointmentService').append(old)}const selectedService=app.service||'Taglio';const defaultPrice=services[selectedService]?.prezzo??Number(app.price||0);$('appointmentCustomPrice').value=(isEdit&&Number(app.price||0)!==Number(defaultPrice))?String(app.price):'';$('appointmentNotes').value=app.notes||'';
 $('appointmentStatus').value=app.status||'booked';const durLabel=$('appointmentDurationInfo');const updateDuration=()=>{if(durLabel)durLabel.textContent='Durata prevista: '+durationMinutes({service:$('appointmentService').value,duration:($('appointmentService').value===app.service?app.duration:undefined)})+' minuti'};updateDuration();
 $('appointmentPaid').checked=app.paid===true;
 $('appointmentPaid').disabled=(app.status||'booked')!=='completed';
 $('appointmentStatus').onchange=()=>{$('appointmentPaid').disabled=$('appointmentStatus').value!=='completed';if($('appointmentPaid').disabled)$('appointmentPaid').checked=false};$('appointmentPhone').value=phoneFor(app.client||'');$('whatsappAppointmentBtn').classList.toggle('hidden',!isEdit);$('whatsappAppointmentBtn').onclick=()=>openWhatsApp(app);$('appointmentCustomPrice').placeholder=`Lascia vuoto per usare ${euro(defaultPrice)}`;$('appointmentService').onchange=()=>{updateDuration();$('appointmentCustomPrice').placeholder=`Lascia vuoto per usare ${euro((services[$('appointmentService').value]?.prezzo??Number(app.price||0)))}`};$('deleteAppointmentBtn').classList.toggle('hidden',!isEdit);$('appointmentDialog').showModal()}

function closeAppointmentDialog(){
  $('appointmentDialog').close();
  
  
  
}
$('closeAppointmentDialog').onclick=closeAppointmentDialog;
$('cancelAppointmentBtn').onclick=closeAppointmentDialog;
$('appointmentDialog').addEventListener('click',e=>{if(e.target===$('appointmentDialog'))closeAppointmentDialog()});
$('appointmentDialog').addEventListener('cancel',e=>{e.preventDefault();closeAppointmentDialog()});
function normalizeClientName(name){const clean=name.trim().replace(/\s+/g,' ');return clean?clean[0].toUpperCase()+clean.slice(1):''}
$('appointmentClient').addEventListener('change',()=>{$('appointmentPhone').value=phoneFor($('appointmentClient').value)});
let appointmentSubmitBusy=false;
$('appointmentForm').addEventListener('submit',e=>{if(appointmentSubmitBusy)return;e.preventDefault();const reason=closureReason(iso(state.date));if(reason&&!confirm('Giorno di riposo o chiusura: '+reason+'\n\nVuoi autorizzare comunque questa prenotazione?'))return;const id=$('editingAppointmentId').value||uid();const service=$('appointmentService').value;const client=normalizeClientName($('appointmentClient').value);if(!client)return;const customRaw=String($('appointmentCustomPrice').value||'').replace(',','.').trim();const customPrice=customRaw===''?null:Number(customRaw);const finalPrice=customPrice!==null&&!Number.isNaN(customPrice)?customPrice:(services[service]?.prezzo??Number(state.appointments.find(a=>a.id===id)?.price||0));const obj={id,client,service,time:$('appointmentTime').value,price:finalPrice,notes:$('appointmentNotes').value.trim(),status:$('appointmentStatus').value,duration:($('appointmentService').value===state.appointments.find(a=>a.id===id)?.service?state.appointments.find(a=>a.id===id)?.duration:undefined)??services[service]?.durata??1,paid:$('appointmentStatus').value==='completed'&&$('appointmentPaid').checked,date:iso(state.date)};const conflicts=(obj.status==='cancelled'||obj.status==='noshow')?[]:overlapAppointments(obj);if(conflicts.length){alert('Orario non disponibile: il servizio si sovrappone a '+conflicts.map(a=>a.client+' ('+a.time+', '+durationMinutes(a)+' min)').join(', ')+'. Scegli un altro orario.');return;}// Verifica prima di modificare lo stato, così una conferma annullata non altera l'archivio.
const phoneRaw=$('appointmentPhone').value.trim();let phone='';
if(phoneRaw){phone=normalizePhone(phoneRaw);if(!phone){alert('Numero di cellulare non valido.');return;}const old=phoneFor(obj.client);if(old!==phone&&!confirm('Confermi la modifica del numero nell’anagrafica di '+obj.client+'?\n\nVecchio: '+(old||'(nessuno)')+'\nNuovo: '+phone))return;}
if(window.archiveUnavailable){alert('Archivio non disponibile: impossibile salvare.');return;}
appointmentSubmitBusy=true;
try{
 const idx=state.appointments.findIndex(a=>a.id===id);
 idx>=0?state.appointments[idx]=obj:state.appointments.push(obj);
 if(!state.clients.some(c=>c.toLowerCase()===obj.client.toLowerCase()))state.clients.push(obj.client);
 if(phone)state.phones[clientKey(obj.client)]=phone;
 save(); // Stesso archivio IndexedDB e stesso formato della versione funzionante.
 $('appointmentDialog').close();
 // Aggiorna solo l'Agenda. Home, clienti e Gestionale ricalcolano i dati all'apertura.
 renderAgendaDay();
}finally{appointmentSubmitBusy=false;}});
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
  const paidApps=apps.filter(isPaidVisit);const total=paidApps.reduce((x,a)=>x+Number(a.price||0),0);const plannedApps=apps.filter(isPlannedVisit);const projectedTotal=plannedApps.reduce((x,a)=>x+Number(a.price||0),0);
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
  return {type,ref,s,e,apps,paidApps,total,projectedTotal,plannedApps,ranking,rankingVisits,label:periodLabel(type,s,e,ref)};
}
function renderReport(){
  const data=getFilteredReportData();
  const clients=data.ranking.length;
  $('metricIncome').textContent=euro(data.projectedTotal);const actual=$('actualIncome');if(actual)actual.textContent='Incassi confermati: '+euro(data.total);
  $('metricCount').textContent=data.apps.length;
  $('metricClients').textContent=clients;
  const rows=data.ranking.map((r,i)=>`<tr><td>${i+1}</td><td>${r.client}</td><td>${r.visits}</td><td>${euro(r.spent)}</td></tr>`).join('');
  $('clientRanking').innerHTML=`<h3>Classifica clienti</h3><p class="muted">Periodo: ${data.label}</p><div class="ranking-table-wrap"><table class="ranking-table"><thead><tr><th>#</th><th>Cliente</th><th>Visite</th><th>Spesa totale</th></tr></thead><tbody>${rows||'<tr><td colspan="4">Nessun dato nel periodo selezionato</td></tr>'}</tbody></table></div>`;
  renderRevenueChart(data);renderServiceRanking(data);
  $('reportText').textContent=`REPORT BARBER PRO
Periodo: ${data.label}

Totale previsto dagli appuntamenti: ${euro(data.projectedTotal)}\nIncassi confermati: ${euro(data.total)}
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
let currentView='home';
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
function renderAgendaDay(){renderWeek();renderAgenda();}
function renderAll(){renderHome();applyAppName();applyBrandImage();renderServiceSettings();renderWeek();renderAgenda();if($('clienti').classList.contains('active'))renderClients();renderTomorrowReminders();renderStats();renderReport();renderClosures()}
$('cancelledAppointmentsBtn').onclick=showCancelledAppointments;$('closeCancelledArchiveBtn').onclick=()=>$('cancelledAppointmentsDialog').close();$('confirmQuickStatusBtn').onclick=applyQuickStatus;$('cancelQuickStatusBtn').onclick=()=>{$('quickStatusDialog').close();pendingQuickStatus=null};$('quickStatusDialog').addEventListener('close',()=>{pendingQuickStatus=null});$('reminderDayFilter').onchange=renderTomorrowReminders;$('clientSearch').oninput=()=>{clientPageSize=60;renderClients()};$('closureForm').onsubmit=e=>{e.preventDefault();const start=$('closureStart').value,end=$('closureEnd').value,reason=$('closureReason').value.trim()||'Chiusura straordinaria';if(!start||!end||end<start){alert('Controlla le date della chiusura.');return;}state.closures.push({id:uid(),start,end,reason});save();$('closureForm').reset();renderAll();alert('Chiusura registrata. Gli appuntamenti rimangono possibili previa conferma.')};$('compactAgendaBtn').onclick=()=>{agendaMode='compact';renderAgenda()};$('detailAgendaBtn').onclick=()=>{agendaMode='detail';renderAgenda()};document.querySelectorAll('.nav-btn').forEach(b=>b.onclick=()=>setView(b.dataset.view));document.querySelectorAll('[data-home-link]').forEach(b=>b.onclick=()=>setView(b.dataset.homeLink));$('prevWeek').onclick=()=>{state.date.setDate(state.date.getDate()-7);renderAgendaDay()};$('nextWeek').onclick=()=>{state.date.setDate(state.date.getDate()+7);renderAgendaDay()};$('datePicker').onchange=e=>{state.date=new Date(e.target.value+'T12:00:00');renderAgendaDay()};$('reportDate').value=iso(new Date());$('periodFilter').onchange=renderReport;$('reportDate').onchange=renderReport;$('printReportBtn').onclick=()=>window.print();$('printClientRankingBtn').onclick=printClientRanking;$('addClientBtn').onclick=()=>{const n=normalizeClientName($('newClientName').value);const raw=$('newClientPhone').value.trim();const phone=normalizePhone(raw);if(!n){alert('Inserisci il nome del cliente.');return;}if(state.clients.some(c=>clientKey(c)===clientKey(n))){alert('Cliente già presente: modifica i dati nella scheda sottostante.');return;}if(raw&&!phone){alert('Numero di cellulare non valido.');return;}state.clients.push(n);if(phone)state.phones[clientKey(n)]=phone;const comune=$('newClientCommune').value.trim();if(comune)state.communes[clientKey(n)]=comune;['newClientName','newClientPhone','newClientCommune'].forEach(id=>$(id).value='');save();renderAll()};
$('backupExportBtn').onclick=()=>$('exportBtn').click();$('backupImportFile').onchange=e=>{const file=e.target.files?.[0];e.target.value='';if(file)inspectBackupFile(file);};$('refreshLocalBtn').onclick=()=>{$('restoreLocalBtn').click();refreshBackupCenter()};
$('importClientsFile').onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{importClientsFromJsonText(r.result)}catch(err){alert('File clienti JSON non valido. Deve contenere una lista di nomi, oppure {clients:[...]} / {clienti:[...]}')}};r.readAsText(f);e.target.value=''};
$('exportBtn').onclick=async()=>{
  await saveQueue;
  const data={format:'barber-pro-backup',version:6,exportedAt:new Date().toISOString(),appointments:state.appointments,clients:state.clients,phones:state.phones,communes:state.communes,closures:state.closures,reminders:state.reminders,appName:state.appName,services,brandImage:state.brandImage};
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
async function restoreLocalSnapshot(key){const db=await openDb();const record=await new Promise((resolve,reject)=>{const req=db.transaction('archive','readonly').objectStore('archive').get(key);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)});if(!record||!record.data||!Array.isArray(record.data.appointments)||!Array.isArray(record.data.clients))throw Error('Copia non valida');if(!confirm('Ripristinare la copia del '+(record.createdAt?backupDateLabel(record.createdAt):key)+'? I dati attuali verranno sostituiti. Esporta prima un backup esterno.'))return;await saveQueue;await createLocalSnapshot(true);state.appointments=record.data.appointments;state.clients=record.data.clients;state.phones=record.data.phones||{};state.communes=record.data.communes||{};state.closures=record.data.closures||[];state.reminders=record.data.reminders||{};state.appName=validAppName(record.data.appName);services=validServices(record.data.services);state.brandImage=validBrandImage(record.data.brandImage);save();await saveQueue;renderAll();alert('Copia locale ripristinata.');}
$('restoreLocalBtn').onclick=async()=>{try{const keys=await listLocalSnapshots();const db=await openDb();const el=$('localBackupList');el.replaceChildren();if(!keys.length){el.textContent='Nessuna copia locale disponibile.';return;}for(const key of keys){const btn=document.createElement('button');btn.className='ghost-btn';const record=await new Promise((resolve,reject)=>{const req=db.transaction('archive','readonly').objectStore('archive').get(key);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)});btn.textContent='Ripristina copia del '+(record?.createdAt?backupDateLabel(record.createdAt):key.replace('snapshot-',''));btn.onclick=()=>restoreLocalSnapshot(key).catch(e=>alert(e.message));el.append(btn);}}catch(e){alert('Impossibile leggere le copie locali: '+e.message)}};
// Parser vCard 3/4: supporto base a FN, N e TEL, linee ripiegate.
function parseVcf(text){const cards=String(text).replace(/\r\n/g,'\n').replace(/\r/g,'\n').replace(/\n[ \t]/g,'').split(/BEGIN:VCARD/i).slice(1);const out=[];for(const card of cards){const body=card.split(/END:VCARD/i)[0];const lines=body.split('\n');let name='',fallback='',phone='';for(const line of lines){const idx=line.indexOf(':');if(idx<0)continue;const field=line.slice(0,idx).toUpperCase().split(';')[0].replace(/^ITEM\d+\./,'');const value=line.slice(idx+1).replace(/\\n/gi,' ').replace(/\\,/g,',').trim();if(field==='FN')name=value;else if(field==='N')fallback=value.split(';').filter(Boolean).reverse().join(' ');else if(field==='TEL'&&!phone)phone=normalizePhone(value.replace(/^tel:/i,''));}if(name||fallback)out.push({name:normalizeClientName(name||fallback),phone});}return out;}
$('importVcfFile').onchange=async e=>{const f=e.target.files?.[0];e.target.value='';if(!f)return;try{const entries=parseVcf(await f.text());if(!entries.length)throw Error('Nessun contatto riconosciuto. Esporta i contatti in formato vCard (.vcf).');if(!confirm('Importare '+entries.length+' contatti? I nomi già presenti verranno mantenuti; i cellulari esistenti non saranno sovrascritti.'))return;let added=0,numbers=0;const knownClients=new Set(state.clients.map(clientKey));for(const entry of entries){const entryKey=clientKey(entry.name);if(!knownClients.has(entryKey)){state.clients.push(entry.name);knownClients.add(entryKey);added++;}const key=clientKey(entry.name);if(entry.phone&&!state.phones[key]){state.phones[key]=entry.phone;numbers++;}}save();await saveQueue;renderAll();$('contactImportStatus').textContent=`Importati ${added} nuovi clienti e ${numbers} numeri. Controlla eventuali omonimi.`;}catch(err){alert('Importazione VCF non riuscita: '+err.message)}};

function showGlobalSearch(){
 const q=$('globalSearch').value.trim().toLocaleLowerCase('it-IT');const panel=$('globalSearchResults');panel.replaceChildren();panel.hidden=q.length<2;if(q.length<2)return;
 const matches=[];
 for(const name of state.clients){if(name.toLocaleLowerCase('it-IT').includes(q)||phoneFor(name).includes(q))matches.push({label:'👤 '+name,sub:'Cliente · '+(phoneFor(name)||'Nessun cellulare'),action:()=>{setView('clienti');$('clientSearch').value=name;renderClients()}})}
 for(const a of state.appointments){if(a.client.toLocaleLowerCase('it-IT').includes(q)||a.service.toLocaleLowerCase('it-IT').includes(q)||a.date.includes(q)){matches.push({label:'📅 '+a.client+' · '+a.time,sub:a.date+' · '+a.service+' · '+statusLabel(a.status),action:()=>{state.date=new Date(a.date+'T12:00:00');setView('agenda');renderAgendaDay()}})}}
 matches.slice(0,20).forEach(m=>{const b=document.createElement('button');b.type='button';b.className='global-result';const strong=document.createElement('strong');strong.textContent=m.label;const small=document.createElement('small');small.textContent=m.sub;b.append(strong,small);b.onclick=()=>{m.action();$('globalSearch').value='';panel.hidden=true};panel.append(b)});
 if(!matches.length){const p=document.createElement('p');p.textContent='Nessun risultato';panel.append(p)}
}
$('globalSearch').addEventListener('input',showGlobalSearch);
$('homeTopBtn').onclick=()=>setView('home');
$('homeNewAppointment').onclick=()=>{state.date=new Date();setView('agenda');renderAgendaDay();openAppointment({date:iso(state.date),time:'08:00'})};
$('agendaToday').onclick=()=>{state.date=new Date();renderAgendaDay()};
$('agendaTomorrow').onclick=()=>{const d=new Date();d.setDate(d.getDate()+1);state.date=d;renderAgendaDay()};
setupServiceSettings();setupBrandImage();load().then(async()=>{renderAll();if(!window.archiveUnavailable){try{await createLocalSnapshot();await cleanLocalSnapshots();}catch(e){console.error('Backup locale:',e);}}});


// Verifica e ripristino non distruttivo. Nessun file o dato personale viene trasmesso.
let inspectedBackup=null;
function backupDateKey(raw){
 let value='';
 if(typeof raw==='string'){
  const s=raw.trim();
  let m=s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T\s].*)?$/);
  if(m)value=`${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;
  else {m=s.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})(?:\s.*)?$/);if(m)value=`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;}
 }else if(typeof raw==='number'&&Number.isFinite(raw)){
  const d=new Date(raw);if(!Number.isNaN(d.getTime()))value=iso(d);
 }
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return null;
 const [y,mo,day]=value.split('-').map(Number);
 const test=new Date(y,mo-1,day,12);
 return test.getFullYear()===y&&test.getMonth()===mo-1&&test.getDate()===day?value:null;
}
function backupTimeKey(raw,rawDate){
 let value=typeof raw==='string'?raw.trim():'';
 if(!value&&typeof rawDate==='string'){
  const m=rawDate.match(/[T\s](\d{1,2}):(\d{2})/);if(m)value=m[1]+':'+m[2];
 }
 const m=value.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
 if(!m)return null;
 const h=Number(m[1]),min=Number(m[2]);
 return h>=0&&h<=23&&min>=0&&min<=59?`${String(h).padStart(2,'0')}:${String(min).padStart(2,'0')}`:null;
}
function inspectBackupData(raw){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('Il file JSON non contiene un archivio Barber Pro.');
 const d=raw.data&&typeof raw.data==='object'&&Array.isArray(raw.data.appointments)?raw.data:raw;
 const appointmentsRaw=Array.isArray(d.appointments)?d.appointments:Array.isArray(d.appuntamenti)?d.appuntamenti:null;
 const clientsRaw=Array.isArray(d.clients)?d.clients:Array.isArray(d.clienti)?d.clienti:null;
 const problems=[],warnings=[];
 if(!appointmentsRaw)problems.push('Nel file manca la lista degli appuntamenti (appointments).');
 if(!clientsRaw)problems.push('Nel file manca la lista dei clienti (clients).');
 const appointments=[],clients=[];
 let changedDates=0,changedTimes=0,changedIds=0;
 const ids=new Set();
 if(appointmentsRaw){
  for(let i=0;i<appointmentsRaw.length;i++){
   const a=appointmentsRaw[i];
   if(!a||typeof a!=='object'||Array.isArray(a)){problems.push(`Appuntamento ${i+1}: record non valido.`);continue;}
   const id=(typeof a.id==='string'||typeof a.id==='number')?String(a.id).trim():'';
   const date=backupDateKey(a.date??a.data);
   const time=backupTimeKey(a.time??a.ora,a.date??a.data);
   const client=typeof a.client==='string'?a.client.trim():typeof a.cliente==='string'?a.cliente.trim():'';
   const service=typeof a.service==='string'?a.service.trim():typeof a.servizio==='string'?a.servizio.trim():'';
   const missing=[];
   if(!id)missing.push('identificativo');
   if(!date)missing.push('data');
   if(!time)missing.push('ora');
   if(!client)missing.push('cliente');
   if(!service)missing.push('servizio');
   if(id&&ids.has(id))missing.push('ID duplicato');
   if(missing.length){problems.push(`Appuntamento ${i+1}: ${missing.join(', ')} non valido/i.`);continue;}
   ids.add(id);
   if(date!==a.date)changedDates++;
   if(time!==a.time)changedTimes++;
   if(id!==a.id)changedIds++;
   appointments.push({...a,id,date,time,client,service});
  }
 }
 if(clientsRaw){
  for(let i=0;i<clientsRaw.length;i++){
   const name=normalizeImportedClientName(clientsRaw[i]);
   if(!name){problems.push(`Cliente ${i+1}: nome non valido.`);continue;}
   clients.push(name);
  }
 }
 if(appointmentsRaw&&appointmentsRaw.length===0)problems.push('Il backup contiene ZERO appuntamenti: il ripristino è bloccato per evitare di cancellare le prenotazioni esistenti.');
 if(clientsRaw&&clientsRaw.length===0&&state.clients.length>0)problems.push('Il backup contiene ZERO clienti: il ripristino è bloccato per evitare di cancellare la rubrica esistente.');
 if(changedDates||changedTimes||changedIds)warnings.push(`Campi adattati per compatibilità: ${changedDates} date, ${changedTimes} orari, ${changedIds} ID.`);
 const dates=appointments.map(a=>a.date).sort();
 const counts={booked:0,completed:0,cancelled:0,noshow:0,other:0};
 for(const a of appointments){const status=a.status||'booked';if(Object.prototype.hasOwnProperty.call(counts,status))counts[status]++;else counts.other++;}
 const data={appointments,clients,phones:d.phones&&typeof d.phones==='object'&&!Array.isArray(d.phones)?d.phones:{},communes:d.communes&&typeof d.communes==='object'&&!Array.isArray(d.communes)?d.communes:{},closures:Array.isArray(d.closures)?d.closures:[],reminders:d.reminders&&typeof d.reminders==='object'&&!Array.isArray(d.reminders)?d.reminders:{},appName:validAppName(d.appName),services:validServices(d.services),brandImage:validBrandImage(d.brandImage)};
 return {data,problems,warnings,dates,counts,rawAppointments:appointmentsRaw?.length??null,rawClients:clientsRaw?.length??null};
}
function displayBackupPreview(info,filename,error){
 const dialog=$('backupPreviewDialog'),panel=$('backupPreviewReport');
 panel.replaceChildren();
 const line=(value,cls)=>{const p=document.createElement('p');p.textContent=value;if(cls)p.className=cls;panel.append(p)};
 line('File: '+filename,'backup-preview-filename');
 if(error){line('Impossibile verificare: '+error,'backup-preview-error');$('backupPreviewRestore').disabled=true;}
 else{
  line('Appuntamenti nel backup: '+info.rawAppointments,'backup-preview-count');
  line('Clienti nel backup: '+info.rawClients,'backup-preview-count');
  line('Appuntamenti attualmente nell’app: '+state.appointments.length);
  if(info.dates.length){line('Periodo: '+info.dates[0]+' → '+info.dates[info.dates.length-1]);line(`Prenotati: ${info.counts.booked} · Completati: ${info.counts.completed} · Annullati: ${info.counts.cancelled} · Assenti: ${info.counts.noshow}`);}
  for(const warning of info.warnings)line('ℹ '+warning,'backup-preview-warning');
  if(info.problems.length){line('Problemi rilevati ('+info.problems.length+'):','backup-preview-error');for(const issue of info.problems.slice(0,8))line('• '+issue,'backup-preview-error');if(info.problems.length>8)line('… e altri '+(info.problems.length-8)+' problemi.');}
  else{line('✓ Backup verificato: tutti gli appuntamenti hanno ID, data, ora, cliente e servizio validi.','backup-preview-ok');if(info.rawAppointments<state.appointments.length)line('⚠ Questo backup contiene meno appuntamenti dell’archivio attuale. Il ripristino sostituirà l’archivio, non unirà le prenotazioni.','backup-preview-warning');}
  $('backupPreviewRestore').disabled=!!info.problems.length;
 }
 if(!dialog.open)dialog.showModal();
}
async function inspectBackupFile(file){
 inspectedBackup=null;
 if(!file)return;
 if(file.size>25*1024*1024){displayBackupPreview(null,file.name,'File troppo grande (massimo 25 MB).');return;}
 try{
  const raw=JSON.parse(await file.text());
  const result=inspectBackupData(raw);
  if(!result.problems.length)inspectedBackup=result;
  displayBackupPreview(result,file.name,null);
 }catch(err){displayBackupPreview(null,file.name,err.message||'JSON non valido.');}
}
function restoreDateChoice(appointments){
 const dates=[...new Set(appointments.map(a=>a.date))].sort();
 const today=iso(new Date());return dates.find(d=>d>=today)||dates[dates.length-1]||today;
}
async function restoreInspectedBackup(){
 if(!inspectedBackup||inspectedBackup.problems.length||window.archiveUnavailable)return;
 const {data}=inspectedBackup;
 const question=`Il backup contiene ${data.appointments.length} appuntamenti e ${data.clients.length} clienti.\n\nVuoi SOSTITUIRE l'archivio attuale (${state.appointments.length} appuntamenti)?\n\nUna copia locale protetta verrà creata prima del ripristino. Conserva anche un backup JSON esterno.`;
 if(!confirm(question))return;
 const button=$('backupPreviewRestore');button.disabled=true;button.textContent='Ripristino in corso…';
 let previous=null,written=false;
 try{
  await saveQueue;
  if(window.archiveUnavailable)throw Error('Archivio non disponibile: ripristino interrotto.');
  previous=await readArchive();
  if(!previous)throw Error('Archivio corrente non disponibile. Ripristino interrotto.');
  await createLocalSnapshot(true);
  await writeArchive(data);written=true;
  const persisted=await readArchive();
  if(!persisted||!Array.isArray(persisted.appointments)||persisted.appointments.length!==data.appointments.length||!Array.isArray(persisted.clients)||persisted.clients.length!==data.clients.length||!persisted.appointments.every((a,i)=>a.id===data.appointments[i].id&&a.date===data.appointments[i].date&&a.time===data.appointments[i].time))throw Error('La verifica dopo il salvataggio non è riuscita.');
  state.appointments=persisted.appointments;
  state.clients=persisted.clients;
  state.phones=persisted.phones||{};state.communes=persisted.communes||{};state.closures=persisted.closures||[];state.reminders=persisted.reminders||{};
  state.appName=validAppName(persisted.appName);services=validServices(persisted.services);state.brandImage=validBrandImage(persisted.brandImage);
  invalidatePerformanceIndex();
  const report={at:new Date().toISOString(),appointments:state.appointments.length,clients:state.clients.length};
  try{localStorage.setItem('barber-last-restore-report',JSON.stringify(report));}catch(_e){}
  updateLastRestoreStatus();
  inspectedBackup=null;$('backupPreviewDialog').close();
  state.date=new Date(restoreDateChoice(state.appointments)+'T12:00:00');
  renderAll();setView('agenda');renderAgendaDay();
  alert(`Ripristino verificato.\nAppuntamenti salvati: ${report.appointments}\nClienti salvati: ${report.clients}\nL’Agenda è stata aperta su una data presente nel backup.`);
 }catch(err){
  let rollback='';
  if(written&&previous){try{await writeArchive(previous);rollback=' Archivio precedente ripristinato.';}catch(e){rollback=' ATTENZIONE: non è stato possibile ripristinare automaticamente l’archivio precedente. Non inserire altri dati; conserva il backup esterno.';}}
  alert('Ripristino non confermato: '+(err.message||String(err))+rollback);
 }finally{button.textContent='Ripristina dopo verifica';button.disabled=!inspectedBackup;}
}
function updateLastRestoreStatus(){
 const el=$('backupLastRestoreStatus');if(!el)return;
 try{const value=JSON.parse(localStorage.getItem('barber-last-restore-report')||'null');el.textContent=value?`Ultimo ripristino verificato: ${new Date(value.at).toLocaleString('it-IT')} · ${value.appointments} appuntamenti · ${value.clients} clienti.`:'Nessun ripristino verificato su questo dispositivo.';}catch(e){el.textContent='Nessun ripristino verificato su questo dispositivo.';}
}
$('restoreBackupFile').onchange=e=>{const file=e.target.files?.[0];e.target.value='';if(file)inspectBackupFile(file);};
$('importFile').onchange=e=>{const file=e.target.files?.[0];e.target.value='';if(file)inspectBackupFile(file);};
$('backupPreviewClose').onclick=()=>{$('backupPreviewDialog').close();inspectedBackup=null;};
$('backupPreviewDialog').addEventListener('close',()=>{inspectedBackup=null;});
$('backupPreviewRestore').onclick=restoreInspectedBackup;
updateLastRestoreStatus();
