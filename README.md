# Tachy-on Village

A local-first Electron desktop application with an explorable 2.5D village and, in later phases, Python-powered prospecting workflows. The target platforms are macOS and Windows.

The project is currently in planning. Phase 1 implementation is awaiting approval; no application dependencies or executable app have been added.

- [Product requirements](Tachy-on_Village_PRD.md)
- [Architecture, phased plan, and Phase 1 acceptance criteria](docs/IMPLEMENTATION_PLAN.md)
- [Project conventions](AGENTS.md)

The first milestone is an Electron window with a village map, camera controls, click-to-move navigation, and interactive placeholder buildings. Setup commands will be added with the implementation.

`backend/scripts/` contains the existing Cognism exporter, Outlook drafter, and Salesforce account exporter. These were inspected as source text and remain unchanged. Live automation is outside setup and Phase 1; Salesforce integration is outside V1.

Runtime contact files, browser profiles, credentials, and progress logs belong outside the source tree and must never be committed. The repository includes ignore rules for these artifacts.
