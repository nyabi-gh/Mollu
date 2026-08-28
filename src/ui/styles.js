export const STYLES = `
.kat-translation__anchor {
    display: block;
    height: 0;
    margin: 0;
    padding: 0;
    pointer-events: none;
}
.kat-translation {
    margin-top: 2px;
    color: var(--text-muted, #949ba4);
    font-size: 0.95rem;
    line-height: 1.375;
    white-space: pre-wrap;
    word-break: break-word;
}
.kat-translation__badge {
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
.kat-translation--pending {
    opacity: 0.6;
    font-style: italic;
}
.kat-translation--error {
    color: var(--text-danger, #f23f43);
}
`;
