# Mission Control — Plan de Desarrollo Estratégico v2.0

> **Fecha:** 23 de febrero de 2026
> **Versión actual:** 1.2.0
> **Autor:** Equipo de Ingeniería
> **Audiencia:** CEO, CTO, Equipo Técnico

---

## Tabla de Contenidos

1. [Análisis del Estado Actual](#1-análisis-del-estado-actual)
2. [Plan de Desarrollo: Vista de Grafos/Nodos](#2-vista-de-grafosnodos-en-tiempo-real)
3. [Plan de Desarrollo: Métricas de Costes y Tokens](#3-métricas-de-costes-y-tokens-por-agente)
4. [Evaluación: Convex vs SQLite vs Supabase](#4-evaluación-convex-vs-sqlite-vs-supabase)
5. [Plan de Migración a Convex](#5-plan-de-migración-a-convex)
6. [Fases de Desarrollo](#6-fases-de-desarrollo)
7. [Stack Recomendado por Feature](#7-stack-recomendado-por-feature)
8. [Estimaciones de Tiempo](#8-estimaciones-de-tiempo)
9. [Riesgos y Mitigaciones](#9-riesgos-y-mitigaciones)
10. [Decisiones Pendientes](#10-decisiones-pendientes)

---

## 1. Análisis del Estado Actual

### 1.1 Arquitectura General

```
┌─────────────────────────────────────────────────────┐
│                  FRONTEND (React 18)                │
│  Zustand Store ← useSSE() ← EventSource            │
│  MissionQueue (Kanban) │ TaskModal │ AgentsSidebar  │
│  PlanningTab │ LiveFeed │ ActivityLog               │
└──────────────────────┬──────────────────────────────┘
                       │ HTTP / SSE
┌──────────────────────▼──────────────────────────────┐
│              BACKEND (Next.js 14 App Router)        │
│  33 API Routes │ SSE Broadcaster │ Auth Middleware   │
│  Planning Engine │ Auto-Dispatch │ Orchestration API │
└──────┬───────────────────────────────────┬──────────┘
       │ SQL                               │ WebSocket
┌──────▼──────────┐           ┌────────────▼──────────┐
│  SQLite (WAL)   │           │  OpenClaw Gateway     │
│  better-sqlite3 │           │  Ed25519 Auth         │
│  13 tablas      │           │  RPC + Events         │
│  7 migraciones  │           │  Agent Sessions       │
└─────────────────┘           └───────────────────────┘
```

### 1.2 Stack Técnico Actual

| Capa | Tecnología | Versión |
|------|-----------|---------|
| Framework | Next.js (App Router) | 14.2.21 |
| UI | React | 18.2.0 |
| Lenguaje | TypeScript (strict) | 5.x |
| Estado cliente | Zustand | 5.0.3 |
| Base de datos | SQLite (better-sqlite3) | 12.6.2 |
| Validación | Zod | 4.3.6 |
| Estilos | Tailwind CSS | 3.4.x |
| Iconos | Lucide React | 0.468.0 |
| Drag & Drop | @hello-pangea/dnd | 17.0.0 |
| Auth (Gateway) | Ed25519 challenge-response | Custom |
| Real-time | SSE (Server-Sent Events) | Custom |
| Gateway comm | WebSocket (RPC) | Custom |
| Container | Docker + Docker Compose | - |

### 1.3 Base de Datos — 13 Tablas

| Tabla | Registros típicos | Propósito |
|-------|-------------------|-----------|
| `workspaces` | ~5 | Espacios de trabajo aislados |
| `agents` | ~10-20 | Agentes AI (local + Gateway) |
| `tasks` | ~50-200 | Cola de misiones (Kanban) |
| `planning_questions` | ~5-15 por tarea | Flujo de planificación AI |
| `planning_specs` | 1 por tarea | Especificación bloqueada |
| `conversations` | ~10-50 | Conversaciones agente-agente |
| `conversation_participants` | N:M | Participantes |
| `messages` | ~100-1000 | Mensajes de chat |
| `events` | ~500-5000 | Feed en tiempo real |
| `openclaw_sessions` | ~10-50 | Mapeo agente → sesión Gateway |
| `task_activities` | ~20-100 por tarea | Log de actividad |
| `task_deliverables` | ~5-20 por tarea | Entregables rastreados |
| `businesses` | ~1-5 | Legacy (compatibilidad) |

### 1.4 API Routes — 33 Endpoints

| Grupo | Endpoints | Descripción |
|-------|-----------|-------------|
| `/api/tasks` | 13 | CRUD + planning + dispatch + activities + deliverables + subagents + test |
| `/api/agents` | 6 | CRUD + discover + import + OpenClaw info |
| `/api/openclaw` | 6 | Status + sessions + history + models + orchestra |
| `/api/events` | 3 | CRUD + SSE stream |
| `/api/workspaces` | 4 | CRUD |
| `/api/files` | 4 | Upload + download + preview + reveal |
| `/api/webhooks` | 1 | Agent completion webhook (HMAC) |
| `/api/demo` | 1 | Modo demo |

### 1.5 Flujos Principales

#### Flujo de Planificación (Planning Flow)
```
Usuario crea tarea → status='planning'
  → POST /planning (crea sesión OpenClaw)
  → AI hace preguntas → se almacenan en planning_messages (JSON)
  → Usuario responde → POST /planning/answer
  → GET /planning/poll (polling cada 2s, timeout 30s)
  → AI genera spec + agentes recomendados
  → POST /planning/approve → crea agentes + auto-dispatch
```

#### Flujo de Dispatch
```
Tarea asignada a agente → PATCH /tasks/:id {status: 'in_progress'}
  → Auto-dispatch detecta cambio
  → Conecta con OpenClaw Gateway
  → Crea/obtiene sesión del agente
  → Envía mensaje con contexto de tarea
  → Agente trabaja → webhooks de progreso
  → POST /webhooks/agent-completion → actualiza tarea
```

#### Real-time (SSE)
```
Cualquier mutación en API → broadcast(event)
  → SSE broadcaster → envía a todos los clientes conectados
  → useSSE() hook → parsea evento → actualiza Zustand store
  → React re-render → UI actualizado
  → Latencia: ~100ms
```

### 1.6 Lo que Funciona

- **Kanban board completo** con 7 columnas y drag-and-drop
- **Planificación AI interactiva** con preguntas, respuestas y specs
- **Dispatch automático** de tareas a agentes OpenClaw
- **Real-time via SSE** con reconexión automática
- **Gestión de agentes** (crear, importar desde Gateway, discover)
- **Sub-agentes** con tracking de sesiones
- **Activity log** y deliverables por tarea
- **Auth** con Bearer token y HMAC webhooks
- **Workspaces** multi-espacio
- **Docker deployment** listo para producción
- **Device identity** con Ed25519 para pairing seguro

### 1.7 Lo que Falta / Limitaciones

| Área | Limitación | Impacto |
|------|-----------|---------|
| **Visualización** | Sin vista de grafo/nodos — solo Kanban | No se ven relaciones agente-tarea en tiempo real |
| **Métricas** | Sin tracking de costes, tokens, o performance | Imposible medir ROI de agentes |
| **Real-time** | SSE es unidireccional (server→client) | No soporta bidireccional nativo |
| **DB** | SQLite single-writer, no escala horizontal | Bottleneck con >10 usuarios concurrentes |
| **DB** | Sin subscriptions nativas | Polling necesario para algunos flujos |
| **Grafos** | Sin modelo de datos para dependencias entre tareas | No se pueden visualizar workflows complejos |
| **Analytics** | Sin historial de costes por sesión/agente | Sin datos para optimización |
| **Observabilidad** | Sin métricas de latencia o errores agregadas | Debugging reactivo, no proactivo |

---

## 2. Vista de Grafos/Nodos en Tiempo Real

### 2.1 Visión

Un canvas interactivo donde cada agente y tarea es un nodo visual con estado en tiempo real. Las conexiones muestran relaciones activas (quién trabaja en qué, sub-agentes, dependencias). Los colores reflejan estado en vivo.

### 2.2 Modelo de Datos Necesario

#### Nuevas tablas/campos requeridos:

```sql
-- Dependencias entre tareas (grafo dirigido)
CREATE TABLE task_dependencies (
  id TEXT PRIMARY KEY,
  source_task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  target_task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  dependency_type TEXT DEFAULT 'blocks' CHECK (dependency_type IN ('blocks', 'relates_to', 'subtask_of')),
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(source_task_id, target_task_id)
);

-- Posiciones de nodos en el canvas (persistencia de layout)
CREATE TABLE graph_node_positions (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  node_type TEXT NOT NULL CHECK (node_type IN ('agent', 'task', 'group')),
  node_id TEXT NOT NULL,
  x REAL NOT NULL DEFAULT 0,
  y REAL NOT NULL DEFAULT 0,
  pinned INTEGER DEFAULT 0,
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(workspace_id, node_type, node_id)
);
```

#### Campos adicionales en tablas existentes:

```sql
-- En tasks: parent_task_id para jerarquía
ALTER TABLE tasks ADD COLUMN parent_task_id TEXT REFERENCES tasks(id);

-- En agents: posición y grupo visual
ALTER TABLE agents ADD COLUMN group_label TEXT;
```

### 2.3 Diseño de Nodos

#### Nodo de Agente
```
┌──────────────────────────┐
│  🦞 Orchestrator         │  ← Emoji + Nombre
│  ──────────────────────  │
│  ● WORKING               │  ← Estado con color
│  Model: claude-sonnet     │  ← Modelo AI
│  Tasks: 3 active          │  ← Contador
│  ↓ 2 sub-agents           │  ← Sub-agentes spawneados
└──────────────────────────┘
```

**Colores de estado:**
- `standby` → Gris (#6B7280) — Borde gris, brillo tenue
- `working` → Verde pulsante (#10B981) — Borde verde, glow animado
- `offline` → Rojo (#EF4444) — Borde rojo, opacidad reducida

#### Nodo de Tarea
```
┌──────────────────────────┐
│  🔴 URGENT               │  ← Prioridad con color
│  Redesign landing page   │  ← Título
│  ──────────────────────  │
│  ▶ IN PROGRESS           │  ← Estado con icono
│  ⏱ 45min elapsed          │  ← Tiempo transcurrido
│  📦 2/5 deliverables      │  ← Progreso entregables
└──────────────────────────┘
```

**Colores de estado de tarea:**
- `planning` → Púrpura (#8B5CF6) pulsante
- `inbox` → Rosa (#EC4899)
- `assigned` → Amarillo (#F59E0B)
- `in_progress` → Azul (#3B82F6) con animación
- `testing` → Cian (#06B6D4)
- `review` → Púrpura (#8B5CF6)
- `done` → Verde (#10B981) con checkmark

### 2.4 Tipos de Conexiones (Edges)

| Tipo | Visual | Descripción |
|------|--------|-------------|
| `assignment` | Línea sólida azul → | Agente asignado a tarea |
| `subagent` | Línea punteada verde → | Sub-agente spawneado |
| `blocks` | Línea roja con flecha → | Tarea A bloquea tarea B |
| `relates_to` | Línea gris punteada ↔ | Relación informativa |
| `subtask_of` | Línea sólida fina ↓ | Tarea hija |
| `created_by` | Línea amarilla punteada → | Agente creó tarea (planning) |

### 2.5 Interactividad

- **Zoom + Pan**: Canvas infinito con controles de zoom
- **Drag nodos**: Mover agentes/tareas en el canvas
- **Click nodo**: Abre panel lateral con detalle (reutiliza TaskModal/AgentModal)
- **Hover edge**: Muestra tooltip con metadatos de la relación
- **Filtros**: Por workspace, estado, agente, prioridad
- **Auto-layout**: Algoritmo force-directed con opción de layout jerárquico
- **Minimap**: Vista miniatura para navegación rápida
- **Agrupación**: Agrupar agentes por workspace o rol

### 2.6 Actualizaciones Real-time

Nuevos eventos SSE necesarios:

```typescript
type GraphSSEEventType =
  | 'agent_status_changed'    // Cambio de color del nodo
  | 'task_assigned'           // Nueva edge assignment
  | 'task_unassigned'         // Edge removal
  | 'subagent_spawned'        // Nueva edge + nodo
  | 'subagent_completed'      // Edge cambia de color
  | 'dependency_created'      // Nueva edge blocks/relates
  | 'dependency_removed'      // Edge removal
  | 'node_position_updated';  // Posición cambiada por otro usuario
```

### 2.7 Stack Recomendado para Grafos

| Componente | Librería | Justificación |
|-----------|----------|---------------|
| **Canvas de grafos** | **React Flow** (v12) | Estándar de la industria para node editors en React. 23k+ stars, mantenido activamente, soporte de custom nodes, edges, minimap, controles. Performance optimizada con virtualización. |
| **Layout automático** | **dagre** o **elkjs** | Algoritmos de layout jerárquico para posicionamiento automático. Dagre es más ligero; ELK es más potente para grafos complejos. |
| **Animaciones** | **Framer Motion** | Transiciones suaves al cambiar estado de nodos. Consistente con futuras animaciones en el dashboard. |
| **Alternativa evaluada** | Cytoscape.js | Más potente para grafos masivos (>10k nodos), pero API menos React-friendly. Descartado para <500 nodos. |

### 2.8 Componentes a Crear

```
src/
  components/
    graph/
      GraphView.tsx           # Container principal del canvas
      AgentNode.tsx           # Custom node para agentes
      TaskNode.tsx            # Custom node para tareas
      GroupNode.tsx           # Nodo agrupador (workspace/rol)
      AssignmentEdge.tsx      # Edge customizado (assignment)
      DependencyEdge.tsx      # Edge customizado (blocks/relates)
      SubagentEdge.tsx        # Edge customizado (subagent)
      GraphControls.tsx       # Zoom, fit, layout, filtros
      GraphMinimap.tsx        # Minimap
      GraphSidebar.tsx        # Panel lateral de detalle
      useGraphData.ts         # Hook que transforma store → nodos/edges
      useGraphLayout.ts       # Hook para auto-layout
      graph-utils.ts          # Utilidades de transformación
```

---

## 3. Métricas de Costes y Tokens por Agente

### 3.1 Visión

Dashboard de métricas que muestra en tiempo real y en histórico: tokens consumidos, coste estimado, tiempo de ejecución, y performance por agente. Permite al CEO ver ROI de cada agente y optimizar asignaciones.

### 3.2 Modelo de Datos

#### Nuevas tablas:

```sql
-- Registro de uso de tokens por interacción
CREATE TABLE token_usage (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agents(id),
  task_id TEXT REFERENCES tasks(id),
  session_id TEXT,
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER GENERATED ALWAYS AS (input_tokens + output_tokens) STORED,
  cost_usd REAL NOT NULL DEFAULT 0.0,
  operation TEXT NOT NULL CHECK (operation IN (
    'planning', 'execution', 'review', 'subagent', 'conversation'
  )),
  metadata TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Precios de modelos (configurable, actualizable)
CREATE TABLE model_pricing (
  id TEXT PRIMARY KEY,
  model_name TEXT NOT NULL UNIQUE,
  input_price_per_1k REAL NOT NULL,  -- USD por 1K tokens input
  output_price_per_1k REAL NOT NULL, -- USD por 1K tokens output
  provider TEXT NOT NULL DEFAULT 'anthropic',
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Snapshots diarios para métricas históricas
CREATE TABLE daily_metrics (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  agent_id TEXT REFERENCES agents(id),
  workspace_id TEXT REFERENCES workspaces(id),
  total_tokens INTEGER DEFAULT 0,
  total_cost_usd REAL DEFAULT 0.0,
  tasks_completed INTEGER DEFAULT 0,
  avg_task_duration_ms INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  UNIQUE(date, agent_id)
);

-- Indexes
CREATE INDEX idx_token_usage_agent ON token_usage(agent_id, created_at DESC);
CREATE INDEX idx_token_usage_task ON token_usage(task_id);
CREATE INDEX idx_token_usage_date ON token_usage(created_at);
CREATE INDEX idx_daily_metrics_date ON daily_metrics(date DESC, agent_id);
```

### 3.3 Fuentes de Datos de Tokens

El OpenClaw Gateway actualmente **no expone** métricas de tokens directamente. Estrategia de obtención:

| Método | Viabilidad | Precisión |
|--------|-----------|-----------|
| **1. Instrumentar el Gateway** | Requiere cambio en OpenClaw | 100% preciso |
| **2. Webhook de completions** | Ya existe `/webhooks/agent-completion` | Alta si Gateway envía datos |
| **3. Estimación por contenido** | Contar caracteres de mensajes ÷ 4 | ~80% aproximado |
| **4. API de billing del proveedor** | Consultar Anthropic/OpenAI usage API | 100% pero delayed |
| **5. Proxy de API calls** | Interceptar requests antes del LLM | 100% pero invasivo |

**Recomendación:** Implementar **Método 3 (estimación)** como MVP inmediato, y planificar **Método 1** con el equipo de OpenClaw para precisión completa. Añadir campo `token_usage` al webhook de completion.

### 3.4 Precios de Referencia (Feb 2026)

```typescript
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'claude-opus-4-6':     { input: 15.00, output: 75.00 },  // por 1M tokens
  'claude-sonnet-4-6':   { input: 3.00,  output: 15.00 },
  'claude-haiku-4-5':    { input: 0.80,  output: 4.00 },
  'gpt-4o':              { input: 2.50,  output: 10.00 },
  'gpt-4o-mini':         { input: 0.15,  output: 0.60 },
  // Configurable desde la tabla model_pricing
};
```

### 3.5 Dashboard de Métricas — Componentes

```
src/
  components/
    metrics/
      MetricsDashboard.tsx      # Vista principal de métricas
      CostOverview.tsx          # Tarjetas resumen (total, hoy, esta semana)
      AgentCostTable.tsx        # Tabla: agente | tokens | coste | tareas
      CostTimeline.tsx          # Gráfico de líneas: coste por día/semana
      TokenDistribution.tsx     # Gráfico circular: tokens por modelo
      AgentPerformance.tsx      # Gráfico de barras: eficiencia por agente
      TaskCostBreakdown.tsx     # Desglose de coste por tarea
      ModelUsageChart.tsx       # Uso comparativo de modelos
      CostAlerts.tsx            # Alertas de presupuesto (configurable)
      MetricsFilter.tsx         # Filtros: periodo, workspace, agente
  lib/
    metrics/
      token-estimator.ts        # Estimación de tokens por contenido
      cost-calculator.ts        # Cálculo de costes con precios
      metrics-aggregator.ts     # Agregación de métricas diarias
```

### 3.6 API Routes para Métricas

| Endpoint | Método | Propósito |
|----------|--------|-----------|
| `/api/metrics/overview` | GET | Resumen global (hoy, semana, mes) |
| `/api/metrics/agents` | GET | Métricas por agente (filtrable) |
| `/api/metrics/agents/[id]` | GET | Detalle de agente específico |
| `/api/metrics/tasks/[id]` | GET | Coste de tarea específica |
| `/api/metrics/timeline` | GET | Serie temporal (day/week/month) |
| `/api/metrics/models` | GET | Distribución por modelo |
| `/api/metrics/pricing` | GET/PUT | Gestión de precios de modelos |
| `/api/metrics/alerts` | GET/POST | Configuración de alertas |
| `/api/metrics/export` | GET | Exportar CSV/JSON |

### 3.7 Librería de Gráficos

| Opción | Pros | Contras | Recomendación |
|--------|------|---------|---------------|
| **Recharts** | React-nativo, API declarativa, ligero (160KB) | Menos customizable para charts complejos | **MVP** |
| **Tremor** | UI completa para dashboards, Tailwind-native | Más opinionado, bundle más grande | Para v2 si se necesita más |
| **Chart.js + react-chartjs-2** | Muy flexible, comunidad enorme | Imperativo, no tan React-idiomático | Solo si Recharts no alcanza |
| **Visx** | Bajo nivel, máximo control (Airbnb) | Curva de aprendizaje alta | Overengineering para este caso |

**Recomendación: Recharts** — Ligero, declarativo, perfecto para el scope actual.

---

## 4. Evaluación: Convex vs SQLite vs Supabase

### 4.1 Criterios de Evaluación

| Criterio | Peso | Descripción |
|----------|------|-------------|
| Real-time nativo | 25% | Subscriptions reactivas sin SSE manual |
| Facilidad de migración | 20% | Esfuerzo para migrar 13 tablas + 33 endpoints |
| Escalabilidad | 15% | Usuarios concurrentes, datos crecientes |
| Developer Experience | 15% | Productividad del equipo, debugging |
| Coste operativo | 10% | Hosting, billing, vendor lock-in |
| Offline support | 10% | Funcionamiento sin conexión |
| Self-hosting | 5% | Capacidad de deploy on-premise |

### 4.2 SQLite (Estado Actual)

| Criterio | Score | Detalle |
|----------|-------|---------|
| Real-time | 3/10 | SSE manual implementado. Funciona pero es frágil. No hay subscriptions nativas. |
| Migración | 10/10 | Ya está implementado. Cero esfuerzo. |
| Escalabilidad | 4/10 | Single-writer. WAL ayuda con reads concurrentes. Límite ~10 usuarios simultáneos con writes frecuentes. |
| DX | 7/10 | Simple, predecible. SQL directo. Sin ORM overhead. |
| Coste | 10/10 | Gratis. Un archivo en disco. |
| Offline | 9/10 | Funciona completamente local. |
| Self-hosting | 10/10 | Zero dependencies externas. |
| **TOTAL PONDERADO** | **6.55/10** | |

**Fortalezas:**
- Zero-config, zero-cost, zero-latency para lectura
- Embebido — perfecto para single-user o equipos pequeños
- Portable (un archivo `.db`)
- WAL mode permite lecturas concurrentes

**Debilidades:**
- Single-writer lock (writes secuenciales)
- No hay subscriptions reactivas — todo es polling o SSE manual
- No escala horizontal (no puede tener réplicas de write)
- No hay backups incrementales nativos
- Sin full-text search optimizado

### 4.3 Supabase

| Criterio | Score | Detalle |
|----------|-------|---------|
| Real-time | 8/10 | Supabase Realtime (basado en PostgreSQL logical replication). Subscriptions por tabla/row/columna. |
| Migración | 5/10 | Reescribir esquema a PostgreSQL. Adaptar 33 endpoints a Supabase client o direct SQL. Auth integrado. |
| Escalabilidad | 8/10 | PostgreSQL escala a millones de filas. Connection pooling con PgBouncer. |
| DX | 7/10 | SDK completo. Dashboard visual. Logs integrados. |
| Coste | 6/10 | Free tier generoso (500MB, 50K MAU). Pro: $25/mes. Custom: variable. |
| Offline | 3/10 | Requiere conexión. Se puede implementar cache local pero es manual. |
| Self-hosting | 7/10 | Self-hostable con Docker, pero complejo (PostgREST + GoTrue + Realtime + Kong). |
| **TOTAL PONDERADO** | **6.45/10** | |

**Fortalezas:**
- Real-time nativo sobre PostgreSQL
- Auth integrado (reemplaza middleware actual)
- Row Level Security para multitenancy
- Dashboard de administración
- Edge Functions para lógica serverless

**Debilidades:**
- Dependencia de servicio externo (vendor risk)
- Latencia de red vs SQLite local (~50ms vs ~1ms)
- Self-hosting es complejo (5+ servicios)
- Realtime tiene límites en free tier (200 concurrent connections)
- Migration effort significativo

### 4.4 Convex

| Criterio | Score | Detalle |
|----------|-------|---------|
| Real-time | 10/10 | **Nativo al core.** Cada query es una subscription automática. Zero config. Cambio en DB → update automático en cliente. |
| Migración | 4/10 | Rewrite completo del data layer. Convex usa su propio schema DSL, funciones server-side (no SQL directo), y un modelo document-based (no relacional). |
| Escalabilidad | 9/10 | Managed infrastructure. Auto-scaling. Optimistic updates built-in. Diseñado para apps colaborativas real-time. |
| DX | 9/10 | TypeScript end-to-end. Type-safe queries. Hot reload de funciones. Dashboard excelente. `useQuery()` con auto-subscriptions. |
| Coste | 5/10 | Free tier: 1GB storage, generous bandwidth. Pro: $25/mes. Escalamiento puede ser costoso para alto volumen. |
| Offline | 2/10 | Sin soporte offline nativo. Optimistic updates mitigan latencia pero requiere conexión. |
| Self-hosting | 1/10 | **No auto-hostable.** Solo managed cloud. Vendor lock-in total. |
| **TOTAL PONDERADO** | **6.35/10** | |

**Fortalezas:**
- **Real-time es first-class**: Elimina todo el SSE/polling manual. Cada `useQuery()` es un live query.
- **Type safety end-to-end**: Schema → funciones → cliente, todo typed
- **Optimistic updates automáticos**: El store se actualiza instantáneamente
- **Zero-config subscriptions**: Lo que hoy requiere SSE broadcaster + useSSE hook + manual event handling → 0 líneas
- **Transactions ACID**: Mutations atómicas con rollback automático
- **Scheduling & Cron**: Built-in para tareas recurrentes (limpieza de cache, métricas diarias)

**Debilidades:**
- **Vendor lock-in total**: No self-hostable. Si Convex cierra, migración forzada.
- **Sin offline**: Requiere conexión permanente.
- **Modelo document-based**: Las 13 tablas relacionales necesitan rediseño (denormalización o references manuales).
- **No SQL directo**: Queries en JavaScript/TypeScript, no SQL. Curva de aprendizaje.
- **Coste a escala**: 1M function calls/mes en free, luego ~$0.10/1M.
- **Limita self-hosting**: Contradice el design goal actual de "un archivo SQLite portable".

### 4.5 Tabla Comparativa Final

```
                    SQLite    Supabase    Convex
                    ──────    ────────    ──────
Real-time (25%)     3/10      8/10       10/10
Migración (20%)    10/10      5/10        4/10
Escalabilidad(15%)  4/10      8/10        9/10
DX (15%)            7/10      7/10        9/10
Coste (10%)        10/10      6/10        5/10
Offline (10%)       9/10      3/10        2/10
Self-hosting (5%)  10/10      7/10        1/10
──────────────────────────────────────────────
TOTAL PONDERADO     6.55      6.45        6.35
```

### 4.6 Recomendación

**Mantener SQLite como base de datos primaria** y mejorar la capa real-time existente. Razones:

1. **El scoring es muy parejo** — ninguna opción domina claramente
2. **El real-time actual ya funciona** — SSE con ~100ms de latencia es suficiente para el caso de uso
3. **Self-hosting y offline son requisitos del producto** — Convex los elimina
4. **El esfuerzo de migración no se justifica** por la ganancia marginal
5. **SQLite escala suficiente** para el target actual (<50 usuarios concurrentes)

**Plan alternativo**: Si el número de usuarios concurrentes supera 50 o se necesita multitenancy real, evaluar **Supabase** como siguiente paso (no Convex, por vendor lock-in).

**Mejoras inmediatas en SQLite:**
- Implementar change-data-capture con triggers para SSE más fiable
- Añadir connection pooling con `better-sqlite3-pool`
- Implementar batch writes para reducir lock contention
- Considerar `libSQL` (fork de SQLite con replicación) como upgrade path

---

## 5. Plan de Migración a Convex (Si Se Decide)

> **Nota**: Esta sección existe como referencia por si la decisión cambia. La recomendación actual es NO migrar.

### 5.1 Pre-requisitos

1. Cuenta Convex configurada
2. Toda la lógica de negocio documentada
3. Tests end-to-end del sistema actual como baseline
4. Feature freeze durante la migración

### 5.2 Schema Convex

```typescript
// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  workspaces: defineTable({
    name: v.string(),
    slug: v.string(),
    description: v.optional(v.string()),
    icon: v.string(),
  }).index("by_slug", ["slug"]),

  agents: defineTable({
    name: v.string(),
    role: v.string(),
    description: v.optional(v.string()),
    avatar_emoji: v.string(),
    status: v.union(v.literal("standby"), v.literal("working"), v.literal("offline")),
    is_master: v.boolean(),
    workspace_id: v.id("workspaces"),
    soul_md: v.optional(v.string()),
    user_md: v.optional(v.string()),
    agents_md: v.optional(v.string()),
    model: v.optional(v.string()),
    source: v.union(v.literal("local"), v.literal("gateway")),
    gateway_agent_id: v.optional(v.string()),
  }).index("by_workspace", ["workspace_id"])
    .index("by_status", ["status"]),

  tasks: defineTable({
    title: v.string(),
    description: v.optional(v.string()),
    status: v.union(
      v.literal("planning"), v.literal("inbox"), v.literal("assigned"),
      v.literal("in_progress"), v.literal("testing"), v.literal("review"), v.literal("done")
    ),
    priority: v.union(v.literal("low"), v.literal("normal"), v.literal("high"), v.literal("urgent")),
    assigned_agent_id: v.optional(v.id("agents")),
    created_by_agent_id: v.optional(v.id("agents")),
    workspace_id: v.id("workspaces"),
    business_id: v.string(),
    due_date: v.optional(v.string()),
    parent_task_id: v.optional(v.id("tasks")),
    planning_session_key: v.optional(v.string()),
    planning_messages: v.optional(v.string()),
    planning_complete: v.boolean(),
    planning_spec: v.optional(v.string()),
    planning_agents: v.optional(v.string()),
    planning_dispatch_error: v.optional(v.string()),
  }).index("by_status", ["status"])
    .index("by_workspace", ["workspace_id"])
    .index("by_assigned_agent", ["assigned_agent_id"]),

  // ... (13 tablas adicionales)
});
```

### 5.3 Fases de Migración

| Fase | Duración | Descripción |
|------|----------|-------------|
| **0. Preparación** | 1 semana | Setup Convex, schema design, data export tools |
| **1. Schema + Queries** | 2 semanas | Migrar schema, crear queries y mutations en Convex |
| **2. API Adapter** | 2 semanas | Capa de compatibilidad: API routes → Convex functions |
| **3. Frontend** | 1 semana | Reemplazar `fetch()` + Zustand por `useQuery()` + `useMutation()` |
| **4. Real-time** | 3 días | Eliminar SSE, useSSE, broadcaster — todo automático en Convex |
| **5. OpenClaw bridge** | 1 semana | Convex Actions para comunicación WebSocket con Gateway |
| **6. Testing** | 1 semana | Tests de integración, performance, edge cases |
| **7. Data migration** | 2 días | Migrar datos SQLite → Convex |
| **Total** | **~8 semanas** | |

### 5.4 Riesgos de Migración

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|---------|------------|
| Vendor lock-in | Certeza | Alto | Documentar rollback plan |
| Pérdida de offline support | Certeza | Medio | Aceptar trade-off o implementar cache |
| Bugs en migración de datos | Media | Alto | Migración incremental con validación |
| Latencia de red | Baja | Medio | Convex edge network mitiga |
| Feature freeze durante migración | Certeza | Alto | Planificar sprint dedicado |

---

## 6. Fases de Desarrollo

### Fase 0 — Foundation & Cleanup (Pre-requisito)

| # | Tarea | Tipo | Dependencia | Estimación |
|---|-------|------|-------------|------------|
| 0.1 | Crear migration `008_task_dependencies` con tabla `task_dependencies` | Backend/DB | - | 2h |
| 0.2 | Crear migration `009_graph_positions` con tabla `graph_node_positions` | Backend/DB | - | 2h |
| 0.3 | Crear migration `010_token_usage` con tablas `token_usage`, `model_pricing`, `daily_metrics` | Backend/DB | - | 3h |
| 0.4 | Añadir campo `parent_task_id` a tasks (migration `011`) | Backend/DB | - | 1h |
| 0.5 | Añadir campo `group_label` a agents (migration `012`) | Backend/DB | - | 1h |
| 0.6 | Seed de `model_pricing` con precios actualizados | Backend/DB | 0.3 | 1h |
| 0.7 | Crear types nuevos en `src/lib/types.ts`: `TaskDependency`, `GraphNodePosition`, `TokenUsage`, `DailyMetric`, `ModelPricing` | Types | - | 2h |
| 0.8 | Crear schemas Zod en `src/lib/validation.ts` para nuevos tipos | Validation | 0.7 | 1h |
| 0.9 | Ampliar SSE event types con `GraphSSEEventType` | Types | - | 1h |

**Subtotal Fase 0: ~14 horas (2 días)**

---

### Fase 1 — Vista de Grafos/Nodos (MVP)

| # | Tarea | Tipo | Dependencia | Estimación |
|---|-------|------|-------------|------------|
| 1.1 | Instalar React Flow v12 + dagre | Setup | 0.x | 1h |
| 1.2 | Crear `src/components/graph/AgentNode.tsx` (custom node) | Frontend | 1.1 | 4h |
| 1.3 | Crear `src/components/graph/TaskNode.tsx` (custom node) | Frontend | 1.1 | 4h |
| 1.4 | Crear `src/components/graph/AssignmentEdge.tsx` (custom edge) | Frontend | 1.1 | 2h |
| 1.5 | Crear `src/components/graph/DependencyEdge.tsx` (custom edge) | Frontend | 1.1 | 2h |
| 1.6 | Crear `src/components/graph/SubagentEdge.tsx` (custom edge) | Frontend | 1.1 | 2h |
| 1.7 | Crear `src/components/graph/useGraphData.ts` — transforma agents+tasks+sessions → nodos+edges | Hook | 1.2, 1.3 | 6h |
| 1.8 | Crear `src/components/graph/useGraphLayout.ts` — auto-layout con dagre | Hook | 1.7 | 4h |
| 1.9 | Crear `src/components/graph/GraphView.tsx` — container principal con ReactFlow | Frontend | 1.7, 1.8 | 6h |
| 1.10 | Crear `src/components/graph/GraphControls.tsx` — zoom, fit, filtros | Frontend | 1.9 | 3h |
| 1.11 | Crear `src/components/graph/GraphMinimap.tsx` | Frontend | 1.9 | 1h |
| 1.12 | Añadir toggle Kanban ↔ Grafo en `WorkspaceDashboard.tsx` | Frontend | 1.9 | 2h |
| 1.13 | API: `GET/POST /api/tasks/dependencies` — CRUD de dependencias | Backend | 0.1, 0.8 | 4h |
| 1.14 | API: `GET/PUT /api/graph/positions` — persistir posiciones de nodos | Backend | 0.2, 0.8 | 3h |
| 1.15 | Conectar SSE real-time al GraphView (reutilizar useSSE) | Frontend | 1.9 | 3h |
| 1.16 | Animaciones de estado: pulso en `working`, fade en `offline`, glow en progreso | Frontend | 1.2, 1.3 | 3h |
| 1.17 | Click en nodo → abre TaskModal o AgentModal existente | Frontend | 1.9 | 2h |
| 1.18 | Tests unitarios para `useGraphData` y `useGraphLayout` | Testing | 1.7, 1.8 | 3h |

**Subtotal Fase 1: ~53 horas (7 días)**

---

### Fase 2 — Métricas de Costes y Tokens (MVP)

| # | Tarea | Tipo | Dependencia | Estimación |
|---|-------|------|-------------|------------|
| 2.1 | Crear `src/lib/metrics/token-estimator.ts` — estimación de tokens por contenido (chars/4 + overhead) | Backend | 0.3 | 4h |
| 2.2 | Crear `src/lib/metrics/cost-calculator.ts` — cálculo con model_pricing | Backend | 0.6, 2.1 | 3h |
| 2.3 | Instrumentar `OpenClawClient.sendMessage()` para registrar tokens estimados | Backend | 2.1 | 3h |
| 2.4 | Instrumentar webhook de completion para capturar token usage (si disponible) | Backend | 2.1 | 2h |
| 2.5 | Crear `src/lib/metrics/metrics-aggregator.ts` — agregación diaria | Backend | 0.3, 2.2 | 4h |
| 2.6 | API: `GET /api/metrics/overview` — resumen global | Backend | 2.2, 2.5 | 3h |
| 2.7 | API: `GET /api/metrics/agents` — métricas por agente | Backend | 2.2 | 3h |
| 2.8 | API: `GET /api/metrics/agents/[id]` — detalle agente | Backend | 2.7 | 2h |
| 2.9 | API: `GET /api/metrics/timeline` — serie temporal | Backend | 2.5 | 3h |
| 2.10 | API: `GET /api/metrics/models` — distribución por modelo | Backend | 2.2 | 2h |
| 2.11 | API: `GET/PUT /api/metrics/pricing` — gestión de precios | Backend | 0.6 | 2h |
| 2.12 | API: `GET /api/metrics/export` — exportar CSV/JSON | Backend | 2.6 | 3h |
| 2.13 | Instalar Recharts | Setup | - | 0.5h |
| 2.14 | Crear `CostOverview.tsx` — tarjetas resumen (total hoy, semana, mes, all-time) | Frontend | 2.6, 2.13 | 4h |
| 2.15 | Crear `AgentCostTable.tsx` — tabla ordenable con agente, tokens, coste, tareas | Frontend | 2.7, 2.13 | 4h |
| 2.16 | Crear `CostTimeline.tsx` — gráfico de líneas temporal | Frontend | 2.9, 2.13 | 4h |
| 2.17 | Crear `TokenDistribution.tsx` — pie/donut chart de tokens por modelo | Frontend | 2.10, 2.13 | 3h |
| 2.18 | Crear `AgentPerformance.tsx` — bar chart de eficiencia (tokens/tarea, coste/tarea) | Frontend | 2.7, 2.13 | 3h |
| 2.19 | Crear `MetricsDashboard.tsx` — layout principal que compone todos los charts | Frontend | 2.14-2.18 | 4h |
| 2.20 | Crear `MetricsFilter.tsx` — filtros de período, workspace, agente | Frontend | 2.19 | 3h |
| 2.21 | Añadir pestaña "Metrics" en navegación principal | Frontend | 2.19 | 1h |
| 2.22 | Cron job / scheduled task para agregar daily_metrics | Backend | 2.5 | 3h |
| 2.23 | Tests para token-estimator y cost-calculator | Testing | 2.1, 2.2 | 3h |

**Subtotal Fase 2: ~62 horas (8 días)**

---

### Fase 3 — Mejoras Real-time y Polish

| # | Tarea | Tipo | Dependencia | Estimación |
|---|-------|------|-------------|------------|
| 3.1 | Implementar SSE event batching (agrupar eventos en ventana de 100ms) | Backend | - | 4h |
| 3.2 | Añadir event types para métricas: `metrics_updated`, `cost_alert` | Backend | F2 | 2h |
| 3.3 | Implementar cost alerts configurables (umbral por agente/workspace) | Backend+Frontend | 2.19 | 6h |
| 3.4 | GraphView: drag-to-connect para crear dependencias entre tareas | Frontend | F1 | 6h |
| 3.5 | GraphView: context menu (right-click) en nodos y edges | Frontend | F1 | 4h |
| 3.6 | GraphView: agrupación visual por workspace o rol | Frontend | F1 | 6h |
| 3.7 | GraphView: timeline mode (nodos ordenados por fecha) | Frontend | F1 | 6h |
| 3.8 | Métricas en TaskModal — mostrar coste estimado de tarea en pestaña de detalle | Frontend | F2 | 3h |
| 3.9 | Métricas en AgentsSidebar — mini badge con coste del agente | Frontend | F2 | 2h |
| 3.10 | Export de grafo como PNG/SVG | Frontend | F1 | 3h |
| 3.11 | Keyboard shortcuts para GraphView (G: toggle graph, F: fit view) | Frontend | F1 | 2h |
| 3.12 | Performance: virtualización de nodos en GraphView (>100 nodos) | Frontend | F1 | 4h |
| 3.13 | Performance: debounce de posición updates | Frontend | 1.14 | 2h |
| 3.14 | E2E tests con Playwright para GraphView | Testing | F1 | 6h |
| 3.15 | E2E tests con Playwright para MetricsDashboard | Testing | F2 | 4h |
| 3.16 | Documentación de la GraphView API (para integraciones) | Docs | F1 | 3h |
| 3.17 | Documentación de las Metrics APIs | Docs | F2 | 3h |

**Subtotal Fase 3: ~66 horas (9 días)**

---

### Fase 4 — Observabilidad y Producción

| # | Tarea | Tipo | Dependencia | Estimación |
|---|-------|------|-------------|------------|
| 4.1 | Implementar health check endpoint mejorado (`/api/health` con métricas) | Backend | - | 3h |
| 4.2 | Logging estructurado (reemplazar console.log por logger con niveles) | Backend | - | 6h |
| 4.3 | Error tracking integration (Sentry o similar) | Backend+Frontend | - | 4h |
| 4.4 | Rate limiting en API routes | Backend | - | 4h |
| 4.5 | Database backup automatizado (SQLite snapshot) | DevOps | - | 3h |
| 4.6 | Monitoring dashboard (Grafana/simple) con métricas del servidor | DevOps | 4.1 | 6h |
| 4.7 | Load testing con k6 o similar (baseline de performance) | Testing | - | 4h |
| 4.8 | Actualizar Docker image con nuevas dependencias | DevOps | F1, F2 | 2h |
| 4.9 | CI/CD pipeline (GitHub Actions: lint, test, build, deploy) | DevOps | - | 6h |
| 4.10 | Actualizar README y documentación con nuevas features | Docs | F1, F2, F3 | 4h |

**Subtotal Fase 4: ~42 horas (6 días)**

---

## 7. Stack Recomendado por Feature

### Vista de Grafos

| Componente | Tecnología | Versión | Justificación |
|-----------|-----------|---------|---------------|
| Canvas de grafos | React Flow | 12.x | Estándar de facto para node-based UIs en React |
| Layout automático | dagre | 0.8.x | Ligero, algoritmo de layout jerárquico probado |
| Animaciones de nodos | CSS + Tailwind | - | Coherente con el stack actual, sin deps extras |
| Persistencia de layout | SQLite (tabla existente) | - | Mismo stack, sin overhead |

### Métricas y Analytics

| Componente | Tecnología | Versión | Justificación |
|-----------|-----------|---------|---------------|
| Gráficos | Recharts | 2.x | Ligero, declarativo, React-native |
| Estimación de tokens | Custom (chars/4) | - | MVP simple, upgrade a tiktoken si necesario |
| Agregación | SQLite queries + cron | - | Sin infraestructura adicional |
| Export | Custom (csv-stringify) | - | Ligero, sin deps pesadas |

### Mejoras de Infraestructura

| Componente | Tecnología | Versión | Justificación |
|-----------|-----------|---------|---------------|
| Logging | pino | 8.x | Structured logging, fast, JSON output |
| Error tracking | Sentry | 8.x | Estándar de la industria |
| Rate limiting | Custom middleware | - | Sin deps externas para el scope actual |
| Testing E2E | Playwright (ya instalado) | 1.58.x | Ya en el proyecto |

---

## 8. Estimaciones de Tiempo

### Resumen por Fase

| Fase | Descripción | Horas | Días (8h) | Sprint (2 sem) |
|------|------------|-------|-----------|----------------|
| **0** | Foundation & Cleanup | 14h | 2 días | - |
| **1** | Vista de Grafos (MVP) | 53h | 7 días | Sprint 1 |
| **2** | Métricas de Costes (MVP) | 62h | 8 días | Sprint 2 |
| **3** | Mejoras & Polish | 66h | 9 días | Sprint 3 |
| **4** | Observabilidad & Producción | 42h | 6 días | Sprint 3 |
| **TOTAL** | | **237h** | **32 días** | **~3 sprints** |

### Timeline Propuesto

```
Semana 1-2:   Fase 0 + Fase 1 (Foundation + Grafos MVP)
              ├── Día 1-2:   Migraciones DB, types, validation
              ├── Día 3-5:   Custom nodes + edges
              ├── Día 6-8:   GraphView + layout + controls
              └── Día 9-10:  Integración SSE + polish

Semana 3-4:   Fase 2 (Métricas MVP)
              ├── Día 1-3:   Token estimator + cost calculator + APIs
              ├── Día 4-6:   Charts (Recharts) + dashboard layout
              ├── Día 7-8:   Filtros + export + cron
              └── Día 9-10:  Tests + integración

Semana 5-6:   Fase 3 + Fase 4 (Polish + Producción)
              ├── Día 1-4:   Mejoras de grafos (drag-connect, groups, timeline)
              ├── Día 5-7:   Cost alerts + métricas en UI existente
              ├── Día 8-9:   Logging, monitoring, CI/CD
              └── Día 10:    Documentación + release
```

### Milestones Clave

| Milestone | Semana | Entregable |
|-----------|--------|------------|
| **M1: Grafos Funcionales** | Semana 2 | Vista de grafos con nodos de agentes y tareas, edges de asignación, colores de estado real-time |
| **M2: Métricas Online** | Semana 4 | Dashboard con coste por agente, timeline, distribución por modelo, export CSV |
| **M3: Production Ready** | Semana 6 | Tests E2E, logging, monitoring, CI/CD, documentación completa |

---

## 9. Riesgos y Mitigaciones

| # | Riesgo | Probabilidad | Impacto | Mitigación |
|---|--------|-------------|---------|------------|
| R1 | React Flow performance con >200 nodos | Media | Alto | Implementar virtualización (tarea 3.12). Testear con datos sintéticos. |
| R2 | OpenClaw Gateway no expone token usage | Alta | Alto | MVP con estimación (chars/4). Planificar integración con equipo Gateway. |
| R3 | SSE reconnection drops durante updates del grafo | Baja | Medio | Ya implementado retry. Añadir event buffering (tarea 3.1). |
| R4 | Cálculo de costes impreciso | Media | Medio | Documentar margen de error (~20%). Validar contra billing real mensualmente. |
| R5 | Scope creep en la vista de grafos | Alta | Alto | MVP estricto en Fase 1. Features avanzadas solo en Fase 3. |
| R6 | SQLite locks con writes concurrentes de métricas | Baja | Medio | Batch writes. WAL mode ya activo. Considerar write queue. |
| R7 | Breaking changes en React Flow v12 | Baja | Bajo | Pin version exacta. Seguir release notes. |

---

## 10. Decisiones Pendientes

| # | Decisión | Opciones | Recomendación | Responsable | Deadline |
|---|----------|----------|---------------|-------------|----------|
| D1 | Precisión de token tracking | Estimación vs Gateway integration | Estimación MVP → Gateway v2 | CTO | Antes de Fase 2 |
| D2 | Persistencia de layout del grafo | Por usuario vs global por workspace | Global por workspace (simpler) | Product | Antes de Fase 1 |
| D3 | Alertas de coste | Email vs in-app vs ambos | In-app MVP → Email v2 | Product | Antes de Fase 3 |
| D4 | Export de métricas | CSV vs JSON vs ambos | Ambos (esfuerzo marginal) | Eng | Durante Fase 2 |
| D5 | Frecuencia de agregación | Real-time vs daily vs hourly | Hourly (balance coste/frescura) | CTO | Antes de Fase 2 |
| D6 | Licencia de React Flow | MIT (v11) vs Pro (v12 features) | MIT suffices para MVP | CTO | Antes de Fase 1 |

---

## Apéndice A — Dependencias Nuevas a Instalar

```bash
# Fase 1 — Grafos
npm install @xyflow/react dagre @types/dagre

# Fase 2 — Métricas
npm install recharts

# Fase 4 — Observabilidad (opcional)
npm install pino pino-pretty
```

**Impacto en bundle size estimado:**
- React Flow: ~180KB gzipped
- dagre: ~30KB gzipped
- Recharts: ~160KB gzipped
- Total incremento: ~370KB gzipped (~15% sobre el bundle actual estimado)

---

## Apéndice B — Estructura de Archivos Propuesta (Post-Implementación)

```
src/
├── app/
│   ├── api/
│   │   ├── tasks/
│   │   │   └── dependencies/          # NUEVO
│   │   ├── graph/
│   │   │   └── positions/             # NUEVO
│   │   └── metrics/                   # NUEVO
│   │       ├── overview/
│   │       ├── agents/
│   │       │   └── [id]/
│   │       ├── tasks/
│   │       │   └── [id]/
│   │       ├── timeline/
│   │       ├── models/
│   │       ├── pricing/
│   │       ├── alerts/
│   │       └── export/
│   ├── metrics/                       # NUEVA página
│   │   └── page.tsx
│   └── workspace/[slug]/
│       └── page.tsx                   # Toggle Kanban/Grafo
├── components/
│   ├── graph/                         # NUEVO directorio
│   │   ├── GraphView.tsx
│   │   ├── AgentNode.tsx
│   │   ├── TaskNode.tsx
│   │   ├── GroupNode.tsx
│   │   ├── AssignmentEdge.tsx
│   │   ├── DependencyEdge.tsx
│   │   ├── SubagentEdge.tsx
│   │   ├── GraphControls.tsx
│   │   ├── GraphMinimap.tsx
│   │   ├── GraphSidebar.tsx
│   │   ├── useGraphData.ts
│   │   ├── useGraphLayout.ts
│   │   └── graph-utils.ts
│   └── metrics/                       # NUEVO directorio
│       ├── MetricsDashboard.tsx
│       ├── CostOverview.tsx
│       ├── AgentCostTable.tsx
│       ├── CostTimeline.tsx
│       ├── TokenDistribution.tsx
│       ├── AgentPerformance.tsx
│       ├── TaskCostBreakdown.tsx
│       ├── ModelUsageChart.tsx
│       ├── CostAlerts.tsx
│       └── MetricsFilter.tsx
├── lib/
│   ├── db/
│   │   └── migrations.ts             # +5 nuevas migraciones
│   └── metrics/                       # NUEVO directorio
│       ├── token-estimator.ts
│       ├── cost-calculator.ts
│       └── metrics-aggregator.ts
└── hooks/
    └── useSSE.ts                      # Extendido con nuevos event types
```

---

*Documento generado el 23 de febrero de 2026. Sujeto a revisión tras decisiones pendientes (Sección 10).*
