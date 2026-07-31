# Minutes Homebase UI

This is the new React/Vite frontend shell for Minutes. It can run in Vite for fast design work, but the intended surface is the native Tauri desktop app.

## Stack

- React + TypeScript + Vite
- `react-force-graph-2d` / `d3-force` for the Context Map
- Tauri command wiring through `window.__TAURI__.core.invoke`

## Galileo Boundary

The Context Map follows Galileo's product idea of a bipartite relationship graph: meetings are event nodes, while people and initiatives become hub nodes. Galileo is AGPL-3.0, so this implementation is clean-room and does not copy Galileo source.

## Migration Path

1. Keep the current `tauri/src/index.html` app as the production frontend until command parity is done.
2. Use `tauri/src-tauri/tauri.homebase.conf.json` for native Homebase builds during migration.
3. Move remaining advanced settings, dictation, and recovery flows into typed React modules under this app.
4. Point `tauri/src-tauri/tauri.conf.json` `build.frontendDist` at `../ui/dist` once the React shell covers recording, history, setup, and helper flows.

## Commands

```bash
npm install
npm run dev -- --host 127.0.0.1 --port 5174
npm run build
```

Native desktop build from the repository root:

```bash
npm --prefix tauri/ui run build
cargo tauri build --bundles app --config tauri/src-tauri/tauri.homebase.conf.json --features parakeet,metal --no-sign
```

When the UI runs inside Tauri, it loads meetings, upcoming events, meeting details, action items, recording state, permissions, local search, and Coach state from the existing Rust backend. Meeting Helper and the to-do Capture flow share one guidance and chat surface. Chat uses a saved Anthropic key from macOS Keychain when configured, then falls back to the installed local agent or Ollama path. In a normal browser the app falls back to preview data.
