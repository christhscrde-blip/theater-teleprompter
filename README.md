# Theater-Teleprompter

Browserbasierter Teleprompter für das Bühnenmanuskript **„Die Räuber“**, optimiert für iPad, externe Bildschirme und den Einsatz neben der Bühne.

## Funktionen

- vollständiger Text aus `Theater.Text.Neu.formatiert.docx`
- direkte Navigation nach **Akt**, **Szene** und **Seite**
- Seitensprung über Nummerneingabe sowie Vor-/Zurück-Tasten
- automatische Scrollfunktion mit einstellbarem Tempo
- einstellbare Schriftgröße und Zeilenhöhe
- deutliche Darstellung von Akt, Szene, Szenenbild, Sprecher und Replik
- Leseführung im Bildschirmzentrum
- Nachtmodus, Vollbildmodus und Offline-Cache
- responsives Menü für iPad und Smartphone

## Bedienung

- `Leertaste`: Start oder Pause
- `Pfeil links/rechts`: vorherige oder nächste Seite
- `Pfeil hoch/runter`: Scrolltempo ändern
- `F`: Vollbild
- `M`: Navigation öffnen oder schließen

## GitHub Pages

Der Workflow `.github/workflows/pages.yml` veröffentlicht den Inhalt des Repositorys automatisch über GitHub Pages. In den Repository-Einstellungen muss unter **Pages → Build and deployment → Source** einmalig **GitHub Actions** ausgewählt werden.

Die öffentliche Adresse lautet anschließend voraussichtlich:

`https://christhscrde-blip.github.io/theater-teleprompter/`

## Textdaten

Die komprimierten Dateien unter `data/` enthalten 1.457 nicht-leere Absätze, 5 Akte, 15 Szenen und die beim PDF-Rendering ermittelte Aufteilung auf 64 Seiten. Die Word-Formatvorlagen wurden als semantische Typen übernommen.
