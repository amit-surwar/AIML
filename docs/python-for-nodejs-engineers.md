# Python for Node.js Engineers — AI/ML Cheat Sheet

> Audience: experienced JS/TS engineer with zero Python time.
> Goal: be productive in Python for AI/ML work in 1–2 days, not 1–2 weeks.

This is **not** a Python tutorial. It's a delta — what's different, what's the same, what to install, what to ignore. Read it once, then keep it open in a tab.

---

## 1. The mental model swap

| Concept | Node.js / TS | Python | Notes |
|---|---|---|---|
| Package manager | `npm` / `pnpm` / `bun` | `uv` (use this) | `pip` is the old, slow default. Skip it. |
| Manifest | `package.json` | `pyproject.toml` | Same idea, different syntax (TOML). |
| Lockfile | `package-lock.json` | `uv.lock` | Same idea. |
| Dependencies dir | `node_modules/` | `.venv/` | A "virtual environment" — isolated Python install per project. |
| Type checker | `tsc` | `mypy` or `pyright` | Runs separately; types are not enforced at runtime. |
| Linter / formatter | `eslint` + `prettier` / `biome` | `ruff` | Use `ruff`. Fast, all-in-one. |
| Test runner | `jest` / `vitest` | `pytest` | Same idea, simpler API. |
| Schema validation | `zod` | `pydantic` | Almost identical mental model. |
| HTTP client | `axios` / `fetch` | `httpx` | Like `axios` but async-native. |
| Web framework | `express` / `fastify` / `hono` | `fastapi` | Async, type-driven, OpenAPI built-in. |
| Notebook | (rare) | Jupyter / `marimo` | Critical for ML / data work. |
| `console.log` | `console.log(x)` | `print(x)` | Same purpose. |
| Async runtime | `node` (built-in) | `asyncio` | Library, not built-in to the language. |

**One sentence:** Python is like TypeScript without compilation, with significant whitespace, and a much larger AI/ML ecosystem.

---

## 2. Setup (~5 minutes, do this once)

### Install Python and `uv`

```bash
# Install uv (modern, fast Python package manager — the closest thing to bun for Python)
curl -LsSf https://astral.sh/uv/install.sh | sh

# Restart your terminal, then:
uv python install 3.13   # installs Python 3.13 locally
uv python list           # verify
```

`uv` replaces all of: `python`, `pip`, `pip-tools`, `virtualenv`, `pyenv`, `poetry`. Use it for everything.

### Bootstrap a new project

```bash
mkdir my-ai-app && cd my-ai-app
uv init                       # creates pyproject.toml, .python-version
uv add pydantic httpx openai  # adds deps
uv sync                       # installs into .venv/
uv run python main.py         # runs in the venv (no manual activation)
```

### What lives in a Python project

```
my-ai-app/
├── pyproject.toml      # like package.json
├── uv.lock             # like package-lock.json
├── .python-version     # like .nvmrc
├── .venv/              # like node_modules/ — DON'T commit
├── src/
│   ├── __init__.py     # marks folder as a Python package
│   ├── main.py
│   └── lib/
│       ├── __init__.py
│       └── llm.py
└── tests/
    └── test_main.py
```

**Critical:** every folder that should be importable needs an `__init__.py` (can be empty). This is the Python equivalent of "this is a module."

---

## 3. Syntax — only the non-obvious

### Blocks are indentation, not braces

```python
def hello(name: str) -> str:
    if len(name) == 0:
        return "anonymous"
    return f"hello, {name}"
```

**No braces. No semicolons.** Indentation **is** the syntax. Most editors handle this automatically. Mixing tabs and spaces will hurt you — pick spaces (4) and stick with them. Tools like `ruff format` enforce this.

### Naming is `snake_case`, classes are `PascalCase`

```python
user_name = "amit"               # variable
def get_user_by_id(user_id): ... # function
class UserService: ...           # class
USER_ROLE_ADMIN = "admin"        # constant
```

