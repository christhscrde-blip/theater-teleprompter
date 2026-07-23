# Theater-Teleprompter V2

Ein vollständig browserbasierter Teleprompter für Theatertexte – optimiert für iPad, Bühne, Probe und Beamer.

## Verwendung

1. GitHub-Pages-Seite öffnen.
2. Eine `.docx`- oder textbasierte `.pdf`-Datei auswählen oder in den Startbereich ziehen.
3. Der Text wird ausschließlich lokal im Browser verarbeitet.

Es werden keine Stücktexte oder Beispieldateien im Repository gespeichert.

## Neu in Version 2

- Lesefokus hebt die aktuelle Passage hervor und blendet die Umgebung dezent ab.
- Konsistente Rollenfarben, Rollenfilter und automatische Stichwortmarkierung für „Meine Rolle“.
- Vier Presets für Probe, Bühne, Beamer und große Entfernung.
- Einklappbare Navigation sowie eine Fortschrittsleiste mit direkt anwählbaren Szenenmarken.
- Vollbildsteuerung für Start/Pause, Tempo, Schrift und Position; sie blendet sich automatisch aus.
- Vollbildtext nutzt die gesamte Bildschirmbreite, einschließlich iPad-Safe-Areas.
- Leseposition, Rolle, Darstellung und letzte Einstellungen werden lokal gespeichert.
- Optionaler Screen Wake Lock verhindert das Einschlafen des Displays, sofern der Browser ihn unterstützt.
- Reduzierte Animationen werden über `prefers-reduced-motion` respektiert.

## Import

- **PDF:** übernimmt die tatsächlichen PDF-Seiten.
- **DOCX:** liest Absätze, Akte, Szenen, Sprecher und Regieanweisungen. Enthält die Datei keine verlässlichen festen Seitenumbrüche, werden stabile logische Teleprompter-Seiten erzeugt.
- Kursiv- und Fettschrift sowie passende Word-Absatz- und Zeichenstile fließen in die Klassifizierung ein.
- Wiederkehrende Figurennamen werden auch in normaler Groß-/Kleinschreibung erkannt. Stehen Figurenname, Regiehinweis und Replik in einem Absatz, werden sie im Teleprompter getrennt formatiert.
- Regiehinweise in Klammern erscheinen kursiv, auch wenn sie innerhalb einer Replik stehen.
- Einzelne Zeilenangaben wie `5`, `10`, `15` oder `Zeile 20` werden beim Import automatisch ausgeblendet. Die Erkennung greift nur bei alleinstehenden Vielfachen von fünf, damit nummerierter Inhalt und Szenenüberschriften erhalten bleiben.
- Die formatierte Fassung von **„Die Räuber“** wird anhand ihrer Struktur erkannt und in 64 logische Seiten gegliedert.
- Eingescannte PDFs ohne Textschicht benötigen vorher OCR.

## Steuerung

- Leertaste: Start/Pause
- Pfeil links/rechts: Seite wechseln
- F: Vollbild
- Regler: Position, Tempo, Schriftgröße und Zeilenhöhe
- Vollbild: Tippen oder Zeiger bewegen, um die schwebende Steuerung einzublenden

## Tests

```sh
node --test tests/*.test.mjs
node --check app.js
```

## Datenschutz

Die ausgewählte Datei verlässt das Gerät nicht. Es gibt keinen Upload und kein Backend.
