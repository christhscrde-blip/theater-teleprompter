# Die Räuber · Theater-Teleprompter

Browserbasierter Teleprompter ausschließlich für das formatierte Bühnenmanuskript **„Die Räuber“**. Optimiert für iPad, Smartphone, Notebook und externe Bildschirme.

## Datenbasis

Der vollständige Text ist fest als `theater-data.js` im Repository enthalten. Der Browser lädt diese eine validierte Direktdatei ohne Base64-Zusammenbau, GZip-Entpackung, externe Bibliothek oder Dokumentimport.

- 1.457 nicht-leere Absätze
- 5 Akte
- 15 Szenen
- 63 gedruckte Textseiten plus Titelblatt
- Quelle: `Theater.Text.Neu.formatiert.docx`
- Seitenabgleich: `Theater.Text.Neu.formatiert.pdf`

Die Prüfdaten zur erzeugten Direktdatei liegen unter `.audit/direct-data-report.json`.

## Funktionen

- Navigation nach Akt, Szene und gedruckter Seite
- direkter Seitensprung sowie Vor-/Zurück-Tasten
- automatisches Scrollen mit einstellbarem Tempo
- einstellbare Schriftgröße und Zeilenhöhe
- semantische Darstellung von Akt, Szene, Szenenbild, Sprecher, Replik und Regieanweisung
- Leselinie, Nachtmodus und Präsentationsmodus
- sichtbarer Touch-Ausgang aus dem Präsentationsmodus
- responsive Navigation für iPad und Smartphone
- Offline-Nutzung über einen Service Worker

## Tastatur

- `Leertaste`: Start/Pause
- `Pfeil links/rechts`: vorherige/nächste Seite
- `Pfeil hoch/runter`: Tempo ändern
- `F`: Vollbild beziehungsweise Präsentationsmodus
- `M`: Navigation öffnen/schließen
- `Escape`: Präsentationsmodus verlassen

## Tests

`tests/v10-acceptance.cjs` prüft die vollständige Textladung, Navigation, Seitenwechsel, Autoscroll, Einstellungen, Theme, Präsentationsmodus, Touch-Ausgang, Tastatursteuerung und Offline-Nutzung in Chromium-Ansichten für Desktop, iPad und iPhone.

## GitHub Pages

Die Seite besteht ausschließlich aus statischen Dateien und kann direkt aus dem Branch `main` über GitHub Pages veröffentlicht werden. Ein eigener Build- oder Deployment-Workflow ist nicht erforderlich.
