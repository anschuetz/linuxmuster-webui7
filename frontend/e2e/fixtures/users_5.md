# P121 Druckorakel

`lmn_users_5.pw.mjs` läuft unverändert zuerst gegen Angular, danach gegen den produktiven Vue-Mount auf Satz F. Konten aus der lokalen E2E-Konfiguration; Klassen, Schule, Vorlagen, Customkonfiguration und sämtliche Druck-/Downloadantworten sind synthetisch. Ein Context-Guard sperrt jeden nicht abgefangenen LMN-POST und Download. Browserdateien werden nur als Downloadfixtures geliefert, keine Geheimnisdatei wird auf der VM erzeugt. Klassen- und Latex-GET zur Rechteprüfung laufen separat über `page.request` gegen das echte Backend.

Fälle: Sidebar und direkte lesende APIs G/S/L/U; PDF/CSV und identische vollständige Payloads je G/S/L; Templates/default/custom, Einzelseite, pdflatex; Mehrfachauswahl und alle+Klasse auch bei Einzelknopf; Abbruch; beide CSV-Alle-Pfade; Dateinamen; leere Klassen/Adminwarnung; Klassen-Ladefehler; Anwendungs-/HTTP-Druckfehler; Identitätswechsel mit neuer Schule und Root-Ausnahme. Identitätswechsel ist synthetisch: Angular-Identity wird ersetzt, beim Vue-Mount über den vorhandenen `aj.identity.refresh()`-Vertrag veröffentlicht. Es findet kein echter Kontowechsel statt.

## Quellvertrag und erhaltene Eigenheiten

Referenz vor Port: `resources/js/controllers/printPasswords.controller.coffee`, `resources/partial/print-passwords{,.options.modal}.html` im Users-Plugin, `views/passwords.py:224–438` unverändert.

- `classes` bleibt bis erfolgreicher Antwort undefined; Fehlantwort behält Spinner/alte Liste. Nur Benutzername löst das Nachladen der aktiven Schule aus; Auswahl bleibt über den Wechsel erhalten. Root/null/undefined werden übersprungen.
- `selection` mit leerem String und Klasse warnt und sperrt auch Einzel-PDF; CSV bleibt möglich. Auswahlreihenfolge bleibt erhalten, keine Sortierung im Frontend.
- Optionsdialog schickt Klassen als Array; CSV-Knöpfe schicken einen String. Alle-PDF `['']` ist ein truthy Array: Backend-Prüfung `if not schoolclass` greift nicht; `schoolclass == 'teachers'` greift bei `['teachers']` ebenfalls nicht. Keine Korrektur in P121.
- Batch-PDF `/passwords/print` braucht `teachers:read` (Backend TODO), Klassenliste/Optionsdruck/CSV/Download `passwords`; CSV prüft leere Klasse und String `teachers` zusätzlich mit `teachers:read`. Lehrer hat `passwords`, aber kein `teachers:read`; Schüler hat keines davon. Templates brauchen `schoolsettings`. Nur verweigerte lesende APIs werden real geprüft, Druck-POSTs ausschließlich fixturiert.
- CSV-Modus im Optionsdialog schickt weiter `/users/print` und zeigt die PDF-Erfolgsmeldung; `format` bestimmt den Downloadnamen. Kein Aufruf des CSV-Endpunkts an dieser Stelle.
- Download erfolgt wie Original mit `location.href`; kein `window.open`. Einzel-Alle-PDF heißt `add-USER.pdf`, Mehrfachdruck `multiclass-USER.FORMAT`. Linke Alle-CSV heißt `-USER.csv`, rechte Alle-CSV `add-USER.csv`.
- Root wird nur im Optionsdialog zu global-admin normalisiert. Dialogtitel für `['']` ist „Klasse: “, weil CoffeeScript strikt vergleicht. Admin-Vorlagenprüfung bleibt `adminClass.includes('admins')`, mit gleicher String-/Array-Semantik. Erste Vorlagen werden schon vor Customconfig sichtbar; deren konfigurierte Pfade überschreiben die Vorauswahl.
- Anwendungsfehler schließen den Optionsdialog; HTTP-Fehler schließen nur Fortschritt. Vue unterdrückt Angulars unhandled-promise-Konsolenmeldungen ohne zusätzlichen Toast. Der bestehende Vue-Modalvertrag beendet Dialoge beim Scope-Destroy; spätes Template-Ergebnis wird nach Unmount ignoriert.
- Der vorgeschriebene gemeinsame `useSambaAccess` prüft das Profil reaktiv (P21); die Angular-Direktive ersetzt ihren Inhalt nur einmal nach `identity.promise`. Ein späterer Rollenwechsel kann deshalb den Blocker in Vue neu ein-/ausblenden.
- Batchdruck wird unverändert aus `common/users/passwords.mjs` von `UsersTable.vue`/session_new verwendet; keine zweite Implementierung. Angular-Shared-Controller/-Services bleiben für noch nicht portierte Ansichten erhalten.
