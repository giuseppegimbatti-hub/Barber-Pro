# Barber Pro — GitHub Pages

Versione senza galleria fotografica e senza server Python. I dati restano esclusivamente nella memoria locale del browser del dispositivo. Non sono sincronizzati.

## Pubblicazione
1. Crea un repository GitHub pubblico.
2. Carica tutti i file di questa cartella nella radice del repository (non la cartella stessa).
3. Apri Settings → Pages → Build and deployment → Deploy from a branch. Seleziona `main` e `/ (root)`, poi Save.
4. Apri l'indirizzo mostrato da GitHub Pages.
5. Sul tablet usa Aggiungi alla schermata Home / Installa app dal browser.

## Dati e backup
Esporta regolarmente un backup JSON con Esporta backup. Ripristina backup sostituisce l'archivio corrente. La disinstallazione, la cancellazione dei dati del sito o alcune pulizie del browser possono cancellare l'archivio locale.

Se hai dati salvati nella vecchia versione con server, esporta prima un backup JSON dalla vecchia app e importalo nella nuova.

## Protezione dati su iPad
- L'archivio principale è in IndexedDB e viene aggiornato ad ogni modifica. I dati esistenti in localStorage vengono migrati al primo avvio.
- Il promemoria segnala quando non è stato confermato un backup esterno nelle ultime 24 ore. Non effettua backup automatici su iCloud.
- Dopo **Esporta backup**, salva il file JSON nell'app **File → iCloud Drive**, controllando che sia presente. Il download da solo non prova che il file sia al sicuro.
- Prova il ripristino su un dispositivo di test prima di affidarti al sistema.
- Usa sempre la stessa installazione dell'app dalla schermata Home: Safari e l'app installata possono avere archivi distinti.
- GitHub Pages è un sito pubblico: non caricare backup contenenti dati dei clienti nel repository.
- L'archivio locale non è invulnerabile a cancellazione, guasti o disinstallazione.

## Aggiornamento: WhatsApp, rubrica e copie locali
- Nella sezione Clienti, inserisci il cellulare oppure importa una vCard `.vcf` esportata da Contatti su iPad. Importazione non sincronizzata: le modifiche successive alla rubrica non sono automatiche.
- Nell'Agenda, la sezione Promemoria mostra gli appuntamenti di domani. Tocca WhatsApp per aprire il messaggio precompilato e conferma personalmente l'invio. Nessun invio automatico.
- In Gestionale → Protezione dati, puoi visualizzare e ripristinare le copie locali. Sono salvate nello stesso IndexedDB e non proteggono da cancellazione dei dati del browser o guasti del dispositivo.
- I backup JSON includono anche la mappa dei cellulari `phones`. I backup precedenti, senza `phones`, restano importabili.
- Prima di aggiornare il repository, salva un backup JSON esterno su iCloud Drive e verifica che sia leggibile. Aggiorna i file del repository senza eliminare l'app installata sull'iPad.
- L'importazione vCard di base supporta nomi e numeri comuni, non tutti i formati speciali di Contatti. Controlla omonimi e numeri importati.
- I dati di contatto sono personali: non caricare file VCF o backup JSON nel repository GitHub pubblico. Usa WhatsApp solo con clienti che hanno accettato di ricevere comunicazioni.

## Protezione locale aggiornata
- Copia giornaliera all’apertura (se archivio disponibile), conservata fino a 30 giorni; la copia giornaliera non viene sovrascritta dalle modifiche successive.
- Copie protette prima della cancellazione di un cliente o appuntamento (fino a 30 copie protette).
- Esportare ogni giorno il JSON in iCloud Drive: le copie IndexedDB possono essere cancellate insieme ai dati del browser.
- Il ripristino sostituisce l’intero archivio, non un singolo appuntamento.


## Aggiornamento anagrafica e WhatsApp (28 ottobre 2026)
- Nuovo cliente: Nome e cognome, Comune, Cellulare.
- In Clienti: Comune e Cellulare modificabili; il numero resta nell'anagrafica.
- Durante la prenotazione il numero è recuperato dal cliente selezionato e, se inserito, salvato nell'anagrafica.
- Pulsante WhatsApp sulla scheda cliente e su appuntamenti già salvati. L'invio del messaggio è manuale.
- Backup JSON include `phones` e `communes`; import di backup precedenti supportato.
- Pubblicare **tutti** i file dello ZIP nella radice del repository, non solo `index.html`.
- Cache PWA aggiornata con strategia online-prima; per controllare la versione, ricaricare il sito online.

