# Implementation Checklist

Requirements for maintaining code quality and consistency.

## Before Implementing a Feature

- [ ] Update specs in `docs/specs/` with new requirements

## After Implementing a Feature

- [ ] Add high-level description of the changes to `docs/implementation/changelog.md`
- [ ] Update `docs/implementation/` with technical details if useful
- [ ] Update `docs/usage/` with user-facing changes (CLI, API)
- [ ] Update test HTMLs (`/tests/*.html`) to reflect new API options and response format
- [ ] Move completed items from `docs/planning/` to specs/implementation
- [ ] Think about next steps and update themen in `docs/planning/`

## Documentation Sync

Keep these files aligned with the implementation:

| File                | Must Reflect                                        |
|---------------------|-----------------------------------------------------|
| `docs/usage/cli.md` | CLI options and examples                            |
| `docs/usage/api.md` | API endpoints, parameters, response structure       |
| `test.html`         | All API options, response format, available plugins |

## Test pages

The test pages (`/tests/*.html`) must always:
- Include all current API options (scope, format, include, data)
- Handle the current response envelope structure
- Show available data plugins (mark planned ones as disabled)
- Display all response fields appropriately

## Adding a New Plugin

1. Create plugin in `src/plugins/`
2. Register in `src/plugins/index.ts`
3. Document fully in `docs/implementation/plugins.md`
4. Add checkbox to `test.html`
