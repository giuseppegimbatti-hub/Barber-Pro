# Barber Pro 2.0 Performance — Ripristino verificato

Base: ZIP Performance originale allegato dall’utente, senza modifiche al database IndexedDB (`barber-pro-ipad-v1`) né al formato di salvataggio degli appuntamenti.

## Correzioni
- Il comando «Importa dati» ora apre la verifica dei backup (prima non era collegato ad alcuna funzione).
- I comandi di ripristino, inclusa la sezione Centro backup, leggono il file direttamente, senza usare `DataTransfer` e senza caricare dati online.
- Anteprima non distruttiva con conteggi clienti/appuntamenti, intervallo date, stati, errori e formati adattati.
- Blocca backup con zero appuntamenti, dati incompleti o ID duplicati: non sovrascrive l'archivio.
- Accetta date ISO e date italiane, orari H:mm/HH:mm:ss, ID numerici convertiti in stringhe, preservando gli altri campi.
- Prima del ripristino crea una copia locale protetta; scrive in IndexedDB, rilegge e verifica conteggi e ID/date/orari. In caso di errore tenta il rollback.
- Dopo un ripristino riuscito apre l'Agenda su una data effettivamente presente nel backup.
- Mostra la data e il numero di appuntamenti dell'ultimo ripristino verificato.

## Procedura consigliata
1. Dalla versione che contiene gli appuntamenti, esporta un backup JSON e salvalo in File / iCloud Drive.
2. Mantieni installata la versione funzionante e non cancellare i dati di Safari.
3. Carica questi file nella stessa repository, senza eliminare IndexedDB.
4. Apri Centro backup → Verifica / ripristina JSON, seleziona il file e leggi il numero di appuntamenti trovato.
5. Se il conteggio è corretto, premi «Ripristina dopo verifica». L'app verifica la scrittura e apre l'Agenda su una data presente nel backup.
6. Se il backup mostra zero appuntamenti, non forzare il ripristino: quel file non contiene le prenotazioni. Cerca un backup precedente esportato dalla versione con gli appuntamenti visibili.

## Limiti
La compatibilità con il file JSON reale dell'utente non è stata verificata perché il file non è stato fornito. Il controllo di sintassi e i test locali non sostituiscono una prova sull'iPad. Le copie locali IndexedDB non sostituiscono un backup esterno.
