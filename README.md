# VibecodedPiano — v1.1

**Le problème que ça résout** : quand on joue du piano avec une partition PDF sous les yeux, il
faut s'arrêter pour tourner la page (ou scroller) — ce qui casse le jeu. VibecodedPiano écoute
les notes jouées sur un clavier MIDI branché en USB et fait défiler la partition **tout seul**,
au bon endroit, en fonction de ce qui est réellement joué. Le suivi ne se base que sur la
hauteur des notes, jamais sur un minuteur : on peut ralentir, s'arrêter en plein morceau,
rejouer un passage, se tromper — l'app suit sans dérailler.

C'est une PWA (page web installable) qui tourne entièrement dans le navigateur, sans serveur ni
compte : tout reste sur l'appareil, y compris hors connexion.

## Fonctionnement

1. **Bibliothèque** — on importe un PDF (la partition) et un fichier MIDI qui correspond au
   même morceau (souvent trouvable en ligne, ou exporté depuis un logiciel de notation).
2. **Éditeur** — on place quelques repères (« ancres ») qui disent à l'app : « à ce moment du
   MIDI, on est à cet endroit précis de la page PDF ». Quelques ancres par page suffisent — pas
   besoin d'en poser à chaque note. Trois façons de poser une ancre :
   - sélectionner un événement dans la timeline MIDI puis cliquer sur le PDF ;
   - mode capture : jouer les premières notes du passage sur le clavier, puis cliquer sur le PDF ;
   - une ancre au début de chaque page, en un clic (position à ajuster ensuite).

   On peut aussi pré-écouter le MIDI de référence (synthèse simple) pour se repérer à l'oreille,
   exporter/importer les ancres en JSON, et régler le comportement du suivi pour ce morceau en
   particulier (voir Réglages ci-dessous).
3. **Mode jeu** — plein écran, PDF seul avec un HUD discret : position dans le morceau,
   prochaine touche (ou accord) attendue, ancre active, compteur d'erreurs, dernière note
   reçue. Contrôles : Reset, ancre précédente/suivante, Pause du suivi, Recentrer (après un
   scroll manuel), et un mode Diagnostic qui détaille en temps réel comment chaque note a été
   interprétée (jouée juste, note sautée, reprise, rejetée) — utile pour affiner les réglages.

## Fonctionnalités

- **Suivi par hauteur uniquement** : tolère les fausses notes (le curseur ne bouge pas), les
  notes omises ou un saut en avant, les reprises en arrière, les accords incomplets ou joués en
  arpège.
- **Réglages** globaux (bibliothèque) et surchargeables par morceau (éditeur) : fenêtre de
  recherche avant/arrière du suivi, pré-roll des ancres, fenêtre de regroupement en accords,
  tolérance à l'octave, accords stricts ou non, délai avant réarmement de l'auto-scroll, zoom
  par défaut du PDF.
- **Notation des notes** au choix : anglaise (C D E…) ou solfège (Do Ré Mi…).
- **PWA installable**, fonctionne entièrement hors-ligne une fois ouverte au moins une fois en
  ligne (le PDF, le suivi MIDI et le stockage des morceaux ne dépendent jamais du réseau).
  Bandeau de mise à jour quand une nouvelle version est disponible.
- **Aucune donnée envoyée nulle part** : les partitions et fichiers MIDI importés restent dans
  le navigateur (IndexedDB), propres à chaque appareil — rien n'est jamais commité dans ce
  dépôt public.

## Lancer l'application

**https://gl4rgh.github.io/VibecodedPiano/** — à ouvrir dans Chrome (ordinateur, tablette ou
téléphone), aucune installation requise. Depuis le menu du navigateur, « Installer
l'application » l'ajoute à l'écran d'accueil comme une vraie app, avec fonctionnement
hors-ligne.

Web MIDI (l'API qui permet de lire le clavier branché en USB) exige un contexte sécurisé
(`https://` ou `localhost`) : c'est ce que fournit l'URL ci-dessus. À la première connexion
d'un clavier, le navigateur demande l'autorisation d'accès MIDI — l'accepter. Le bouton
« Connecter le clavier » (dans l'éditeur ou le mode jeu) déclenche cette demande — un geste
utilisateur est requis par l'API, elle ne peut pas se connecter seule au chargement.

### En développement local

```bash
npm install
npm run dev       # serveur de dev Vite (http://localhost, Web MIDI y fonctionne)
npm run build     # build de production → dist/
npm test          # tests Vitest (logique pure : matcher, parsing MIDI, ancrages, réglages)
```

## Essayer sans sa propre partition

Le dépôt inclut un exemple minimal : `examples/gamme-de-do.pdf` + `.mid` (une gamme de Do — do
ré mi fa sol la si do — main droite, puis main gauche, puis les deux ensemble). Il suffit
d'importer ces deux fichiers dans la Bibliothèque pour découvrir l'interface sans avoir besoin
de chercher un vrai morceau ni son MIDI. Voir `examples/README.md`.
