# Llama VSCode Extension API

Cette documentation décrit l'API publique de l'extension `llama-vscode`, permettant à d'autres extensions VS Code ou à des scripts externes d'interagir avec les fonctionnalités avancées de l'agent IA de code.

## Installation et Utilisation

Pour utiliser cette API, vous devez d'abord obtenir l'extension `llama-vscode` et ensuite accéder à son API via `vscode.extensions.getExtension`.

### Obtenir l'API

Pour obtenir l'instance de l'API, utilisez le code TypeScript/JavaScript suivant dans votre propre extension ou script VS Code :

```typescript
import * as vscode from 'vscode';
import { LlamaExtensionAPI } from 'llama-vscode/dist/api'; // Assurez-vous d'avoir le fichier api.d.ts généré

async function activate(context: vscode.ExtensionContext) {
    const llamaExtension = vscode.extensions.getExtension<LlamaExtensionAPI>('ggml-org.llama-vscode');

    if (llamaExtension) {
        const api = await llamaExtension.activate();
        if (api) {
            console.log('Llama VSCode API est disponible.');
            // Vous pouvez maintenant utiliser l'API
            // par exemple, api.sendAgentQuery("Hello AI agent!");
        } else {
            console.warn('Llama VSCode API n'a pas pu être activée.');
        }
    } else {
        console.warn('Llama VSCode Extension n'est pas installée ou activée.');
    }
}

// Assurez-vous d'exporter votre fonction activate si vous êtes dans une extension
// export { activate };
```

## Interface `LlamaExtensionAPI`

L'interface `LlamaExtensionAPI` définit les méthodes que vous pouvez appeler :

```typescript
export interface LlamaExtensionAPI {
    sendAgentQuery(query: string): Promise<string | undefined>;
    editCode(document: vscode.TextDocument, selection: vscode.Selection, instructions: string): Promise<void>;
    getRagContext(query: string): Promise<string[]>;
    listAgentTools(): string[];
}
```

### Méthodes de l'API

#### `sendAgentQuery(query: string): Promise<string | undefined>`

*   **Description :** Envoie une requête de chat générique à l'agent Llama. L'agent traitera la requête comme une entrée utilisateur et pourra exécuter des outils si nécessaire. La réponse de l'agent sera retournée.
*   **Paramètres :**
    *   `query: string` : La requête textuelle à envoyer à l'agent.
*   **Retourne :** `Promise<string | undefined>` - Une promesse qui résout avec la réponse textuelle de l'agent. Retourne `undefined` si l'agent n'a pas pu répondre ou si une erreur est survenue.
*   **Exemple :**
    ```typescript
    // ... (code pour obtenir l'API)
    const response = await api.sendAgentQuery("Quelle est la date d'aujourd'hui ?");
    if (response) {
        vscode.window.showInformationMessage(`Agent Llama a répondu : ${response}`);
    }
    ```

#### `editCode(document: vscode.TextDocument, selection: vscode.Selection, instructions: string): Promise<void>`

*   **Description :** Demande à l'agent IA de modifier une section de code spécifique dans un document. L'agent utilisera les `instructions` fournies pour générer une suggestion d'édition, qui sera ensuite présentée à l'utilisateur dans une vue de différences. L'utilisateur devra manuellement accepter ou rejeter l'édition.
*   **Paramètres :**
    *   `document: vscode.TextDocument` : Le document VS Code dans lequel l'édition doit être proposée.
    *   `selection: vscode.Selection` : La plage de texte (`vscode.Selection`) à éditer. Si la sélection est vide, l'agent peut interpréter cela comme une demande d'édition du document entier ou d'insertion de code à la position du curseur.
    *   `instructions: string` : Les instructions textuelles décrivant la modification souhaitée (par exemple, "Refactorer cette fonction en deux fonctions plus petites", "Ajouter des commentaires JSDoc").
*   **Retourne :** `Promise<void>` - Résout lorsque la suggestion d'édition a été affichée à l'utilisateur. L'interaction de l'utilisateur avec la vue de différences n'est pas bloquante pour cette promesse.
*   **Exemple :**
    ```typescript
    // ... (code pour obtenir l'API)
    const editor = vscode.window.activeTextEditor;
    if (editor) {
        const document = editor.document;
        const selection = editor.selection; // Obtenez la sélection actuelle de l'éditeur
        const instructions = "Corriger les erreurs de syntaxe et optimiser les boucles.";
        await api.editCode(document, selection, instructions);
    }
    ```

#### `getRagContext(query: string): Promise<string[]>`

*   **Description :** Récupère les chunks de contexte RAG (Retrieval Augmented Generation) les plus pertinents à partir de l'index du projet, basés sur la `query` fournie. Ceci est utile pour des outils qui ont besoin d'informations sémantiques sur le codebase.
*   **Paramètres :**
    *   `query: string` : La requête (par exemple, une description de tâche, un fragment de code) pour laquelle récupérer le contexte pertinent.
*   **Retourne :** `Promise<string[]>` - Une promesse qui résout avec un tableau de chaînes de caractères, où chaque chaîne est un chunk de contexte pertinent.
*   **Exemple :**
    ```typescript
    // ... (code pour obtenir l'API)
    const searchInput = "Comment la fonction de connexion gère-t-elle l'authentification des utilisateurs ?";
    const contextChunks = await api.getRagContext(searchInput);
    if (contextChunks.length > 0) {
        vscode.window.showInformationMessage(`Contexte RAG trouvé :\n\n${contextChunks.join('\n\n')}`);
    } else {
        vscode.window.showInformationMessage("Aucun contexte RAG pertinent trouvé.");
    }
    ```

#### `listAgentTools(): string[]`

*   **Description :** Retourne une liste de tous les noms d'outils que l'agent Llama est configuré pour utiliser. Cela permet aux développeurs tiers de savoir quelles actions l'agent est capable d'entreprendre.
*   **Paramètres :** Aucun.
*   **Retourne :** `string[]` - Un tableau de chaînes de caractères, où chaque chaîne est le nom d'un outil disponible (par exemple, `"run_terminal_command"`, `"read_file"`, `"edit_file"`).
*   **Exemple :**
    ```typescript
    // ... (code pour obtenir l'API)
    const availableTools = api.listAgentTools();
    vscode.window.showInformationMessage(`Outils disponibles pour l'agent : ${availableTools.join(', ')}`);
    ```

## Considérations

*   **Activation de l'extension :** Assurez-vous que l'extension `llama-vscode` est activée pour que son API soit disponible.
*   **Modèles LLM et serveurs :** L'API s'appuie sur la configuration de l'extension `llama-vscode` pour les endpoints des serveurs LLM (chat, embeddings, outils). Assurez-vous que ces serveurs sont en cours d'exécution ou que les modèles OpenRouter sont correctement configurés.
*   **Gestion des erreurs :** Les méthodes de l'API sont asynchrones et peuvent retourner `undefined` ou lever des erreurs. Implémentez une gestion robuste des erreurs dans votre code.
*   **Performances :** L'appel fréquent de certaines méthodes (comme `getRagContext` avec des requêtes complexes) peut impacter les performances, surtout si les serveurs LLM sont locaux ou distants. Considérez la mise en cache si nécessaire.
*   **UI/UX :** Certaines actions (comme `editCode`) déclenchent une interaction utilisateur via des vues de différences ou des messages VS Code. Tenez-en compte lors de l'intégration de l'API dans des flux automatisés.