If you write camelCase you'll get linter yells. Just submit.

### Strings — f-strings replace template literals

```python
name = "Amit"
greeting = f"hello, {name}, you are {len(name)} chars long"
# JS equivalent: `hello, ${name}, you are ${name.length} chars long`
```

### Lists, dicts, tuples, sets

```python
xs = [1, 2, 3]                    # list (like Array)
d = {"a": 1, "b": 2}              # dict (like object/Map)
t = (1, 2, 3)                     # tuple — IMMUTABLE list
s = {1, 2, 3}                     # set
```

Key gotcha: `{}` is an **empty dict**, NOT an empty set. Use `set()` for empty set.

### Comprehensions (functional one-liners — used everywhere)

```python
squared = [x * x for x in range(10)]              # like xs.map(x => x*x)
evens   = [x for x in xs if x % 2 == 0]           # like xs.filter
lookup  = {u.id: u for u in users}                # build dict
unique  = {x.lower() for x in words}              # set comprehension
```

Read these constantly in AI code. Equivalent JS would be `.map()` / `.filter()` chains — Python prefers comprehensions.

### Truthy / falsy is mostly the same but watch these

```python
if not xs: ...     # True if xs is None, "", [], {}, 0, False
if xs is None: ... # explicit None check — DIFFERENT from `xs == None`
```

Use `is None` and `is not None` for None checks. Never `== None`.

### Functions, default args, and the #1 footgun

```python
def fn(name: str, tags: list[str] = None) -> str:    # OK
    if tags is None:
        tags = []
    ...

def fn(name, tags=[]):           # ⚠️ BUG: shared mutable default!
    tags.append(name)            # appends to the SAME list every call
    return tags
```

**The mutable-default-argument bug** is so famous that interviewers ask about it. Always use `None` and create the default inside.

### Classes

```python
class UserService:
    def __init__(self, db: Database) -> None:
        self.db = db                              # `self` ≈ `this`

    def find(self, user_id: str) -> User | None:
        return self.db.users.find_one({"_id": user_id})
```

`self` is always the first argument and you have to type it yourself. `__init__` is the constructor. Most AI/ML code is more functional than object-oriented — you'll write fewer classes than in Node.js.

### `==` vs `is`

```python
a = [1, 2, 3]
b = [1, 2, 3]
a == b   # True  — same contents
a is b   # False — different objects in memory
a is a   # True
```

Use `==` for value equality, `is` for identity (mostly just `is None`, `is True`, `is False`).

---

## 4. Type hints — Python's "TypeScript"

Python types are **optional** and **not enforced at runtime** by default. You add them, `mypy`/`pyright` checks them, and your editor uses them for autocomplete. Pydantic (next section) makes them enforced at runtime.

```python
from typing import Any

def add(a: int, b: int) -> int:
    return a + b

def fetch(url: str, timeout: float = 5.0) -> dict[str, Any]:
    ...

# Union types (TS: string | number)
def parse(x: str | int) -> int: ...

# Optional (TS: string | undefined)
def find(id: str) -> str | None: ...

# Generic types
def first(xs: list[int]) -> int | None:
    return xs[0] if xs else None
```

**Rule of thumb:** type every function signature. Don't bother typing local variables — the type checker infers them.

---

## 5. The AI/ML library landscape (what each TypeScript thing maps to)

| TypeScript / Node | Python | What it does |
|---|---|---|
| `zod` | `pydantic` | Schema validation + type inference |
| `axios` / `fetch` | `httpx` | HTTP client (async-native) |
| `express` / `hono` | `fastapi` | HTTP server (async, type-driven) |
| Vercel AI SDK | `instructor` / `openai` / `anthropic` / `langchain` | LLM clients + structured outputs |
| `dotenv` | `python-dotenv` or `pydantic-settings` | Env loading + validation |
| `jest` / `vitest` | `pytest` | Test runner |
| `console.log` | `print()` + `rich` for pretty | Logging / output |
| `bcrypt` / `crypto` | `passlib` / `cryptography` | Hashing / crypto |
| `prisma` / `drizzle` | `SQLAlchemy 2.x` or `SQLModel` | ORM |
| `redis` client | `redis` (Python lib) | Same |
| `bullmq` | `celery` / `arq` / `dramatiq` | Background jobs |

