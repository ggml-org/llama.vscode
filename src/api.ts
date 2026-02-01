import * as vscode from 'vscode';

export interface LlamaExtensionAPI {
    /**
     * Envoie une requête de chat à l'agent Llama et retourne sa réponse.
     * @param query La requête à envoyer à l'agent.
     * @returns Une promesse qui résout avec la réponse de l'agent (string) ou undefined en cas d'erreur.
     */
    sendAgentQuery(query: string): Promise<string | undefined>;

    /**
     * Demande à l'agent d'éditer une section de code spécifique avec des instructions données.
     * L'agent affichera une vue de différences pour l'utilisateur et attendra sa confirmation.
     * @param document Le document VS Code où l'édition doit être appliquée.
     * @param selection La sélection de texte à éditer. Si vide, l'édition peut s'appliquer au document entier.
     * @param instructions Les instructions pour l'édition.
     * @returns Une promesse qui résout lorsque la suggestion a été traitée (acceptée/rejetée/aucune).
     */
    editCode(document: vscode.TextDocument, selection: vscode.Selection, instructions: string): Promise<void>;

    /**
     * Récupère les chunks de contexte RAG les plus pertinents pour une requête donnée.
     * @param query La requête pour laquelle récupérer le contexte RAG.
     * @returns Une promesse qui résout avec un tableau de chaînes de caractères représentant les chunks de contexte.
     */
    getRagContext(query: string): Promise<string[]>;

    /**
     * Liste les noms de tous les outils disponibles que l'agent peut utiliser.
     * @returns Un tableau de chaînes de caractères représentant les noms des outils.
     */
    listAgentTools(): string[];
}
