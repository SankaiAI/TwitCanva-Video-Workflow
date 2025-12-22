<div align="center">
  <img src="public/logo.svg" alt="TwitCanva Logo" width="120" />
  <h1>TwitCanva</h1>
</div>

A modern, AI-powered canvas application for generating and manipulating images and videos using OpenAI GPT Image, Google Gemini, Kling AI, Hailuo AI (MiniMax), and Fal.ai. Built with React, TypeScript, and Vite.

![TwitCanva](https://img.shields.io/badge/React-18.3.1-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5.6.2-blue)
![Vite](https://img.shields.io/badge/Vite-6.4.1-purple)
![License](https://img.shields.io/badge/license-Apache--2.0-blue)

## ✨ Features

- **🎨 Visual Canvas Interface** - Drag-and-drop node-based workflow
- **🤖 Multi-Model AI Generation** - GPT Image 1.5, Gemini Pro, Kling V1-V2.5 for images
- **🎬 Multi-Model Video Generation** - Veo 3.1, Kling V1-V2.6, Hailuo 2.3/O2 for videos
- **💃 Motion Control** - Transfer motion from reference videos to character images (Kling V2.6 via Fal.ai)
- **🖼️ Image-to-Image** - Use reference images for generation
- **📽️ Frame-to-Frame Video** - Animate between start and end frames
- **🔗 Smart Node Connections** - Type-aware validation (IMAGE→VIDEO, TEXT→IMAGE, etc.)
- **💬 AI Chat Assistant** - Built-in chat with LangGraph agent
- **📚 Asset Library** - Save and reuse generated assets
- **💾 Workflow Management** - Save, load, and share workflows
- **⚡ Real-time Updates** - Hot module replacement for instant feedback
- **🎯 Aspect Ratio Control** - Multiple preset ratios for images
- **📹 Resolution Options** - 720p and 1080p for videos
- **🔒 Secure API** - Backend proxy keeps API keys safe
- **🔄 Auto-Model Selection** - Filters models based on input compatibility
- **⚖️ Commercial Friendly** - Dual-licensed or permissive terms for commercial growth


## 🎥 Showcase

### App Overview
https://github.com/user-attachments/assets/7a64d4df-7ade-4bfa-b2cd-d615d267dd40

### Output Example
Download all the generated videos and use video editting tool like CapCut to create a final video. Check result below.

https://github.com/user-attachments/assets/43cf8bb8-bf85-45f9-96da-657033126d94

https://github.com/user-attachments/assets/e6f89da5-d3a6-4889-a38b-672cf37bbd79

This is not the perfect one, but it is a good start. Give me a try, and let me know how I can improve it. Thank you!

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Google Gemini API key (get one at [Google AI Studio](https://aistudio.google.com/app/apikey))
- Kling AI API keys (get them at [Kling AI Developer](https://app.klingai.com/global/dev/api-key))
  - Requires purchasing API packages at [Kling AI Pricing](https://klingai.com/global/dev/pricing)
- Hailuo AI API key (get one at [MiniMax Platform](https://platform.minimax.io/user-center/basic-information/interface-key))
- OpenAI API key (get one at [OpenAI Platform](https://platform.openai.com/api-keys))
  - Requires [organization verification](https://platform.openai.com/settings/organization/general) to use GPT Image models
- Fal.ai API key (get one at [Fal.ai Dashboard](https://fal.ai/dashboard/keys)) - Required for Kling V2.6 Motion Control

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/SankaiAI/TwitCanva.git
   cd TwitCanva
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   
   Create a `.env` file in the root directory:
   ```env
   # Get from https://aistudio.google.com/app/apikey
   GEMINI_API_KEY=your_gemini_api_key_here
   
   # Get from https://app.klingai.com/global/dev/api-key
   KLING_ACCESS_KEY=your_kling_access_key_here
   KLING_SECRET_KEY=your_kling_secret_key_here
   
   # Get from https://platform.minimax.io/user-center/basic-information/interface-key
   HAILUO_API_KEY=your_hailuo_api_key_here
   
   # Get from https://platform.openai.com/api-keys
   OPENAI_API_KEY=your_openai_api_key_here
   
   # Get from https://fal.ai/dashboard/keys (for Kling V2.6 Motion Control)
   FAL_API_KEY=your_fal_api_key_here
   ```
   
   > ⚠️ **Security**: API keys are stored server-side only and never exposed to the client.

4. **Start the development server**
   ```bash
   npm run dev
   ```
   
   This starts both:
   - **Frontend dev server**: `http://localhost:5173`
   - **Backend API server**: `http://localhost:3001`

## 📁 Project Structure

```
TwitCanva/
├── src/                          # Frontend source code
│   ├── components/               # React components
│   │   ├── canvas/               # Canvas node components
│   │   │   ├── CanvasNode.tsx    # Main node wrapper
│   │   │   ├── NodeContent.tsx   # Node content display
│   │   │   ├── NodeControls.tsx  # Node control panel (model selection, prompts)
│   │   │   └── NodeConnectors.tsx# Connection points
│   │   ├── modals/               # Modal dialogs
│   │   │   ├── ImageEditorModal.tsx  # Image editing
│   │   │   └── CreateAssetModal.tsx  # Asset creation
│   │   ├── AssetLibraryPanel.tsx # Reusable assets panel
│   │   ├── ChatPanel.tsx         # AI chat interface
│   │   ├── WorkflowPanel.tsx     # Workflow save/load UI
│   │   ├── HistoryPanel.tsx      # Asset history browser
│   │   ├── ContextMenu.tsx       # Right-click menu
│   │   ├── TopBar.tsx            # Application header
│   │   └── Toolbar.tsx           # Canvas toolbar
│   ├── hooks/                    # Custom React hooks
│   │   ├── useCanvasNavigation.ts# Viewport/zoom/pan
│   │   ├── useNodeManagement.ts  # Node CRUD operations
│   │   ├── useConnectionDragging.ts# Connection dragging + validation
│   │   ├── useNodeDragging.ts    # Node dragging
│   │   ├── useGeneration.ts      # AI generation logic (multi-model)
│   │   ├── useGroupManagement.ts # Node grouping
│   │   ├── useSelectionBox.ts    # Multi-select
│   │   ├── useChatAgent.ts       # Chat agent hook
│   │   ├── useWorkflow.ts        # Workflow management
│   │   └── useHistory.ts         # Undo/redo
│   ├── services/                 # API integration
│   │   └── geminiService.ts      # Backend API calls
│   ├── utils/                    # Utility functions
│   │   ├── videoHelpers.ts       # Video processing
│   │   └── connectionHelpers.ts  # Connection calculations
│   ├── types.ts                  # TypeScript definitions
│   ├── App.tsx                   # Main app component
│   └── index.tsx                 # Entry point
│
├── server/                       # Backend server
│   ├── index.js                  # Express server entry
│   ├── routes/                   # API route handlers
│   │   └── generation.js         # Image/video generation endpoints
│   ├── services/                 # External API integrations
│   │   ├── gemini.js             # Google Gemini/Veo service
│   │   ├── kling.js              # Kling AI service (V1-V2.5)
│   │   ├── fal.js                # Fal.ai service (Kling V2.6 Motion Control)
│   │   ├── hailuo.js             # Hailuo AI (MiniMax) service
│   │   └── openai.js             # OpenAI GPT Image service
│   ├── utils/                    # Utility functions
│   │   └── base64.js             # Base64 encoding helpers
│   └── agent/                    # LangGraph chat agent
│       ├── index.js              # Agent entry point
│       ├── graph/                # LangGraph definition
│       ├── prompts/              # System prompts
│       └── tools/                # Agent tools
│
├── library/                      # All stored data
│   ├── images/                   # Saved images (.png + .json metadata)
│   ├── videos/                   # Saved videos (.mp4 + .json metadata)
│   ├── workflows/                # Saved workflows (.json)
│   ├── chats/                    # Chat session history (.json)
│   └── assets/                   # User uploaded assets
│
├── .env                          # Environment variables (create this)
├── .gitignore                    # Git ignore rules
├── package.json                  # Dependencies and scripts
├── vite.config.ts                # Vite configuration
└── tsconfig.json                 # TypeScript configuration
```

## 💾 Asset Storage

All generated assets are automatically saved to local folders. **These folders are created automatically** when the server starts if they don't exist.

### Storage Locations

| Asset Type | Folder | File Format | Notes |
|------------|--------|-------------|-------|
| **Images** | `library/images/` | `.png` + `.json` | Auto-saved on generation |
| **Videos** | `library/videos/` | `.mp4` + `.json` | Auto-saved on generation |
| **Workflows** | `library/workflows/` | `.json` | Manual save via UI |
| **Chat Sessions** | `library/chats/` | `.json` | Auto-saved per message |
| **Assets** | `library/assets/` | Various | User uploaded files |

### How It Works

1. **On server startup**: Directories are created with `fs.mkdirSync(dir, { recursive: true })`
2. **On generation**: Files are saved to disk and served via `/library/*` URLs
3. **Metadata**: Each asset has a `.json` file with prompt, timestamp, and other info
4. **Persistence**: Assets persist across server restarts


> **Note**: The `library/` folder is in `.gitignore` and won't be committed to the repository.

## 🎮 Usage

### Creating Nodes

1. **Double-click** on the canvas to open the context menu
2. Select **"Add Nodes"** → Choose node type (Image/Video)
3. Enter a prompt describing what you want to generate
4. Click the **✨ Generate** button

### Connecting Nodes

1. **Hover** over a node to reveal connector buttons (+ icons)
2. **Click and drag** from a connector to create a connection
3. **Release** on another node to connect and chain generation

### AI Chat

1. Click the **Chat** button in the top bar
2. Type your message or attach images from the canvas
3. The AI assistant can help with prompts, ideas, and more

### Saving Workflows

1. Click the **Workflows** button in the top bar
2. Enter a workflow name and click **Save**
3. Load saved workflows anytime from the same panel

### Canvas Navigation

- **Pan**: Click and drag on empty canvas space
- **Zoom**: `Ctrl/Cmd + Mouse Wheel` or use the zoom slider
- **Select**: Click on a node to select it
- **Multi-select**: `Shift + Click` or drag a selection box
- **Context Menu**: Right-click for additional options

## 🔧 Available Scripts

```bash
npm run dev        # Start frontend + backend together
npm run server     # Start backend server only (port 3001)
npm run build      # Build for production
npm run preview    # Preview production build
```

## 🔒 Security

Your API key is **never exposed** to the browser:

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────┐
│  Browser/Client │────▶│  Backend :3001  │────▶│  Gemini API │
│  (No API key)   │     │  (.env file)    │     │             │
└─────────────────┘     └─────────────────┘     └─────────────┘
```

- ✅ API key stored in `.env` (server-side only)
- ✅ `.env` file is in `.gitignore`
- ✅ Backend proxies all API calls
- ✅ No sensitive data in client code

## 📦 Tech Stack

### Frontend
- **React 18** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **Lucide React** - Icons

### Backend
- **Express** - Web server
- **LangGraph.js** - Chat agent framework
- **@google/genai** - Gemini API client
- **dotenv** - Environment variables

### AI Models

**Image Generation:**
| Model | Provider | Image-to-Image | Multi-Image |
|-------|----------|:-------------:|:-----------:|
| GPT Image 1.5 | OpenAI | ✅ | ✅ |
| Gemini Pro | Google | ✅ | ✅ |
| Kling V1 | Kling AI | ✅ | ❌ |
| Kling V1.5 | Kling AI | ✅ | ❌ |
| Kling V2 New | Kling AI | ❌ | ❌ |
| Kling V2.1 | Kling AI | ❌ | ✅ |

**Video Generation:**
| Model | Provider | Text-to-Video | Image-to-Video | Frame-to-Frame |
|-------|----------|:-------------:|:--------------:|:--------------:|
| Veo 3.1 | Google | ✅ | ✅ | ✅ |
| Kling V1 | Kling AI | ✅ | ✅ | ❌ |
| Kling V1.5 | Kling AI | ✅ | ✅ | ❌ |
| Kling V1.6 | Kling AI | ✅ | ✅ | ✅ |
| Kling V2 Master | Kling AI | ✅ | ✅ | ❌ |
| Kling V2.1 | Kling AI | ✅ | ✅ | ❌ |
| Kling V2.1 Master | Kling AI | ✅ | ✅ | ❌ |
| Kling V2.5 Turbo | Kling AI | ✅ | ✅ | ❌ |
| Hailuo 2.3 | MiniMax | ✅ | ✅ | ✅ |
| Hailuo 2.3 Fast | MiniMax | ❌ | ✅ | ❌ |
| Hailuo 02 | MiniMax | ✅ | ✅ | ✅ |
| Hailuo O2 | MiniMax | ✅ | ✅ | ❌ |
| Kling V2.6 Motion | Fal.ai | ❌ | ✅ | Motion Control |

**Chat:**
- **Gemini 2.0 Flash** - Chat conversations

## 🛠️ Development

### Code Style

See `code-style-guide.md` for detailed guidelines:

- **File Size Limits**: Components 300 lines, Utils 200 lines
- **TypeScript**: Strict typing, avoid `any`
- **Comments**: JSDoc for functions, section headers for organization

### Adding New Features

1. Add UI components in `src/components/`
2. Create custom hooks in `src/hooks/`
3. Add API routes in `server/index.js`
4. Update types in `src/types.ts`

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Follow the code style guide
4. Commit your changes (`git commit -m 'Add amazing feature'`)
5. Push to the branch (`git push origin feature/amazing-feature`)
6. Open a Pull Request

## 📝 License

This project is licensed under the Apache License 2.0.

### Commercial Usage
If you are using this project for commercial purposes or building a commercial product, please refer to the [NOTICE](file:///d:/AI_Agent_Practice/TwitCanva/NOTICE) file for notification requirements.


## 🙏 Acknowledgments

- OpenAI for GPT Image generation
- Google Gemini API for AI generation
- Kling AI for video generation
- MiniMax for Hailuo AI video generation
- Fal.ai for Kling V2.6 Motion Control API
- LangGraph for agent framework
- React team for the amazing framework
- Vite team for the blazing-fast build tool

---

**Built with ❤️ using React, TypeScript, and AI APIs from OpenAI, Google, Kling, MiniMax, and Fal.ai (2025)**

