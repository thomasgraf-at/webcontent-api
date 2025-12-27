# Documentation Style Guide

This project maintains a structured documentation system across specialized subdirectories in `docs/`.

## Documentation Structure

### 1. Specs (`docs/specs/`)

**Purpose**: Hard requirements that must be fulfilled. Defines "what" the system does.

**Audience**: Developers, contributors, product stakeholders.

**Contains**:
- Product overview, use cases, design principles
- Functional requirements
- Interface specifications (CLI, API)

> **Important**: Any change that contradicts specs requires explicit approval.

### 2. Implementation (`docs/implementation/`)

**Purpose**: Describes "how" and "why" things are implemented.

**Audience**: Developers and maintainers.

**Contains**:
- Changelog of features
- Technical implementation details
- Design decisions with rationale

**Organization**:
- `changelog.md` - Chronological feature log
- `core.md` - Tech stack, project structure, design decisions
- `database.md` - Database schema and service
- `scope.md` - Content extraction scope types
- `handler-apis.md` - Handler function API specification
- `{aspect}.md` - Other technical aspects as needed

### 3. Proposals (`docs/proposals/`)

**Purpose**: Future plans and ideas. Not yet binding.

**Audience**: Developers, contributors.

**Contains**:
- Feature proposals and brainstorming
- Implementation roadmaps
- Design explorations

**Organization**:
- `base.md` - Overall vision and roadmap
- `command-*.md` - Command/endpoint proposals
- `plugin-*.md` - Plugin proposals
- `{aspect}.md` - Feature aspects
- `misc.md` - Low-priority ideas

**Lifecycle**: Items graduate to `specs/` once approved and to `implementation/` once built.

### 4. Usage (`docs/usage/`)

**Purpose**: End-user guides for using and deploying the project.

**Audience**: End users, operators.

**Contains**:
- How to use the CLI
- How to use the HTTP API
- How to deploy and configure

---

## Writing Guidelines

### Format

- **Markdown**: Use GitHub Flavored Markdown
- **Tables**: Use for repetitive structures (parameters, options)
- **Code Blocks**: Always specify language (`bash`, `json`, `typescript`)

### Tone

- **Concise**: Bullet points over paragraphs
- **Action-Oriented**: Focus on what users/developers can do
- **Current**: Reflect actual state, not aspirations (except in proposals/)

### Structure

- Use clear headings hierarchy
- Lead with the most important information
- Include examples for complex concepts
