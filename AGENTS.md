# AGENTS.MD

## Project

SiteLint MCP server for the SiteLint Auditor engine - WCAG and SiteLint Best Practices audits for accessibility, SEO, performance, and security via LLM agents. TypeScript, ESM (`"type": "module"`), builds to `dist/` with `tsc`. Distributed via npm (`@sitelint/auditor-mcp`); uses Puppeteer to drive Chrome/Chromium. MCP registry metadata lives in `server.json` (releases sync its version to `package.json` via `scripts/sync-server-json-version.js`). Agent plugins live in `plugins/auditor-mcp/` (Claude Code + Codex) with marketplace manifests at `.claude-plugin/marketplace.json` and `.agents/plugins/marketplace.json`; the sync script also keeps plugin versions in step with `package.json`.

## Code style notes (supplementing ESLint)

- **`no-process-env`** is an error – don't use `process.env`.
- **Prettier** is configured for formatting but the repo does not have a `format` script – run `eslint --fix` instead.
- **No lockfile** – `package-lock=false` in `.npmrc`. Exact versions (`save-exact=true`).

## Code style additional rules

1. **Meaningful names** – avoid `data`, `temp`, `foo`.
2. **Empty lines between logical sections** – add blank lines to separate logical blocks within functions (e.g., between variable declarations, conditionals, loops, and return statements). For example, put an empty line between an `if` block and a subsequent `const` declaration, or between a `const` and a `return`.
3. **Object properties** sorted alphabetically.
4. **No implicit coercion** – use strict `===` and `!==`. Avoid loose equality operators (`==`, `!=`).
5. **Negation for boolean toggling** – the `!` operator is allowed and encouraged for boolean assignment and toggling (e.g., `flag = !isEnabled`, `item.hidden = !isVisible`). For conditional checks, follow rule 12 (use `if (!value)` for false checks, not `if (value === false)`).
6. **Use `const` + arrow functions** for callbacks/standalone functions.
7. **Optional chaining** allowed, but not to change control flow silently. Prefer explicit checks when null/undefined is an error state.
8. **Callback functions** – extract the inline callbacks into named `const` functions. One-liners are fine inline. No large anonymous functions inline.
9. **Context execution** – use `globalThis` instead of `window`, `global`, or `self` unless explicitly justified.
10. **`await` must be wrapped in try-catch** – every `await` call must be inside a try-catch block. No unhandled promise rejections. If you don't need the error, at minimum log it with `console.error`.
11. **Always use fully qualified global references** – don't rely on implicit globals. Use `globalThis.fetch` not `fetch`, `globalThis.setTimeout` not `setTimeout`, etc. Exceptions: `console` and `document` may be used without `globalThis`.
12. **No negation in boolean conditions** – when checking a boolean value in a conditional (e.g., `if`, `while`, ternary), use `if (value)` for true checks and `if (value === false)` for false checks. Do not use the logical NOT operator (`!`) for false checks (e.g., `if (!value)` is forbidden). This makes the condition explicit and avoids subtle bugs.
13. **No TypeScript typings in JavaScript files** – `.js` files should not contain type annotations. Keep types only in `.ts` files.
14. **Parentheses around arrow function arguments** – always wrap arrow function arguments in parentheses, even for single parameters. Use `(x) => x * 2` not `x => x * 2`.
15. **Prefer early returns over nested if blocks** – avoid large `if` blocks by inverting conditions and returning early. Keep nesting to a minimum (max 2-3 levels deep).
16. **No async misuse at top-level** – wrap top-level async logic in an immediately invoked function expression (IIFE) or use a named function that gets called. Never leave top-level `await` unhandled.
17. **Explicit type checking** – don't check just for `undefined`. Always validate that the value matches the expected type. Watch for the `null` trap: `typeof null === 'object'`. Always explicitly exclude `null` when checking for objects. For example, use `typeof value === 'object' && value !== null` instead of just `typeof value === 'object'`.
17.1. **Complete explicit types** – include all relevant runtime states in explicit type annotations, including `null` and `undefined` when an API can return them. For example, use `RegExpMatchArray | null` for `String.match()`, not only `RegExpMatchArray`.
18. **Class member order** – maintain the following order within classes:
    - Class properties: `protected`, `private`, `public` (alphabetically within each group)
    - Constructor
    - Methods: `protected`, `private`, `public` (alphabetically within each group)
    - Angular lifecycle methods (e.g., `ngOnInit`, `ngOnDestroy`) must come after all public methods
