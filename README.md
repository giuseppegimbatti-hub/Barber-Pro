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