### AI-specific Python libraries you'll meet (these have no JS equivalents worth mentioning)

| Library | Purpose | When you'll use it |
|---|---|---|
| `transformers` (Hugging Face) | Load + run any open-source model | Stage 11+ (local models) |
| `datasets` (Hugging Face) | Load ML datasets | Fine-tuning |
| `peft`, `trl` (Hugging Face) | LoRA / fine-tuning tooling | Stage 12 (fine-tuning) |
| `numpy` | Numeric arrays (vectors, matrices) | Embeddings, math |
| `pandas` | DataFrames (SQL-like in-memory tables) | Data prep, evals |
| `scikit-learn` | Classical ML (clustering, classification) | Baselines, retrieval |
| `chromadb` / `qdrant-client` / `pinecone-client` | Vector databases | RAG (Stage 12+) |
| `sentence-transformers` | Embedding models | Local embedding |
| `llama-cpp-python` | Run GGUF models locally on CPU | Local inference |
| `ollama` | Talk to local Ollama server | Local model serving |
| `langchain` / `llama-index` | LLM orchestration frameworks | Optional; opinionated |
| `streamlit` / `gradio` | Quick AI UIs in pure Python | Demos, internal tools |
| `fastapi` + `uvicorn` | Production HTTP server for ML | Deploying models |
| `mlflow` / `wandb` | Experiment tracking, model versioning | Real ML jobs |

**You don't need to know all of these.** For the rest of this sprint, you'll mainly touch: `pydantic`, `httpx`, `openai`, `instructor`, `numpy`, `chromadb`, `transformers`. The rest are awareness only.

---

## 6. The "Hello LLM" Python script (mirrors your TypeScript Stage 5)

This is the equivalent of what you've already built — to see the syntactic correspondence:

```python
# main.py
import os
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()  # like `import "dotenv/config";`

client = OpenAI(
    api_key=os.environ["GROQ_API_KEY"],
    base_url="https://api.groq.com/openai/v1",  # Groq is OpenAI-compatible
)

response = client.chat.completions.create(
    model="llama-3.3-70b-versatile",
    messages=[
        {"role": "system", "content": "You are concise and technical."},
        {"role": "user",   "content": "Explain embeddings in one sentence."},
    ],
    stream=True,
)

for chunk in response:
    delta = chunk.choices[0].delta.content or ""
    print(delta, end="", flush=True)
print()
```

Run it:

```bash
uv add openai python-dotenv
uv run python main.py
```

Notice:
- No semicolons, no braces, indentation defines block structure
- `messages` is a list of dicts (Python equivalent of TS array of objects)
- `for chunk in response` iterates the stream — same shape as `for await (const chunk of stream)` in JS
- `or ""` handles None — Python's coalescing operator

### The Python equivalent of `generateObject` (your Stage 6 engine)

The library is called `instructor` — it does exactly what the Vercel AI SDK's `generateObject` does:

```python
import instructor
from openai import OpenAI
from pydantic import BaseModel, Field

class SupportTicket(BaseModel):
    summary: str = Field(min_length=5, max_length=200)
    category: str = Field(description="One of: billing | bug | feature_request | other")
    priority: str
    sentiment: str

client = instructor.from_openai(OpenAI(api_key="...", base_url="..."))

ticket = client.chat.completions.create(
    model="llama-3.3-70b-versatile",
    response_model=SupportTicket,   # the Pydantic class is the schema
    messages=[
        {"role": "system", "content": "You triage customer support tickets."},
        {"role": "user", "content": "My team can't log in! Urgent!"},
    ],
)

print(ticket.summary)        # fully typed, validated
print(ticket.category)
```

