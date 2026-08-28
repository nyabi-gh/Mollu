export const STYLES = `
.mollu-translation__anchor {
    display: block;
    height: 0;
    margin: 0;
    padding: 0;
    pointer-events: none;
    overflow-anchor: none;
}
.mollu-translation {
    /* A translation appears after the message is laid out. Excluding it from
       scroll anchoring lets the browser hold on to real message content
       instead, so arriving translations do not shove the viewport around. */
    overflow-anchor: none;
    contain: layout style;
    margin-top: 2px;
    color: var(--text-muted, #949ba4);
    font-size: 0.95rem;
    line-height: 1.375;
    white-space: pre-wrap;
    word-break: break-word;
}
.mollu-translation__badge {
    display: inline-block;
    margin-right: 6px;
    padding: 0 5px;
    border-radius: 4px;
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    vertical-align: 1px;
    color: var(--text-muted, #949ba4);
    background: var(--background-modifier-accent, rgba(148, 155, 164, 0.16));
}
.mollu-translation__emoji {
    width: 1.375em;
    height: 1.375em;
    margin: 0 1px;
    object-fit: contain;
    vertical-align: -0.3em;
}
.mollu-translation__mention {
    padding: 0 2px;
    border-radius: 3px;
    color: var(--mention-foreground, #c9cdfb);
    background: var(--mention-background, rgba(88, 101, 242, 0.24));
}
.mollu-translation__code {
    padding: 0 3px;
    border-radius: 3px;
    font-family: var(--font-code, monospace);
    font-size: 0.85em;
    white-space: pre-wrap;
    background: var(--background-secondary, rgba(0, 0, 0, 0.2));
}
.mollu-translation__trigger {
    display: inline-block;
    margin-top: 2px;
    padding: 0;
    border: none;
    background: none;
    font-size: 0.8rem;
    font-family: inherit;
    line-height: 1.2;
    color: var(--text-muted, #949ba4);
    opacity: 0.75;
    cursor: pointer;
}
.mollu-translation__trigger:hover {
    opacity: 1;
    text-decoration: underline;
}
.mollu-translation--pending {
    opacity: 0.6;
    font-style: italic;
}
.mollu-translation--error {
    color: var(--text-danger, #f23f43);
}
`;
