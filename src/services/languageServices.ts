import { Text } from "@codemirror/state";
import { Diagnostic, setDiagnostics } from "@codemirror/lint";
import { ViewUpdate, PluginValue, EditorView, Tooltip } from "@codemirror/view";
import { CompletionContext, CompletionResult, Completion } from "@codemirror/autocomplete";
import { 
    Hover, 
    Position, 
    MetaStore,
    TextDocument, 
    MarkupContent, 
    CompletionItem,
    DiagnosticSeverity, 
    CompletionItemKind, 
    RainLanguageServices,
    getRainLanguageServices,
    Diagnostic as lspDiagnostic 
} from "@rainprotocol/rainlang";


// const useLast = (values: readonly any[]) => values.reduce((_, v) => v, '');
// const documentUri = Facet.define<string, string>({ combine: useLast });
// const languageId = Facet.define<string, string>({ combine: useLast });

/**
 * @public A plugin that manages languages services processes.
 * Original code from [codemirror-languageserver](https://github.com/FurqanSoftware/codemirror-languageserver),
 * BSD-3-Clause License, Copyright (c) 2021, Mahmud Ridwan, All rights reserved.
 * 
 * @see [LICENSE](./LICENSE) for license details.
 */ 
export class RainLanguageServicesPlugin implements PluginValue {
    public readonly uri = "file:///untitled.rain";
    public readonly languageId = "rainlang";
    public version = 0;
    private textDocument: TextDocument;
    private langServices: RainLanguageServices;
    private metaStore: MetaStore;

    /**
     * @public constructor of the class
     * @param view - The editor view instance
     * @param metaStore - (optional) The meta store object to use
     */
    constructor(private view: EditorView, metaStore?: MetaStore) {
        this.metaStore = metaStore ? metaStore : new MetaStore();
        this.textDocument = TextDocument.create(
            this.uri,
            this.languageId,
            this.version,
            this.view.state.doc.toString()
        );
        this.langServices = getRainLanguageServices({metaStore: this.metaStore});
        this.processDiagnostics();
    }

    // update the instance of TexTdocument and RainDocument
    update(update: ViewUpdate) {
        if (!update.docChanged) return;
        else {
            TextDocument.update(
                this.textDocument,
                [{ text: this.view.state.doc.toString() }],
                ++this.version
            );
            this.processDiagnostics();
        }
    }

    destroy() {}

    /** 
     * @public 
     * Get the active meta store object of this plugin instance in order to manulay 
     * update it for example update the meta store subgraphs or add a new k/v meta
     */
    public getMetaStore(): MetaStore {
        return this.metaStore;
    }

    /**
     * @public Handles calls for hover tooltip
     */
    public async handleHoverTooltip(
        view: EditorView,
        position: Position,
    ): Promise<Tooltip | null> {
        try {
            const hover = await this.langServices.doHover(
                this.textDocument,
                position
            );
            if (!hover) return null;
            else return getHoverTooltip(
                view.state.doc, 
                hover, 
                position
            );
        }
        catch (err) {
            console.log(err);
            return null;
        }
    }

    /**
     * @public Handles calls for code completion
     */
    public async handleCompletion(
        context: CompletionContext,
        position: Position,
    ): Promise<CompletionResult | null> {
        try {
            const completions = await this.langServices.doComplete(
                this.textDocument,
                position
            );
            if (!completions) return null;
            else return getCompletion(
                context, 
                completions
            );
        }
        catch (err) {
            console.log(err);
            return null;
        }
    }


    /**
     * @public Handles calls for docuement diagnostics
     */
    public async processDiagnostics() {
        try {
            this.view.dispatch(
                setDiagnostics(
                    this.view.state, 
                    getDiagnostics(
                        this.view.state.doc, 
                        await this.langServices.doValidation(
                            this.textDocument
                        )
                    )
                )
            );
        }
        catch (err) {
            console.log(err);
            this.view.dispatch(
                setDiagnostics(this.view.state, [])
            );
        }
    }
}