Aggiornamento: lunedi contrassegnati in rosso come riposo settimanale (prenotazioni non bloccate).


## Fase 2 - Agenda e chiusure
- La vista compatta mostra gli slot dalle 08:00 alle 21:00.
- Nuova sezione Ferie e chiusure: intervalli con motivo, eliminazione, evidenziazione in calendario.
- Nei giorni di riposo/chiusura/festivi, il salvataggio dell'appuntamento chiede conferma, ma resta sempre possibile.
- Le chiusure sono salvate in IndexedDB e incluse nei backup JSON e nelle copie locali.


## Fase 3 — WhatsApp e clienti
- Conferma esplicita quando il cellulare di un cliente cambia, sia in anagrafica sia nella prenotazione.
- Promemoria di oggi/domani: Da inviare, Aperto su WhatsApp, Inviato (confermato manualmente).
- L'apertura del link WhatsApp non garantisce che il messaggio sia stato effettivamente spedito.
- Ricerca clienti per nome o cellulare; storico visite con ultima visita e totale incassato.
- Stati dei promemoria inclusi nel backup JSON e nelle copie locali; ripristino anche delle chiusure.


## Fase 4 — Gestionale avanzato e Centro backup
- Grafico incassi per periodo (solo appuntamenti completati e pagati).
- Servizi più richiesti sulla base degli appuntamenti completati.
- Classifica per numero di visite completate, anche se non ancora pagate.
- Centro backup nel menu laterale con esportazione/importazione JSON, elenco copie locali e indicatore dell'ultimo backup esterno confermato.
- Copie automatiche locali e compatibilità con gli archivi precedenti mantenute.
- Nota: il salvataggio in iCloud Drive deve essere confermato dall'utente.


## Edizione Premium Light
Nuovo tema chiaro verde bosco, superfici bianche, contrasto migliorato, navigazione e agenda ottimizzate per iPad. Le funzionalità JavaScript e i dati locali restano invariati.


## Premium Light — Guide a pop-up e ricerca cliente
- Il pulsante **? Guida** accanto al titolo apre la guida contestuale della sezione.
- La guida si apre automaticamente solo alla prima visita di ogni sezione, usando un flag locale.
- I suggerimenti descrittivi rimangono disponibili nelle guide, ma la selezione cliente usa un vero pop-up.
- In Prenotazione, **Cerca cliente** apre un elenco filtrabile per nome o cellulare e permette di usare un nuovo nome.
- La selezione di un cliente esistente riempie automaticamente nome e cellulare.

## Nuovo: Servizi e impostazioni
- Nel menu laterale **Servizi e impostazioni** puoi cambiare il nome mostrato nel gestionale.
- Puoi aggiungere, rinominare, eliminare servizi e modificarne prezzo e durata.
- I servizi eliminati non vengono cancellati dallo storico; i prezzi degli appuntamenti già registrati non cambiano.
- Le modifiche al listino e al nome sono salvate in IndexedDB e incluse nel backup JSON.
- Il nome visualizzato sotto l'icona PWA già installata su iPad non cambia necessariamente: è definito dal manifest pubblicato e può richiedere una nuova installazione del collegamento. Cambiare il nome in-app non modifica automaticamente il manifest statico.
- La durata è un attributo del listino; la griglia dell'Agenda mantiene gli slot di 30 minuti e non blocca automaticamente gli slot successivi.


## v18: Appuntamenti annullati
Gli appuntamenti annullati sono nascosti dalle viste compatta e dettagliata dell’Agenda e non occupano gli slot. Il pulsante «Appuntamenti annullati» apre l’elenco della data selezionata e permette il ripristino previa conferma.

Backup: esportazioni nominate BarberPro_Backup_GG-MM-AAAA_HH-MM-SS.json; copie locali visualizzate con data e ora effettive.