19. **Avoid hard-coded strings** – extract string literals into named constants or enums. This ensures consistency, prevents typos, and makes refactoring easier. Use, for example, `const ACTION_SAVE = 'save'` instead of repeating `'save'` throughout the codebase.
20. **Pass function references directly** – when adding event listeners, pass the function reference directly instead of wrapping in an anonymous function. Use `addEventListener('click', handler)` not `addEventListener('click', () => handler())`. For class methods, use `this.method.bind(this)`.
21. **Avoid self-explanatory comments** – don't comment what the code does if the code itself is clear. Comments should explain "why" (business logic, edge cases, workarounds) not "what". Exception: complex algorithms, non-obvious performance optimizations, or temporary // TODO comments.
22. **Use `+= 1` for increments** – avoid the `++` operator. Use `i += 1` instead of `i++` in loops and counters. This makes increment behavior explicit and avoids confusion between post-increment and pre-increment.
23. **Explicit array emptiness check** – when checking if an array has elements, use `Array.isArray(array) && array.length > 0`. Don't rely on truthiness or optional chaining alone, as they can be ambiguous with `null`, `undefined`, or empty arrays.
24. **Multi-line object and array formatting** – when an object or array has more than one property/element, format it vertically with line breaks after the opening bracket and before the closing bracket. Each property/element on its own line. Single-property objects or single-element arrays may remain on one line.
25. **Avoid `as unknown as Type` casting** – casting through `unknown` bypasses type safety and hides type mismatches. If you must cast, prefer `as Type` with a runtime check. Use `unknown` casting only as an absolute last resort when interfacing with truly untyped data (e.g., `JSON.parse`), and always add a comment explaining why.
26. **No trailing commas** – avoid trailing commas in objects, arrays, function arguments, or any other syntax. Trailing commas can cause issues in older JavaScript environments and create inconsistent git diffs.
27. **Indentation** – use 2 spaces for indentation. No tabs.
28. **No underscore prefix for private members** – don't use underscore prefix (e.g., `_privateProperty`). TypeScript's `private` keyword already indicates visibility. Use standard naming without underscores.
29. **Use template literals for string concatenation** – avoid `+` for string concatenation. Use template literals (backticks) instead. For example, use `${pct}%` not `pct + '%'`, and use `Hello ${name}` not `'Hello ' + name`.
30. **Class property initialization in constructor** – all class properties must be initialized directly in the constructor. Do not initialize properties at declaration (e.g., `private count = 0`). The exceptions are `@Input()` properties (which are set by Angular), rule classes extending `AbstractRule` (where `selector` and `ruleConfig` are initialized at declaration), and properties using the `!` definite assignment assertion (with a comment explaining why). This ensures clear initialization flow and avoids the "not definitely assigned" error.
31. **Use `Number.parseInt` instead of `parseInt`** – always use `Number.parseInt` rather than the bare `parseInt` function. This makes the global namespace explicit and avoids ambiguity. Always include the radix parameter (e.g., `Number.parseInt(value, 10)`).
32. **Avoid long anonymous functions in `new Promise`** – when creating a new Promise, keep the executor function short (2-3 lines max). If the logic is longer, extract it to a named `const` function. This improves readability and reusability.
33. **Use `addEventListener` instead of on-event properties** – avoid assigning event handlers directly to DOM element properties like `img.onload`, `button.onclick`, or `window.onload`. Use `addEventListener` instead. This allows multiple listeners, better cleanup, and avoids accidental overrides.
34. **Use `{ once: true }` for one-time event listeners** – when an event listener is intended to run only once (e.g., `load`, `error`, `click` for a one‑time action), always pass the `{ once: true }` option. This automatically removes the listener after execution, preventing memory leaks and unintended multiple calls.
35. **Interfaces** prefixed with `I` (e.g., `IAuditorReport`). Enforced by `@typescript-eslint/naming-convention`.
36. **No implicit coercion with `!` on non‑booleans** – do not use the logical NOT operator (`!`) to coerce a non‑boolean value to a boolean (e.g., `if (!obj)`, `!!value`). Instead, use explicit type‑specific checks that validate the expected shape or type of the data. For example, use `typeof value === 'object' && value !== null` for objects, `Array.isArray(value)` for arrays, `value !== null && value !== undefined` for optional values, etc. The `!` operator is allowed only when the operand is already a boolean (e.g., toggling a flag: `flag = !flag`).

## Git & PRs

- Branch from `main`: `feature/xyz` or `fix/xyz`
- PR target: `main`
- Husky pre-push hook exists (commented-out `npm run lint && npm run test`)