/**
 * @public Converts LSP hover to codemirror hover tooltips.
 * Original code from [codemirror-languageserver](https://github.com/FurqanSoftware/codemirror-languageserver),
 * BSD-3-Clause License, Copyright (c) 2021, Mahmud Ridwan, All rights reserved.
 * 
 * @see [LICENSE](./LICENSE) for license details.
 * 
 * @param doc - Codemirror Text object
 * @param hover - The LSP hover item
 * @param position - Position of the textDocument to get the completion items for
 * @returns Codemirror tooltip or null
 */
export function getHoverTooltip(
    doc: Text,
    hover: Hover,
    position: Position,
): Tooltip | null {
    const { contents, range } = hover;
    let pos = posToOffset(doc, position)!;
    let end;
    if (range) {
        pos = posToOffset(doc, range.start)!;
        end = posToOffset(doc, range.end);
    }
    if (pos === null) return null;
    const dom = document.createElement("div");
    dom.classList.add("documentation");
    //if (this.allowHTMLContent) dom.innerHTML = formatContents(contents);
    //else 
    dom.textContent = (contents as MarkupContent).value;
    return { pos, end, create: (_view) => ({ dom }), above: true };
}

/**
 * @public Converts LSP CompletionItem to codemirror code completions.
 * Original code from [codemirror-languageserver](https://github.com/FurqanSoftware/codemirror-languageserver),
 * BSD-3-Clause License, Copyright (c) 2021, Mahmud Ridwan, All rights reserved.
 * 
 * @see [LICENSE](./LICENSE) for license details.
 * 
 * @param context - Completion context
 * @param completionItems - The LSP completion items
 * @returns Codemirror completion result or null
 */
export function getCompletion(
    context: CompletionContext,
    completionItems: CompletionItem[]
): CompletionResult | null {
    const CompletionItemKindMap = Object.fromEntries(
        Object.entries(CompletionItemKind).map(([key, value]) => [value, key])
    ) as Record<CompletionItemKind, string>;

    let { pos } = context;
    // const line = state.doc.lineAt(pos);
    // let trigKind: CompletionTriggerKind = CompletionTriggerKind.Invoked;
    // let trigChar: string | undefined;
    // if (
    //     !explicit &&
    //     plugin.client.capabilities?.completionProvider?.triggerCharacters?.includes(
    //         line.text[pos - line.from - 1]
    //     )
    // ) {
    //     trigKind = CompletionTriggerKind.TriggerCharacter;
    //     trigChar = line.text[pos - line.from - 1];
    // }
    if (
        // trigKind === CompletionTriggerKind.Invoked &&
        !context.matchBefore(/\w+$/)
    ) return null;

    let completions = completionItems.map(
        ({
            detail,
            label,
            kind,
            insertText,
            documentation,
            sortText,
            filterText,
        }) => {
            const completion: Completion & {
                filterText: string;
                sortText?: string;
                // apply: string;
            } = {
                label,
                detail,
                apply: (view, _comp) => {
                    // re adjusting the cursor position for opcodes
                    const matcher = prefixMatch([_comp]);
                    const match = context.matchBefore(matcher[1])!;
                    if (insertText) {
                        let cursorPos = match.from + insertText.length - 1;
                        if (insertText.includes("<>")) cursorPos -= 2;
                        view.dispatch({
                            changes: { 
                                from: match.from, 
                                to: match.to, 
                                insert: insertText 
                            },
                            selection: { anchor: cursorPos, head: cursorPos }
                        });
                    }
                    else view.dispatch({
                        changes: { 
                            from: match.from, 
                            to: match.to, 
                            insert: label 
                        }
                    });
                },
                type: kind && CompletionItemKindMap[kind].toLowerCase(),
                sortText: sortText ?? label,
                filterText: filterText ?? label,
            };
            if (documentation) {
                completion.info = (documentation as MarkupContent).value;
            }
            return completion;
        }
    );

    const [_span, _match] = prefixMatch(completions);
    const token = context.matchBefore(_match);

    if (token) {
        pos = token.from;
        const word = token.text.toLowerCase();
        if (/^\w+$/.test(word)) {
            completions = completions
                .filter(({ filterText }) =>
                    filterText.toLowerCase().startsWith(word)
                )
                .sort(({ label: a }, { label: b }) => {
                    switch (true) {
                    case a.startsWith(token.text) && !b.startsWith(token.text):
                        return -1;
                    case !a.startsWith(token.text) && b.startsWith(token.text):
                        return 1;
                    }
                    return 0;
                });
        }
    }
    return {
        from: pos,
        options: completions,
    };
}

