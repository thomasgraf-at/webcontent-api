# Documentation Style Guide

This project maintains a structured documentation system across specialized subdirectories in `docs/`.

## Documentation Structure

### 1. Specs (`docs/specs/`)

**Purpose**: Steering document for development. Defines "what" the system does and should do.

**Audience**: Developers, contributors, product stakeholders.

**Contains**:
- Product overview, use cases, design principles
- Current functional requirements
- Future directions and planned features
- Interface specifications (CLI, API)

**Files**:
- `core.md`: Main product specification
- `documentation-style.md`: This file

### 2. Implementation (`docs/implementation/`)

**Purpose**: Describes "how" and "why" things are implemented.

**Audience**: Developers and maintainers.

**Contains**:
- Tech stack and dependencies
- Project file structure
- Design decisions with rationale
- Code architecture and patterns

**Files**:
- `architecture.md`: Technical implementation details

### 3. Planning (`docs/planning/`)

**Purpose**: Incubator for not-yet-implemented features.

**Audience**: Developers, contributors.

**Contains**:
- Feature proposals and brainstorming
- Implementation roadmaps
- Design explorations

**Lifecycle**: Items graduate to `specs/` once approved and to `implementation/` once built.

**Files**:
- `proposals.md`: General feature proposals
- `plugins.md`: Plugin system roadmap

### 4. Usage (`docs/usage/`)

**Purpose**: End-user guides for using and deploying the project.

**Audience**: End users, operators.

**Contains**:
- How to use the CLI
- How to use the HTTP API
- How to deploy and configure

**Files**:
- `cli.md`: CLI usage guide
- `api.md`: HTTP API reference
- `deploy.md`: Deployment and configuration

### 5. README.md

**Purpose**: Front door for the project.

**Contains**: Quick start, installation, basic examples.

---

## Writing Guidelines

### Format

- **Markdown**: Use GitHub Flavored Markdown
- **Tables**: Use for repetitive structures (parameters, options)
- **Code Blocks**: Always specify language (`bash`, `json`, `typescript`)

### Tone

- **Concise**: Brief and to the point
- **Action-Oriented**: Focus on what users/developers can do
- **Current**: Reflect actual state, not aspirations (except in planning/)

### Structure

- Use clear headings hierarchy
- Lead with the most important information
- Include examples for complex concepts
