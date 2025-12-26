# Documentation Style Guide

This project maintains a structured documentation system across specialized subdirectories in `docs/` to ensure clarity, maintainability, and alignment between user needs and technical implementation.

## Documentation Structure

### 1. Specs (`docs/specs/`)
**Purpose**: The authoritative source of truth for "what" the system does.
- **Driven by**: User requirements and their iterative refinements.
- **Alignment**: Must be strictly aligned with the actual implementation.
- **Files**:
    - `core.md`: Functional requirements and core interfaces.
    - `documentation-style.md`: Guidelines for project documentation.

### 2. Implementation (`docs/implementation/`)
**Purpose**: Describes "how" the requirements defined in the specs are met.
- **Files**:
    - `architecture.md`: High-level architecture, design decisions, and technical details.
- **Target**: Developers and maintainers.

### 3. Usage (`docs/usage/`)
**Purpose**: In-depth guides for end-users of the various project components.
- **Files**:
    - `cli.md`: Comprehensive CLI reference.
    - `server.md`: Server configuration and deployment.
    - `api.md`: HTTP API endpoint documentation.

### 4. Planning (`docs/planning/`)
**Purpose**: An incubator for future features and enhancements.
- **Files**:
    - `proposals.md`: Brainstorming and early-stage design ideas.
- **Lifecycle**: Items here graduate to `specs/` and `implementation/` once refined.

### 5. User Readme (`README.md`)
**Purpose**: The front door for users of the project. Contains quick start and installation.

---

## General Guidelines

### Format
- **Markdown**: Use GitHub Flavored Markdown for all documentation.
- **Tables**: Use tables for repetitive structures like API parameters or CLI options.
- **Code Blocks**: Always specify the language (e.g., `bash`, `json`, `typescript`).

### Tone & Style
- **Concise**: Keep technical documentation brief and to the point.
- **Action-Oriented**: Focus on what the user can do or how the system behaves.
- **No Placeholders**: Documentation should reflect the current state of the project.
