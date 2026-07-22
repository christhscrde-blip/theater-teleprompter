# Theater-Teleprompter

Ein einfacher, vollständig browserbasierter Teleprompter für Theatertexte.

## Verwendung

1. GitHub-Pages-Seite öffnen.
2. Eine `.docx`- oder textbasierte `.pdf`-Datei auswählen.
3. Der Text wird ausschließlich lokal im Browser verarbeitet.

Es werden keine Stücktexte oder Beispieldateien im Repository gespeichert.

## Import

- **PDF:** übernimmt die tatsächlichen PDF-Seiten.
- **DOCX:** liest Absätze, Akte, Szenen, Sprecher und Regieanweisungen. Enthält die Datei keine verlässlichen festen Seitenumbrüche, werden stabile logische Teleprompter-Seiten erzeugt.
- Die formatierte Fassung von **„Die Räuber“** wird anhand ihrer Struktur erkannt und in 64 logische Seiten gegliedert.
- Eingescannte PDFs ohne Textschicht benötigen vorher OCR.

## Steuerung

- Leertaste: Start/Pause
- Pfeil links/rechts: Seite wechseln
- F: Vollbild
- Regler: Tempo, Schriftgröße und Zeilenhöhe

## Datenschutz

Die ausgewählte Datei verlässt das Gerät nicht. Es gibt keinen Upload und kein Backend.
