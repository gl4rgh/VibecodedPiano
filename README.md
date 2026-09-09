# VibecodedPiano — v0.1

**Le problème que ça résout** : quand on joue du piano avec une partition PDF sous les yeux, il
faut s'arrêter pour tourner la page (ou scroller) — ce qui casse le jeu. VibecodedPiano écoute
les notes jouées sur un clavier MIDI branché en USB et fait défiler la partition **tout seul**,
au bon endroit, en fonction de ce qui est réellement joué (pas d'un minuteur : on peut ralentir,
s'arrêter, se reprendre, l'app suit).

C'est une PWA (page web installable) qui tourne entièrement dans le navigateur, sans serveur ni
compte : tout reste sur l'appareil.

## Comment ça marche, en trois étapes

1. **Bibliothèque** — on importe un PDF (la partition) et un fichier MIDI qui correspond au
   même morceau (souvent trouvable en ligne, ou exporté depuis un logiciel de notation).
2. **Éditeur** — on place quelques repères (« ancres ») qui disent à l'app : « à ce moment du
   MIDI, on est à cet endroit précis de la page PDF ». Quelques ancres par page suffisent — pas
   besoin d'en poser à chaque note.
3. **Mode jeu** — plein écran, on joue sur son clavier : l'app suit les notes et fait défiler la
   partition d'ancre en ancre, sans qu'on touche l'écran.

## Essayer sans sa propre partition

Le dépôt inclut un exemple minimal : `examples/gamme-de-do.pdf` + `.mid` (une gamme de Do — do
ré mi fa sol la si do — main droite, puis main gauche, puis les deux ensemble). Il suffit
d'importer ces deux fichiers dans la Bibliothèque pour découvrir l'interface sans avoir besoin
de chercher un vrai morceau ni son MIDI. Voir `examples/README.md`.

Ses partitions personnelles ne sont, elles, **jamais** commitées dans ce dépôt public (voir
`.gitignore`) : importées depuis le navigateur, elles restent en local (IndexedDB), propres à
chaque appareil.

## Tester l'application

L'app est déployée automatiquement sur GitHub Pages à chaque push sur `main` :

**https://gl4rgh.github.io/VibecodedPiano/**

Ouvrir cette URL dans Chrome (ordinateur, tablette ou téléphone) suffit — pas d'installation.
Web MIDI exige un contexte sécurisé (`https://` ou `localhost`), ce que Pages fournit
nativement ; c'est donc la façon la plus simple de tester avec un vrai clavier/synthé branché
en USB.

À la première connexion d'un clavier, le navigateur demande l'autorisation d'accès MIDI —
l'accepter. Le bouton « Connecter le clavier » (dans l'éditeur ou le mode jeu) déclenche cette
demande — un geste utilisateur est requis par l'API Web MIDI, elle ne peut pas se connecter
seule au chargement.

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
