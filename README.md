# Ausführen der Website

Im Terminal folgende Befehle ausführen:

cd website
npm install
npm run dev

# Ausführen des Socket.IO Servers

Im Terminal folgende Befehle ausführen:

cd backend
npm install
npm run dev

# Aufbau

Videoraum ist in website/pages/conference/[id].tsx
Seite, um Konferenz zu erstellen, ist in website/pages/create-conference.tsx
Seite mit Details zur Konferenz website/pages/conference-details/[id].tsx

# Aufnehmen von Streams

Beschrieben in:
https://janus.conf.meetecho.com/docs/janus-pp-rec_8c.html

Auf dem Server liegt ein Script, welches nach dem Kompilieren des Janus Servers verfügbar ist
Dieses liegt in /opt/janus/bin und heißt janus-pp-rec

In pages/create-conference.tsx kann man oben in der Variable REC_DIR den Ort definieren, an dem auf dem Server die Aufnahmedateien gespeichert werden
Mit dem Tool janus-pp-rec kann man diese Dateien wie folgt in Videos, Audios und Daten umwandeln:

./janus-pp-rec /path/to/source.mjr /path/to/destination.[opus|ogg|mka|wav|webm|mkv|h264|srt]