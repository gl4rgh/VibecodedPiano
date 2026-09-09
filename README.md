# VibecodedPiano

Suiveur de partition PWA : affiche un PDF de partition et le fait défiler automatiquement
en suivant les notes jouées sur un clavier MIDI (Web MIDI API), via un fichier MIDI de
référence et une table d'ancrages posée à la main.

## Travailler depuis plusieurs appareils

Ce repo est la seule source de vérité pour le code — aucun état local persistant en dehors de
git. Le workflow est du git classique :

```bash
git clone https://github.com/gl4rgh/VibecodedPiano.git
cd VibecodedPiano
git pull          # avant de commencer une session
# ... travail ...
git push          # à la fin d'une phase / d'une session
```

Les partitions PDF et fichiers MIDI de travail ne sont **jamais** commités (voir `.gitignore`)
— ils sont importés depuis le navigateur et stockés en IndexedDB, propre à chaque appareil.
Un morceau ajouté sur un appareil doit être réimporté sur les autres.

## Statut

Phases terminées : **P0 → P3** (setup, affichage PDF, listener MIDI, parsing du MIDI de
référence). L'interface actuelle est un harnais de test manuel dans la vue Bibliothèque
(import PDF, connexion clavier, import MIDI de référence + timeline) — l'UI définitive
(bibliothèque, éditeur d'ancrages, mode jeu) arrive en P4 et suivantes.

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