**The pattern is identical to what you wrote in TypeScript.** Schema → constrained generation → typed object. The mental model transfers 1:1.

---

## 7. Pydantic (= Zod, but for Python)

You'll live in Pydantic when doing AI work in Python. It's the standard.

```python
from pydantic import BaseModel, Field
from typing import Literal

class User(BaseModel):
    id: str
    name: str = Field(min_length=1, max_length=100)
    email: str | None = None                    # optional
    role: Literal["admin", "user", "guest"]     # enum
    tags: list[str] = Field(default_factory=list)  # mutable default safely

# Validates at construction time:
u = User(id="123", name="Amit", role="user")
print(u.model_dump_json())   # {"id":"123","name":"Amit","email":null,"role":"user","tags":[]}

# Throws ValidationError on bad input:
User(id="123", name="", role="superuser")  # boom
```

Compare to Zod side by side — almost the same mental model:

```typescript
// Zod (TypeScript)
const User = z.object({
  id: z.string(),
  name: z.string().min(1).max(100),
  email: z.string().email().nullable(),
  role: z.enum(["admin", "user", "guest"]),
  tags: z.array(z.string()).default([]),
});
type User = z.infer<typeof User>;
```

```python
# Pydantic (Python)
class User(BaseModel):
    id: str
    name: str = Field(min_length=1, max_length=100)
    email: str | None = None
    role: Literal["admin", "user", "guest"]
    tags: list[str] = Field(default_factory=list)
```

**Pydantic is to Python what Zod is to TypeScript.** Every serious AI Python codebase uses it.

---

## 8. Async / await — looks the same but lives in a separate runtime

```python
import asyncio
import httpx

async def fetch_user(user_id: str) -> dict:
    async with httpx.AsyncClient() as client:
        r = await client.get(f"https://api.example.com/users/{user_id}")
        return r.json()

async def main() -> None:
    user = await fetch_user("123")
    print(user)

asyncio.run(main())   # NEEDED — Python doesn't auto-run an event loop like Node
```

Key differences from Node:
- You must call `asyncio.run()` at the top — Python has no built-in event loop running in the background
- Many older libraries are sync-only (`requests`, `psycopg2`) — pick async-native ones (`httpx`, `psycopg`, `aiomysql`)
- In Jupyter notebooks, `await` works at the top level (the notebook starts a loop for you)

---

## 9. Project structure for an AI app (the Python equivalent of your current TS project)

```
my-ai-app/
├── pyproject.toml
├── uv.lock
├── .env
├── .env.example
├── .gitignore
└── src/
    ├── __init__.py
    ├── config/
    │   ├── __init__.py
    │   └── settings.py        # ≈ src/config/env.ts (Pydantic Settings)
    ├── lib/
    │   ├── __init__.py
    │   ├── llm.py             # ≈ src/lib/llm.ts
    │   └── logger.py          # ≈ src/lib/logger.ts (just use `structlog`)
    ├── chatbot/
    │   ├── __init__.py
    │   ├── tools.py
    │   └── main.py
    └── extraction/
        ├── __init__.py
        ├── engine.py
        └── extractors/
            ├── __init__.py
            ├── support_ticket.py
            ├── invoice.py
            └── resume.py
```

Same architecture, different file extension. Every concept you've internalized in TypeScript maps directly.

---

## 10. The 10 Python idioms you'll see daily in AI/ML code

