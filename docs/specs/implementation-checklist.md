# Implementation Checklist

Requirements for maintaining code quality and consistency.

## Specs vs Proposals

| Directory | Purpose | Binding |
|-----------|---------|---------|
| `docs/specs/` | Hard requirements | Must be fulfilled |
| `docs/proposals/` | Future plans and ideas | Not yet committed |

**Important**: If any change contradicts the specs, ask for approval before proceeding.

## Before Implementing a Feature

- [ ] Check if feature aligns with specs
- [ ] If new requirements, update `docs/specs/` first
- [ ] Review relevant proposals in `docs/proposals/`

## After Implementing a Feature

- [ ] Add concise entry to `docs/implementation/changelog.md`
- [ ] Update `docs/implementation/` with technical details if useful
- [ ] Update `docs/usage/` with user-facing changes (CLI, API)
- [ ] Update test HTMLs (`/tests/*.html`) to reflect new API options
- [ ] Remove or mark implemented proposals as complete
- [ ] Think about next steps and update `docs/proposals/`

## Documentation Structure

```
docs/
├── specs/              # Hard requirements (binding)
│   ├── project-specs.md
│   ├── implementation-checklist.md
│   └── documentation-style.md
├── implementation/     # Technical details of current state
│   ├── changelog.md    # Feature changelog
│   ├── core.md         # Tech stack, structure, decisions
│   ├── database.md     # Database schema
│   ├── scope.md        # Scope types
│   ├── handler-apis.md # Handler function API
│   └── {aspect}.md     # Other aspects
├── usage/              # User-facing documentation
│   ├── cli.md          # CLI usage
│   ├── api.md          # HTTP API reference
│   ├── handler-functions.md
│   └── deploy.md       # Deployment
└── proposals/          # Future plans (not binding)
    ├── base.md         # Roadmap
    ├── command-*.md    # Command proposals
    ├── plugin-*.md     # Plugin proposals
    ├── {aspect}.md     # Feature aspects
    └── misc.md         # Low-priority ideas
```

## Documentation Guidelines

### Keep docs concise
- Bullet points over paragraphs
- Code examples over prose
- Tables for structured data

### Changelog entries
- One-liners for each feature
- List key changes, not implementation details
- Include new files/dependencies

### Proposals
- Include status (Planning/In Progress/Implemented)
- Link to implementation docs when complete
- Remove or archive when fully implemented

## Documentation Sync

Keep these files aligned with the implementation:

| File | Must Reflect |
|------|--------------|
| `docs/usage/cli.md` | CLI options and examples |
| `docs/usage/api.md` | API endpoints, parameters, response structure |
| `tests/*.html` | All API options, response format, available plugins |

## Test Pages

The test pages (`/tests/*.html`) must always:
- Include all current API options (scope, format, include, data)
- Handle the current response envelope structure
- Show available data plugins (mark planned ones as disabled)
- Display all response fields appropriately

## Adding a New Plugin

1. Create plugin in `src/plugins/`
2. Register in `src/plugins/index.ts`
3. Document in `docs/implementation/plugins.md`
4. Add checkbox to test HTML
