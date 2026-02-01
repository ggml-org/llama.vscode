# Plan d'implémentation — Fonctionnalités Prompte-IDE

Ce document liste les 11 fonctionnalités demandées, leur cartographie sur le code existant, et un plan d'implémentation par phases. Suivi des actions et priorités ici.

## Fonctionnalités (résumé)
1. Command Palette
2. Complétion de code (multi-lignes, acceptation par Tab)
3. Agent (IA multi-fichiers)
4. Mode Agent (instructions NL → modifications)
5. Édition en ligne (Edit with AI / diff view)
6. Chat (onglets, historique)
7. Règles (system instructions / agents_list)
8. Recherche sémantique (BM25 + embeddings)
9. MCP (Model Context Protocol / intégrations outils)
10. Gestion du contexte (fichiers, historique)
11. Modèles (sélection, démarrage, status)

## Cartographie (fichiers clés)
- Commandes / menu: `package.json`, `src/architect.ts`, `src/menu.ts`
- Complétion: `src/completion.ts`, UI: `ui/src/components/AddEnvView.tsx`
- Agent / outils: `src/llama-agent.ts`, `src/tools.ts`, `src/llama-webview-provider.ts`, UI: `ui/src/components/AgentView.tsx`
- Édition en ligne: `src/text-editor.ts`, prompts: `src/prompts.ts`
- Chat / webview: `src/llama-webview-provider.ts`, `src/chat-context.ts`, UI: `ui/src/components/AgentView.tsx` et `ui/src/components/AIRunnerView.tsx`
- RAG / recherche sémantique: `src/chat-context.ts`, `src/utils.ts`, `src/tools.ts` (`search_source`)
- Prompts / templates: `src/prompts.ts`

## Contraintes & remarques
- Le repo contient déjà une large partie des fonctionnalités (RAG, webview, agent, outils). Beaucoup d'intégrations sont présentes mais peuvent nécessiter complétions et polish (UI messages, confirmations, tests).
- Implémentation complète = multi-phase. Je propose une approche incrémentale pour éviter gros changements simultanés.

## Plan d'implémentation (phases)
Phase 0 — Préparation (déjà faite)
- Créer ce document et cartographier le code.

Phase 1 — Infrastructure & commandes (priorité haute)
- Objectif: Consolider les commandes et la `Command Palette`, s'assurer que toutes les commandes listées dans `package.json` sont enregistrées dans `src/architect.ts` et testables.
- Résultat attendu: Toutes les commandes fonctionnent depuis la palette et raccourcis.

Phase 2 — Complétion & Édition en ligne
- Objectif: Améliorer `src/completion.ts` pour complétions multi-lignes, acceptation par `Tab`, et intégrer `text-editor` pour `Edit with AI` workflow (diff, accept/reject, historique d'édition).
- Résultat attendu: Complétion fiable + workflow d'édition utilisateur complet.

Phase 3 — Agent & Webview (chat) UX
- Objectif: Renforcer la boucle agent (`src/llama-agent.ts`), outils (`src/tools.ts`) et webview (`src/llama-webview-provider.ts` + `ui`), ajouter onglets/historique et commandes / actions depuis webview.
- Résultat attendu: Agent capable d'exécuter outils, afficher logs, ouvrir / ajouter fichiers de contexte, multi-onglets chat.

Phase 4 — RAG & Recherche Sémantique
- Objectif: Finaliser indexation et recherche (BM25 + embeddings), assurer intégration avec complétion et recherche source.
- Résultat attendu: `search_source` retourne contexte pertinent; complétion utilise RAG correctement.

Phase 5 — MCP / Tools & Modèles
- Objectif: Vérifier intégration MCP si nécessaire, améliorer sélection et démarrage de modèles (envs), exposer API si besoin.
- Résultat attendu: Outils externes utilisables, sélection/démarrage de modèles fluide.

Phase 6 — Tests, build, documentation
- Objectif: Lancer `npm test` (si présent), corriger erreurs, builder UI (`npm run watch` déjà actif) et documenter usage.
- Résultat attendu: Build propre et README d'usage mis à jour.

## Estimation et déroulé proposé
- Phase 1: 1–2 heures
- Phase 2: 4–8 heures
- Phase 3: 4–8 heures
- Phase 4: 3–6 heures (dépend des endpoints d'embeddings disponibles)
- Phase 5: 2–4 heures
- Phase 6: 1–2 heures
(Estimation approximative — dépend de tests réels et corrections)

## Prochaine action
Choisissez l'une des options:
- `Démarrer tout`: je commence à implémenter les phases séquentiellement (je ferai commits incrémentaux). 
- `Priorité`: indiquez quelle fonctionnalité prioriser (ex: `Édition en ligne`, `Recherche sémantique`, `Agent`).

Fichier créé: [FEATURES-IMPLEMENTATION-PLAN.md](FEATURES-IMPLEMENTATION-PLAN.md)

---

Si vous validez, je commence la Phase 1 (consolider commandes) et j'implémente immédiatement les correctifs mineurs nécessaires.