```python
# 1. f-strings everywhere
prompt = f"User said: {user_input}"

# 2. enumerate when you want index + value
for i, msg in enumerate(messages):
    print(f"[{i}] {msg}")

# 3. zip when iterating two lists in parallel
for question, answer in zip(questions, answers):
    ...

# 4. List/dict comprehensions
embeddings = [embed(text) for text in texts]
by_id = {doc.id: doc for doc in documents}

# 5. Walrus operator (assign in expression)
while chunk := stream.read(1024):
    process(chunk)

# 6. Unpacking
first, *rest = [1, 2, 3, 4]      # first=1, rest=[2,3,4]
{**defaults, **overrides}         # merge dicts (like spread)

# 7. Context managers (auto-cleanup, like `using` in C#)
with open("file.txt") as f:
    content = f.read()
# file is automatically closed here

# 8. Type unions with `|`
def parse(value: str | int) -> int: ...

# 9. Pattern matching (Python 3.10+) — like a typed switch
match event:
    case {"type": "tool-call", "name": name, "args": args}:
        run_tool(name, args)
    case {"type": "text-delta", "text": text}:
        print(text)
    case _:
        pass

# 10. Dataclasses for simple records (or Pydantic when you need validation)
from dataclasses import dataclass

@dataclass
class Message:
    role: str
    content: str
```

---

## 11. Tooling setup for your editor

In Cursor / VS Code, install these extensions:
- **Python** (Microsoft) — official, gives you debugging, IntelliSense
- **Pylance** (Microsoft) — type checking (uses `pyright` under the hood)
- **Ruff** (Astral) — fast linter + formatter

Add to your project's `pyproject.toml`:

```toml
[tool.ruff]
line-length = 100
target-version = "py313"

[tool.ruff.lint]
select = ["E", "F", "I", "B", "UP", "RUF"]  # pyflakes, pycodestyle, etc.

[tool.pyright]
typeCheckingMode = "strict"
```

Then:

```bash
uv add --dev ruff pyright pytest
uv run ruff check .         # lint
uv run ruff format .        # format
uv run pyright              # type check
uv run pytest               # tests
```

This is your `eslint + prettier + tsc + vitest` equivalent. Same workflow, different tools.

---

## 12. The 7 footguns to memorize today

1. **Mutable default arguments** — use `None` then create the default inside.
2. **`is` vs `==`** — `is None`, but `== "admin"`.
3. **Indentation matters** — mixing tabs/spaces breaks code.
4. **`{}` is an empty dict, not an empty set.** Use `set()`.
5. **Division** — `/` always returns float; `//` is integer division.
6. **No automatic type coercion** — `"3" + 2` throws. Use `int("3") + 2`.
7. **Async functions return coroutines until awaited** — calling `fn()` without `await` does nothing useful.

---

## 13. Python in Cursor — practical tips

- `tsx`-equivalent for one-shot scripts: `uv run python main.py` or just `uv run main.py` if the file is a registered entry.
- For interactive exploration: `uv run python` (REPL) or `uv run jupyter lab` (Jupyter — best for ML data exploration).
- For notebooks INSIDE Cursor: install the Jupyter extension; `.ipynb` files render natively.
- Cursor's AI features work just as well on Python as on TypeScript — same Cmd+K, Cmd+L, agent flows.

---

## 14. Minimum-viable mental model

If you remember only one thing from this doc:

> **TypeScript + Zod + AI SDK ≈ Python + Pydantic + Instructor.**
>
> Everything you learned about provider abstraction, schemas as contracts, streaming, tool calling, structured outputs — all of it transfers. The syntax changes; the patterns don't.

When you cross into Python in the next stage of this project, you won't be learning AI/ML from scratch — you'll be learning a new dialect for the AI/ML you already know.

---

## 15. What to do today, before Stage 12

Optional, but if you have 30 minutes:

```bash
# 1. Install uv
curl -LsSf https://astral.sh/uv/install.sh | sh

# 2. Make a scratch directory
mkdir ~/python-scratch && cd ~/python-scratch
uv init
uv python pin 3.13

# 3. Build the same Llama chat we built in TypeScript — in Python
uv add openai python-dotenv
echo "GROQ_API_KEY=your_key_here" > .env

# 4. Save the "Hello LLM" script above as main.py
# 5. Run it
uv run python main.py
```

If you get a response, you have a working Python AI dev environment. You're ready for Stage 12.

If you skip this — totally fine, we'll do it together when we get to Stage 12.
