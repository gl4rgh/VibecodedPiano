# VibecodedPiano — v0.1 \o/

Suiveur de partition PWA : affiche un PDF de partition et le fait défiler automatiquement
en suivant les notes jouées sur un clavier MIDI (Web MIDI API), via un fichier MIDI de
référence et une table d'ancrages posée à la main.

Projet en cours de développement, phase de test.

Les partitions PDF et fichiers MIDI de travail ne sont **jamais** commités (voir `.gitignore`)
— ils sont importés depuis le navigateur et stockés en IndexedDB, propre à chaque appareil.

## Tester l'application

L'app est déployée automatiquement sur GitHub Pages à chaque push sur `main` :

**https://gl4rgh.github.io/VibecodedPiano/**

Ouvrir cette URL dans Chrome (ordinateur, tablette ou téléphone) suffit — pas d'installation.
Web MIDI exige un contexte sécurisé (`https://` ou `localhost`), ce que Pages fournit
nativement ; c'est donc la façon la plus simple de tester avec un vrai clavier/synthé branché
en USB.

À la première connexion d'un clavier, le navigateur demande l'autorisation d'accès MIDI —
l'accepter. Utiliser le bouton « Connecter le clavier » du panneau debug (geste utilisateur
requis par l'API Web MIDI).

### En développement local

```bash
npm install
npm run dev       # serveur de dev Vite
npm run build     # build de production → dist/
npm test          # tests Vitest (logique pure : matcher, parsing MIDI, ancrages)
```

Le serveur de dev local (`npm run dev`) tourne en `http://localhost`, un contexte sécurisé lui
aussi : Web MIDI y fonctionne. Ce qui ne fonctionne pas en local, c'est de tester depuis un
*autre* appareil sur le même réseau (`--host` expose l'app en `http://<IP>`, non sécurisé) —
dans ce cas, préférer l'URL GitHub Pages ci-dessus.
