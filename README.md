# Die Räuber · Theater-Teleprompter

Browserbasierter Teleprompter ausschließlich für das formatierte Bühnenmanuskript **„Die Räuber“**. Optimiert für iPad, Smartphone, Notebook und externe Bildschirme.

## Datenbasis

Der vollständige Text ist fest im Repository enthalten. Vier unveränderliche Datenpakete werden beim Öffnen gemeinsam geladen, im Browser entpackt und anschließend streng validiert. Es gibt keinen Dokumentimport, keine frei austauschbaren Stücke und keine externe JavaScript-Bibliothek.

- 1.457 nicht-leere Absätze
- 5 Akte
- 15 Szenen
- 63 gedruckte Textseiten plus Titelblatt
- Quelle: `Theater.Text.Neu.formatiert.docx`
- Seitenabgleich: `Theater.Text.Neu.formatiert.pdf`

## Funktionen

- Navigation nach Akt, Szene und gedruckter Seite
- direkter Seitensprung sowie Vor-/Zurück-Tasten
- automatisches Scrollen mit einstellbarem Tempo
- einstellbare Schriftgröße und Zeilenhöhe
- semantische Darstellung von Akt, Szene, Szenenbild, Sprecher, Replik und Regieanweisung
- Leselinie, Nachtmodus und Präsentationsmodus
- responsive Navigation für iPad und Smartphone
- Offline-Nutzung über einen Service Worker

## Tastatur

- `Leertaste`: Start/Pause
- `Pfeil links/rechts`: vorherige/nächste Seite
- `Pfeil hoch/runter`: Tempo ändern
- `F`: Vollbild beziehungsweise Präsentationsmodus
- `M`: Navigation öffnen/schließen

## GitHub Pages

Die Seite besteht ausschließlich aus statischen Dateien und kann direkt aus dem Branch `main` über GitHub Pages veröffentlicht werden. Ein eigener Build- oder Deployment-Workflow ist nicht erforderlich.
