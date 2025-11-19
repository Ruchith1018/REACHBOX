# 📬 Onebox Email Aggregator – Backend

A production-grade backend service that syncs multiple IMAP accounts, parses emails, indexes them into Elasticsearch, performs RAG/vector search, categorizes messages using small local LLMs (~200MB), and generates smart suggestions using OpenRouter/Gemini.

This backend powers a Reachinbox-style unified inbox system.

---

## 🚀 Features

### 📥 IMAP Sync Engine
- Multi-account IMAP connection  
- Real-time background polling  
- UID-based incremental sync  
- Robust reconnection handling  

### 📨 Email Parsing
- Full MIME parsing  
- Extract text + HTML body  
- Extract metadata (subject, from, to, date, messageId)  
- Attachment metadata support  

### 🔎 Elasticsearch Search Layer
- Full-text & metadata search  
- Snippet highlights  
- Auto-index creation  
- Indexer: `src/es/indexer.ts`

### 🧠 AI Categorization + Suggestions
- Local mini-LLMs (~200MB) for classify & suggestions  
- Category: Work / Personal / Follow-up / Spam / Promo  
- Smart replies  
- Subject/Thread summarization  
- Located in: `src/categorizer/classify.ts`

### 🤖 Gemini + OpenRouter Integrations
- AI fallback logic  
- Generative suggestions  
- Summaries  
- Completion & chat models  
- Located in: `src/utils/gemini.ts` + `src/utils/openrouter.ts`

### 🧬 RAG + Vector Engine
- Embedding generation  
- Hybrid search → text + vector  
- Similar email finding  
- Located in: `src/rag/vector.ts`

### 📡 Slack Alerts (Optional)
- Error/exception notification  
- Located in: `src/utils/slack.ts`

### 🛠 Admin Tools
- Reindex Elasticsearch  
- Manual sync trigger  
- Health checks  

---

## 📁 Project Structure
```
backend/
│
├── src/
│ ├── categorizer/
│ │ └── classify.ts
│ │
│ ├── es/
│ │ └── indexer.ts
│ │
│ ├── imap/
│ │ └── sync.ts
│ │
│ ├── rag/
│ │ └── vector.ts
│ │
│ ├── routes/
│ │ ├── admin.ts
│ │ └── emails.ts
│ │
│ ├── utils/
│ │ ├── gemini.ts
│ │ ├── mailparser.ts
│ │ ├── openrouter.ts
│ │ ├── slack.ts
│ └── logger.ts
│ └── server.ts
│
├── .env
├── package.json
└── tsconfig.json

docker/
  └── docker-compose.yml
└── README.md
```

## Environmental Variables

```
# -------------------------
# Server Configuration
# -------------------------
PORT=5000

# -------------------------
# IMAP Accounts (JSON Array)
# -------------------------
IMAP_ACCOUNTS_JSON=[{...}]

# -------------------------
# Elasticsearch
# -------------------------
ES_HOST=http://localhost:9200
ES_INDEX=emails

# -------------------------
# Embeddings / Vector Search
# -------------------------
EMBEDDING_MODEL=openai/text-embedding

# -------------------------
# AI Keys
# -------------------------
OPENROUTER_API_KEY=
GEMINI_API_KEY=

# -------------------------
# Slack Notifications (optional)
# -------------------------
SLACK_WEBHOOK_URL=
```

## 📡 API Endpoints

### 📩 Emails API
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/emails` | Get all emails |
| GET | `/emails/:id` | Get a specific email |
| GET | `/emails/search?q=` | Search emails |
| GET | `/emails/thread/:threadId` | Get thread |

### 🔧 Admin API
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/health` | Backend status |
| POST | `/admin/reindex` | Recreate Elasticsearch index |
| POST | `/admin/test-sync` | Fetch IMAP emails instantly |

---

## 🔧 Code Modules Overview

![Preview](https://github.com/Ruchith1018/REACHBOX/blob/main/Screenshot%202025-11-19%20102103.png)

### **IMAP Sync – `src/imap/sync.ts`**
Handles:
- IMAP connections  
- Fetching email UIDs  
- New mail detection  
- Pushing parsed emails → ES  

### **Email Parser – `src/utils/mailparser.ts`**
- Parses MIME  
- Normalizes HTML/text  
- Extracts addresses  

### **Categorizer – `src/categorizer/classify.ts`**
- Loads small LLM model  
- Predicts category  
- Generates suggestions  

### **Vector Engine – `src/rag/vector.ts`**
- Embedding creation  
- Hybrid vector + keyword search  
- Reranking  

### **AI Integrations**
- `gemini.ts` → Google Gemini models  
- `openrouter.ts` → OpenRouter models  
- Supports fallback chain  

### **Logger – `src/utils/logger.ts`**
- Timestamped logs  
- Error logs  
- Debug logs  

---

##SETUP

🐳 1. Run Using Docker (Recommended)

Start all services (backend + Elasticsearch):
```
docker-compose up --build
```

Run in background (detached mode):
```
docker-compose up -d
```
Stop containers:
```
docker-compose down
```

▶️ 2. Run Locally (Development – TypeScript)
Install dependencies
```
npm install
```

Start backend in dev mode (auto-reload with ts-node-dev / nodemon)
```
npm run dev
```




