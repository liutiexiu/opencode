- To regenerate the JavaScript SDK, run `./packages/sdk/js/script/build.ts`.
- The `opencode` binary in use is compiled from local source (current tag: `v1.4.11`), NOT installed from npm. Build command: `OPENCODE_VERSION=1.4.11 ./packages/opencode/script/build.ts --single --skip-install`. Install with `./install-ubuntu-local.sh` which copies the binary to `~/.local/bin/opencode-versions/<git-hash>/` and updates the symlink at `~/.local/bin/opencode`.
- Because the binary is built with `OPENCODE_VERSION=1.4.11`, `InstallationChannel` = `dev` and `InstallationLocal` = `false`. The runtime will install `@opencode-ai/plugin@1.4.11` into `~/.config/opencode/node_modules`. If node_modules contains a mismatched version, delete `~/.config/opencode/node_modules` and `~/.config/opencode/package-lock.json` and restart.
- ALWAYS USE PARALLEL TOOLS WHEN APPLICABLE.
- The default branch in this repo is `dev`.
- Local `main` ref may not exist; use `dev` or `origin/dev` for diffs.
- Prefer automation: execute requested actions without confirmation unless blocked by missing info or safety/irreversibility.

## Build & Install

**MANDATORY**: Before building or installing the opencode binary, ALWAYS load the `build-opencode-local` skill first:

```
skill(name="build-opencode-local")
```

Never execute build/install commands from memory. The skill defines the complete workflow: Build → Install → Validate → Cleanup/Rollback. Skipping any step is a violation.

- `Text file busy` during install means the old binary is still in use — stop the process holding it first, then run `./install-ubuntu-local.sh` normally. Do not work around it with `rm -f + cp`.
- Do not restart `opencode-daemon.service` (the Python proxy) as part of the build workflow — it is unrelated to the opencode binary.

## Style Guide

### General Principles

- Keep things in one function unless composable or reusable
- Avoid `try`/`catch` where possible
- Avoid using the `any` type
- Use Bun APIs when possible, like `Bun.file()`
- Rely on type inference when possible; avoid explicit type annotations or interfaces unless necessary for exports or clarity
- Prefer functional array methods (flatMap, filter, map) over for loops; use type guards on filter to maintain type inference downstream
- In `src/config`, follow the existing self-export pattern at the top of the file (for example `export * as ConfigAgent from "./agent"`) when adding a new config module.

Reduce total variable count by inlining when a value is only used once.

```ts
// Good
const journal = await Bun.file(path.join(dir, "journal.json")).json()

// Bad
const journalPath = path.join(dir, "journal.json")
const journal = await Bun.file(journalPath).json()
```

### Destructuring

Avoid unnecessary destructuring. Use dot notation to preserve context.

```ts
// Good
obj.a
obj.b

// Bad
const { a, b } = obj
```

### Variables

Prefer `const` over `let`. Use ternaries or early returns instead of reassignment.

```ts
// Good
const foo = condition ? 1 : 2

// Bad
let foo
if (condition) foo = 1
else foo = 2
```

### Control Flow

Avoid `else` statements. Prefer early returns.

```ts
// Good
function foo() {
  if (condition) return 1
  return 2
}

// Bad
function foo() {
  if (condition) return 1
  else return 2
}
```

### Schema Definitions (Drizzle)

Use snake_case for field names so column names don't need to be redefined as strings.

```ts
// Good
const table = sqliteTable("session", {
  id: text().primaryKey(),
  project_id: text().notNull(),
  created_at: integer().notNull(),
})

// Bad
const table = sqliteTable("session", {
  id: text("id").primaryKey(),
  projectID: text("project_id").notNull(),
  createdAt: integer("created_at").notNull(),
})
```

## Testing

- Avoid mocks as much as possible
- Test actual implementation, do not duplicate logic into tests
- Tests cannot run from repo root (guard: `do-not-run-tests-from-root`); run from package dirs like `packages/opencode`.

## Type Checking

- Always run `bun typecheck` from package directories (e.g., `packages/opencode`), never `tsc` directly.
