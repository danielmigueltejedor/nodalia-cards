export const EDITOR_TOGGLE_STYLES = `
:is(.editor-toggle, .editor-checkbox) {
align-items: center;
column-gap: 10px;
cursor: pointer;
grid-auto-flow: row;
grid-template-columns: auto minmax(0, 1fr);
justify-content: stretch;
min-height: 40px;
padding-top: 0;
position: relative;
}

:is(.editor-toggle, .editor-checkbox) input {
block-size: 1px;
inline-size: 1px;
margin: 0;
opacity: 0;
pointer-events: none;
position: absolute;
}

.editor-toggle__switch {
background: color-mix(in srgb, var(--primary-text-color) 8%, transparent);
border: 1px solid color-mix(in srgb, var(--primary-text-color) 12%, transparent);
border-radius: 999px;
box-shadow: inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 6%, transparent);
display: inline-flex;
font-size: 0;
height: 22px;
line-height: 0;
position: relative;
transition: background 160ms ease, border-color 160ms ease, box-shadow 160ms ease;
width: 40px;
}

.editor-toggle__switch::before {
background: rgba(255, 255, 255, 0.92);
border-radius: 999px;
box-shadow: 0 2px 8px rgba(0, 0, 0, 0.24);
content: "";
height: 18px;
left: 1px;
position: absolute;
top: 1px;
transition: transform 160ms ease;
width: 18px;
}

.editor-toggle__label {
min-width: 0;
}

:is(.editor-toggle, .editor-checkbox) input:checked + .editor-toggle__switch {
background: var(--primary-color);
border-color: var(--primary-color);
}

:is(.editor-toggle, .editor-checkbox) input:checked + .editor-toggle__switch::before {
transform: translateX(18px);
}

:is(.editor-toggle, .editor-checkbox) input:focus-visible + .editor-toggle__switch {
box-shadow:
0 0 0 3px color-mix(in srgb, var(--primary-text-color) 14%, transparent),
inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 8%, transparent);
}
`;

export const EDITOR_RADIUS_STYLES = `
.editor-chip-radius__options {
display: flex;
flex-wrap: wrap;
gap: 8px;
}

.editor-chip-radius__option {
align-items: center;
border: 1px solid color-mix(in srgb, var(--primary-text-color) 12%, transparent);
border-radius: 12px;
cursor: pointer;
display: inline-flex;
gap: 8px;
padding: 8px 12px;
}

.editor-chip-radius__option:has(input:checked) {
background: color-mix(in srgb, var(--primary-color) 10%, transparent);
border-color: var(--primary-color);
}

.editor-chip-radius__option input[type="radio"] {
accent-color: var(--primary-color);
appearance: auto;
margin: 0;
min-height: auto;
padding: 0;
width: auto;
}
`;

export const EDITOR_COLOR_STYLES = `
.editor-color-field {
align-items: center;
display: flex;
flex-wrap: wrap;
gap: 10px;
min-height: 40px;
}

.editor-color-picker {
align-items: center;
background: color-mix(in srgb, var(--primary-text-color) 4%, transparent);
border: 1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
border-radius: 999px;
cursor: pointer;
display: inline-flex;
flex: 0 0 auto;
height: 40px;
justify-content: center;
position: relative;
width: 40px;
}

.editor-color-picker input {
cursor: pointer;
inset: 0;
opacity: 0;
position: absolute;
}

.editor-color-picker:hover,
.editor-color-picker:focus-within {
border-color: color-mix(in srgb, var(--primary-text-color) 22%, transparent);
box-shadow: inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 8%, transparent);
}

.editor-color-swatch {
--editor-swatch: #71c0ff;
background:
linear-gradient(var(--editor-swatch), var(--editor-swatch)),
conic-gradient(from 90deg, color-mix(in srgb, var(--primary-text-color) 6%, transparent) 25%, rgba(0, 0, 0, 0.12) 0 50%, color-mix(in srgb, var(--primary-text-color) 6%, transparent) 0 75%, rgba(0, 0, 0, 0.12) 0);
background-position: center;
background-size: cover, 10px 10px;
border: 1px solid color-mix(in srgb, var(--primary-text-color) 14%, transparent);
border-radius: 999px;
display: block;
height: 22px;
width: 22px;
}
`;

export const EDITOR_SECTION_ACTION_STYLES = `
.editor-section__actions {
align-items: center;
display: flex;
flex-wrap: wrap;
gap: 8px;
margin-top: 2px;
}

.editor-section__toggle-button {
align-items: center;
appearance: none;
background: color-mix(in srgb, var(--primary-text-color) 4%, transparent);
border: 1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
border-radius: 999px;
color: var(--primary-text-color);
cursor: pointer;
display: inline-flex;
font: inherit;
font-size: 12px;
font-weight: 600;
gap: 8px;
min-height: 34px;
padding: 0 12px;
}

.editor-section__toggle-button ha-icon {
--mdc-icon-size: 16px;
}
`;
