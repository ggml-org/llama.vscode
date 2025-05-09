import vscode from "vscode";

interface BM25Stats {
    avgDocLength: number;
    docFreq: Record<string, number>;
    docLengths: number[];
    termFreq: Record<string, Record<number, number>>
    totalDocs: number;
}

export class Utils {
    static getLeadingSpaces = (input: string): string => {
        // Match the leading spaces using a regular expression
        const match = input.match(/^[ \t]*/);
        return match ? match[0] : "";
    }

    static delay = (ms: number) => {
        return new Promise<void>(resolve => setTimeout(resolve, ms));
    }

    static getPrefixLines = (document: vscode.TextDocument, position: vscode.Position, nPrefix: number): string[] => {
        const startLine = Math.max(0, position.line - nPrefix);
        return Array.from({ length: position.line - startLine }, (_, i) => document.lineAt(startLine + i).text);
    }

    static getSuffixLines = (document: vscode.TextDocument, position: vscode.Position, nSuffix: number): string[] => {
        const endLine = Math.min(document.lineCount - 1, position.line + nSuffix);
        return Array.from({ length: endLine - position.line }, (_, i) => document.lineAt(position.line + 1 + i).text);
    }

    static removeTrailingNewLines = (suggestionLines: string[]) => {
        while (suggestionLines.length > 0 && suggestionLines.at(-1)?.trim() == "") {
            suggestionLines.pop();
        }
    }

    static getChunksInPlainText = (chunksToSend: any[]) => {
        let extraCont = "Here are pieces of code from different files of the project: \n"
        + chunksToSend.reduce((accumulator, currentValue) => accumulator + "\nFile Name: "
        + currentValue.filename + "\nText:\n" + currentValue.text + "\n\n", "");
        return extraCont;
    }

    static computeBM25Stats = (docs: string[][]): BM25Stats => {
        const docFreq: Map<string, number> = new Map();
        const termFreq: Map<string, Map<number, number>> = new Map();
        const docLengths: number[] = [];
        let totalDocs = 0;

        for (let docId = 0; docId < docs.length; docId++) {
            const doc = docs[docId];
            docLengths.push(doc.length);
            const termsInDoc = new Set<string>();

            for (const term of doc) {
                // Update term frequency (per-doc)
                if (!termFreq.has(term)) {
                    termFreq.set(term, new Map());
                }
                const termDocMap = termFreq.get(term)!;
                termDocMap.set(docId, (termDocMap.get(docId) || 0) + 1);

                termsInDoc.add(term);
            }

            // Update document frequency (global)
            for (const term of termsInDoc) {
                docFreq.set(term, (docFreq.get(term) || 0) + 1);
            }

            totalDocs++;
        }

        const avgDocLength = docLengths.reduce((a, b) => a + b, 0) / totalDocs;
        return {
            avgDocLength,
            docFreq: Object.fromEntries(docFreq),  // Convert to Record if needed
            docLengths,
            termFreq: Object.fromEntries(
                Array.from(termFreq).map(([k, v]) => [k, Object.fromEntries(v)])
            ),
            totalDocs
        };
    };

    static bm25Score = (
        queryTerms: string[],
        docIndex: number,
        stats: BM25Stats,
        k1 = 1.5,
        b = 0.75
    ): number => {
        let score = 0;

        for (const term of queryTerms) {
            if (!stats.termFreq[term]) continue;

            const tf = stats.termFreq[term][docIndex] || 0;
            const idf = Math.log(
                (stats.totalDocs - stats.docFreq[term] + 0.5) / (stats.docFreq[term] + 0.5) + 1
            );

            const numerator = tf * (k1 + 1);
            const denominator = tf + k1 * (1 - b + b * stats.docLengths[docIndex] / stats.avgDocLength);

            score += idf * numerator / denominator;
        }

        return score;
    }
}
