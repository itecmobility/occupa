# Occupa

Outil web d'ITEC Mobility pour relever l'occupation du stationnement sur un plan, heure par heure.

- Marquer les places occupées (X) avec un compteur automatique
- Ajouter du texte, des rectangles et des circuits (couleurs, tailles, pointillés, flèches)
- Gérer plusieurs plans (zones), les rogner à l'import
- Enregistrer le plan annoté en PNG, nommé `<Zone>_<HHhMM>.png`
- Mode clair et mode sombre
- Utilisable sur ordinateur, tablette et téléphone (tactile, pincer pour zoomer)
- Installable comme une application depuis le navigateur, fonctionne hors connexion

Les plans et les relevés restent dans le navigateur de l'utilisateur (IndexedDB) : rien n'est envoyé sur un serveur.

## Développement

```bash
npm install
npm run dev        # serveur local
npm run build      # build dans dist/ (un seul fichier index.html, utilisable hors ligne)
```

Placer une image `src/plan.png` (ignorée par git) pour l'avoir comme plan de démonstration dans le build local.
La version en ligne (`npm run build:public`) démarre sans plan.

## Mise en ligne

Chaque push sur `main` déploie le site sur GitHub Pages via `.github/workflows/deploy.yml`.

Stack : React, Vite, Tailwind CSS, Radix UI, Motion, Lucide, Sonner.
