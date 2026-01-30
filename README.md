# Interview Pad

A real-time collaborative coding interview tool with VS Code-style interface.

## Features

- Real-time code collaboration (Google Docs-style)
- Multiple file support with file explorer
- Markdown files with live preview
- Code execution (Python, JavaScript, TypeScript, Java, C, C++)
- Synced output between participants

## Running Locally

### Prerequisites

- Node.js 18+
- npm

### Setup

```bash
# Install dependencies
npm install

# Create .env file (optional - defaults work for local dev)
echo "VITE_PARTYKIT_HOST=127.0.0.1:1999" > .env
```

### Start Development Servers

You need **two terminals**:

**Terminal 1 - Frontend (Vite)**
```bash
npm run dev
```

**Terminal 2 - WebSocket Server (PartyKit)**
```bash
npm run party
```

### Open the App

1. Go to http://localhost:5173
2. You'll get a unique room URL (e.g., `http://localhost:5173/abc123`)
3. Share the URL with another person (or open in another tab) to collaborate

## Testing Collaboration

1. Open http://localhost:5173 in one browser window
2. Click "Copy Link" and open it in another window/tab
3. Both windows should show the same room ID
4. Type in one window - changes appear in the other in real-time

## Tech Stack

- **Frontend**: React + TypeScript + Vite
- **Editor**: Monaco Editor
- **Real-time sync**: Yjs + PartyKit
- **Code execution**: Piston API (free, no API key needed)
- **Markdown**: react-markdown

## Project Structure

```
src/
├── components/
│   ├── Editor.tsx          # Code editor with Yjs sync
│   ├── MarkdownEditor.tsx  # Split markdown editor/preview
│   ├── FileExplorer.tsx    # Sidebar file tree
│   ├── TabBar.tsx          # Open file tabs
│   ├── OutputPanel.tsx     # Code execution output
│   └── Toolbar.tsx         # Top toolbar
├── hooks/
│   └── useFileSystem.ts    # Yjs file system logic
├── lib/
│   └── piston.ts           # Code execution API
└── App.tsx
```

## Notes

- Data persists only while the PartyKit server is running
- For production, deploy PartyKit separately and update `VITE_PARTYKIT_HOST`
