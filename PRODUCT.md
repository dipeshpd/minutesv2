# Product

<!-- impeccable:product-schema 1 -->

## Platform

desktop

## Users

Minutes is for developers, operators, founders, and other meeting-heavy power users who want their conversations to become durable local memory without handing every transcript to a hosted SaaS backend.

## Product Purpose

Minutes records, transcribes, organizes, and searches meetings and voice memos on the user's own machine. Success means a user can quickly answer what happened, what needs follow-up, who was involved, and how conversations connect across time.

## Positioning

Minutes is a local-first conversation memory system: the user's meeting archive, transcript index, entity graph, and agent-facing tools live on the machine first, with cloud or agent model calls kept optional.

## Operating Context

The product runs as a desktop app and CLI-backed local runtime. Users review meeting history, capture live notes, search transcripts, track initiatives, inspect people and commitments, and expose selected memory to local AI assistants through MCP.

## Capabilities and Constraints

- Captures meetings, live transcripts, quick thoughts, and voice memos.
- Stores durable markdown artifacts and local SQLite indexes.
- Supports a desktop app, CLI, MCP tools, and local model-backed workflows.
- Must continue to run well on Apple Silicon developer laptops.
- Must preserve privacy-first defaults and make any cloud-dependent behavior explicit.
- The requested frontend direction is a modern app shell inspired by the provided Granola screenshot, with Meetings, To-do, Initiatives, Context Map, and Meeting Helper as primary navigation.
- The requested context map should use a bipartite graph pattern: initiatives and people are hubs; meetings are dots; links explain which conversations belong to which people and initiatives.

## Brand Commitments

The product name is Minutes. The interface should feel fast, local, private, and polished enough for daily use. The user explicitly wants a modern sleek app experience and a Granola-like landing/home surface.

## Evidence on Hand

- Existing product and design context: `DESIGN.md`.
- Existing desktop frontend: `tauri/src/index.html`.
- Existing backend commands and local stores live in `tauri/src-tauri/src/commands.rs` and `crates/core/src/`.
- User-provided visual reference: `/var/folders/n2/ggqr17hn0_913gcwwsmqtwdc0000gp/T/TemporaryItems/NSIRD_screencaptureui_WXohtZ/Screenshot 2026-07-30 at 12.53.38 AM.png`.
- Galileo reference repository: `wongdigital/galileo`; its AGPL source must not be copied into this MIT repository.

## Product Principles

- Local first is the product promise, not an implementation detail.
- Capture reliability outranks every optional consumer.
- The meeting archive should be navigable as relationships, not only as a chronological list.
- Every assistant-facing feature should expose source context and avoid silent mutation of human notes.
- The app should feel instant for daily review tasks.

## Accessibility & Inclusion

The desktop experience should meet WCAG AA contrast for text, expose keyboard-accessible navigation, and avoid relying on color alone for meeting state, relationship type, or urgency.
