# VibecodedPiano

Suiveur de partition PWA : affiche un PDF de partition et le fait défiler automatiquement
en suivant les notes jouées sur un clavier MIDI (Web MIDI API), via un fichier MIDI de
référence et une table d'ancrages posée à la main.

Voir `plan.md` pour l'architecture complète, le modèle de données, les contrats d'interface
entre modules, l'algorithme de synchronisation et le découpage en phases d'implémentation
(P0 → P8). Ce fichier n'est **pas** versionné (voir `.gitignore`) : il n'est pas exposé
publiquement et n'est donc pas présent après un `git clone` — le recopier manuellement sur
chaque appareil avant de démarrer une session.

## Travailler depuis plusieurs appareils

Ce repo est la seule source de vérité pour le code — aucun état local persistant en dehors de
git, à l'exception de `plan.md` (non versionné, voir ci-dessus) qu'il faut recopier soi-même
sur chaque appareil. Le workflow du code est du git classique :

```bash
git clone https://github.com/gl4rgh/VibecodedPiano.git
cd VibecodedPiano
git pull          # avant de commencer une session
# ... travail ...
git push          # à la fin d'une phase / d'une session
```

Règle suivie dans ce projet : **une phase du plan = un commit**. Toujours `git pull` avant de
démarrer une phase, pour repartir de l'état laissé par la session précédente (peu importe
l'appareil sur lequel elle a tourné).

Les partitions PDF et fichiers MIDI de travail ne sont **jamais** commités (voir `.gitignore` et
la §1 de `plan.md`) — ils sont importés depuis le navigateur et stockés en IndexedDB, propre à
chaque appareil. Un morceau ajouté sur un appareil doit être réimporté sur les autres.

## Statut

Phase actuelle : **P0 — Setup** (voir `plan.md` §7). Le code n'a pas encore démarré.

## Développement

```bash
npm install
npm run dev       # serveur de dev Vite
npm run build     # build de production → dist/
npm test          # tests Vitest (logique pure : matcher, parsing MIDI, ancrages)
```

> Web MIDI exige un contexte sécurisé (`https://` ou `localhost`). Pour tester depuis une
> tablette, utiliser le build déployé sur GitHub Pages plutôt que le serveur de dev local.