/**
 * @public Converts LSP Diagnostics to codemirror diagnostics.
 * Original code from [codemirror-languageserver](https://github.com/FurqanSoftware/codemirror-languageserver),
 * BSD-3-Clause License, Copyright (c) 2021, Mahmud Ridwan, All rights reserved.
 * 
 * @see [LICENSE](./LICENSE) for license details.
 * 
 * @param doc - Codemirror Text object
 * @param diagnostics - The LSP Diagnostics
 */
export function getDiagnostics(
    doc: Text,
    diagnostics: lspDiagnostic[]
): Diagnostic[] {
    return diagnostics.map(({ range, message, severity }) => ({
        message,
        from: posToOffset(doc, range.start)!,
        to: posToOffset(doc, range.end)!,
        severity: ({
            [DiagnosticSeverity.Error]: "error",
            [DiagnosticSeverity.Warning]: "warning",
            [DiagnosticSeverity.Information]: "info",
            [DiagnosticSeverity.Hint]: "info",
        } as const)[severity!]
    })).filter(({ from, to }) => 
        from !== null && 
        to !== null && 
        from !== undefined && 
        to !== undefined
    ).sort((a, b) => {
        switch (true) {
        case a.from < b.from:
            return -1;
        case a.from > b.from:
            return 1;
        }
        return 0;
    });
}

/**
 * @public Converts a position to offset of a character in a codemirror text.
 * Original code from [codemirror-languageserver](https://github.com/FurqanSoftware/codemirror-languageserver),
 * BSD-3-Clause License, Copyright (c) 2021, Mahmud Ridwan, All rights reserved.
 * 
 * @see [LICENSE](./LICENSE) for license details.
 * 
 * @param doc - Codemirror text
 * @param pos - The position to convert
 * @returns - The offset of the provided position
 */
export function posToOffset(doc: Text, pos: { line: number; character: number }) {
    if (pos.line >= doc.lines) return;
    const offset = doc.line(pos.line + 1).from + pos.character;
    if (offset > doc.length) return;
    return offset;
}

/**
 * @public Converts offset of a character in a codemirror text to a position.
 * Original code from [codemirror-languageserver](https://github.com/FurqanSoftware/codemirror-languageserver),
 * BSD-3-Clause License, Copyright (c) 2021, Mahmud Ridwan, All rights reserved.
 * 
 * @see [LICENSE](./LICENSE) for license details.
 * 
 * @param doc - Codemirror text
 * @param offset - The offset to convert
 * @returns - The position of the provided character offset
 */
export function offsetToPos(doc: Text, offset: number) {
    const line = doc.lineAt(offset);
    return {
        line: line.number - 1,
        character: offset - line.from,
    };
}

/**
 * @public Constructs regexp out of completion items.
 * Original code from [codemirror-languageserver](https://github.com/FurqanSoftware/codemirror-languageserver),
 * BSD-3-Clause License, Copyright (c) 2021, Mahmud Ridwan, All rights reserved.
 * 
 * @see [LICENSE](./LICENSE) for license details.
 * 
 * @param completions - Codemirror completion items
 * @returns Regexp of completion items
 */
export function prefixMatch(completions: Completion[]) {
    function toSet(chars: Set<string>) {
        let preamble = "";
        let flat = Array.from(chars).join("");
        const words = /\w/.test(flat);
        if (words) {
            preamble += "\\w";
            flat = flat.replace(/\w/g, "");
        }
        return `[${preamble}${flat.replace(/[^\w\s]/g, "\\$&")}]`;
    }
    const first = new Set<string>();
    const rest = new Set<string>();

    for (const { label } of completions) {
        const [initial, ...restStr] = label as string;
        first.add(initial);
        for (const char of restStr) {
            rest.add(char);
        }
    }

    const source = toSet(first) + toSet(rest) + "*$";
    return [new RegExp("^" + source), new RegExp(source)];
}

/**
 * @public Reduces an array to its last element
 * @param values - Values to reduce
 */
export const useLast = (values: readonly any[]) => values.reduce((_, v) => v, "");
