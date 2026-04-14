import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { createClient } from "./serviceDb.ts";
import * as kv from "./kv_store.ts";
import { processNexusRequest } from "./nexus.ts";
import { generateSystemPrompt } from "./system_prompt.tsx";
import { SignJWT, importPKCS8 } from "jose";
import { registerAuthRoutes } from "./routes/authRoutes.ts";
import { registerAuthMiddleware } from "./middleware/authMiddleware.ts";
import { registerCrmRunRoute } from "./routes/crmRunRoute.ts";
import { registerPublicRoutes } from "./routes/publicRoutes.ts";

const env = (k: string) => process.env[k];

const app = new Hono();

const ADMIN_ROLES = new Set(["owner", "director", "admin"]);

async function requireAdmin(c: any) {
  const auth = c.req.header("authorization");
  if (!auth?.startsWith("Bearer ")) {
    return { ok: false, response: c.json({ error: "Unauthorized" }, 401) };
  }
  try {
    const { verifyBearer } = await import("./jwt.ts");
    const payload = await verifyBearer(auth.slice(7));
    if (!payload.role || !ADMIN_ROLES.has(payload.role)) {
      return { ok: false, response: c.json({ error: "Forbidden" }, 403) };
    }
    return { ok: true, payload };
  } catch {
    return { ok: false, response: c.json({ error: "Unauthorized" }, 401) };
  }
}

// Force redeploy: v10 - Production orders filtered to open deals only
console.log("Server starting... v10");

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

registerPublicRoutes(app, env);

registerAuthRoutes(app);
registerAuthMiddleware(app);
registerCrmRunRoute(app);

// Company settings endpoints
app.get("/make-server-f9553289/company", async (c) => {
  try {
    const company = await kv.get("company:settings");
    return c.json(company || null);
  } catch (error: any) {
    console.error("Error fetching company settings:", error);
    return c.json({ error: error.message }, 500);
  }
});

app.post("/make-server-f9553289/company", async (c) => {
  try {
    const body = await c.req.json();
    const { name, email, phone, website } = body;
    
    const companyData = {
      name: name || '',
      email: email || '',
      phone: phone || '',
      website: website || '',
      updatedAt: new Date().toISOString()
    };
    
    await kv.set("company:settings", companyData);
    return c.json({ success: true, data: companyData });
  } catch (error: any) {
    console.error("Error saving company settings:", error);
    return c.json({ error: error.message }, 500);
  }
});

// User management endpoints
app.get("/make-server-f9553289/users", async (c) => {
  const guard = await requireAdmin(c);
  if (!guard.ok) return guard.response;
  try {
    const users = await kv.getByPrefix("user:");
    return c.json(users || []);
  } catch (error: any) {
    console.error("Error fetching users:", error);
    return c.json({ error: error.message }, 500);
  }
});

app.post("/make-server-f9553289/users", async (c) => {
  const guard = await requireAdmin(c);
  if (!guard.ok) return guard.response;
  try {
    const body = await c.req.json();
    const { name, email, role, password } = body;
    
    if (!name || !email || !role || !password) {
      return c.json({ error: "Missing required fields" }, 400);
    }

    if (!env("DATABASE_URL")) {
        return c.json({ error: "DATABASE_URL is not configured" }, 500);
    }

    const db = createClient();

    // 1. Create CRM user (auth admin)
    const { data, error } = await db.auth.admin.createUser({
      email,
      password,
      user_metadata: { name, role },
      email_confirm: true
    });

    if (error) throw error;
    if (!data.user) throw new Error("Failed to create user");

    const userId = data.user.id;
    const createdAt = new Date().toISOString();

    // 2. Save User Profile to KV (for listing in Settings)
    const userProfile = {
      id: userId,
      name,
      email,
      role,
      createdAt
    };

    await kv.set(`user:${userId}`, userProfile);

    return c.json({ success: true, user: userProfile });
  } catch (error: any) {
    console.error("Error creating user:", error);
    return c.json({ error: error.message }, 500);
  }
});

app.put("/make-server-f9553289/users/:id", async (c) => {
  const guard = await requireAdmin(c);
  if (!guard.ok) return guard.response;
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const { name, email, role } = body;
    
    const existingUser = await kv.get(`user:${id}`);
    if (!existingUser) {
      return c.json({ error: "User not found" }, 404);
    }

    // Update KV
    const updatedUser = {
      ...existingUser,
      name: name || existingUser.name,
      email: email || existingUser.email,
      role: role || existingUser.role,
      updatedAt: new Date().toISOString()
    };
    await kv.set(`user:${id}`, updatedUser);

    // Update auth user metadata (optional)
    if (env("DATABASE_URL")) {
        // Validate UUID format to prevent crash
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (uuidRegex.test(id)) {
            try {
                const db = createClient();
                await db.auth.admin.updateUserById(id, {
                    email: email,
                    user_metadata: { name, role }
                });
            } catch (authError) {
                console.warn("Failed to update auth user:", authError);
            }
        } else {
             console.warn(`Skipping auth user update for non-UUID user id: ${id}`);
        }
    }

    return c.json({ success: true, user: updatedUser });
  } catch (error: any) {
    console.error("Error updating user:", error);
    return c.json({ error: error.message }, 500);
  }
});

app.delete("/make-server-f9553289/users/:id", async (c) => {
  const guard = await requireAdmin(c);
  if (!guard.ok) return guard.response;
  try {
    const id = c.req.param("id");
    
    // 1. Delete from auth (only if valid UUID)
    if (env("DATABASE_URL")) {
        // Validate UUID format to prevent crash
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (uuidRegex.test(id)) {
            try {
                const db = createClient();
                await db.auth.admin.deleteUser(id);
            } catch (authError) {
                console.warn("Failed to delete auth user:", authError);
            }
        } else {
            console.warn(`Skipping auth user deletion for non-UUID user id: ${id}`);
        }
    }

    // 2. Delete from KV
    await kv.del(`user:${id}`);
    return c.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting user:", error);
    return c.json({ error: error.message }, 500);
  }
});

// Reset password endpoint
app.post("/make-server-f9553289/reset-password", async (c) => {
  const guard = await requireAdmin(c);
  if (!guard.ok) return guard.response;
  try {
    const body = await c.req.json();
    const { userId, newPassword } = body;
    
    if (!userId || !newPassword || String(newPassword).length < 8) {
      return c.json({ error: "userId and newPassword (min 8 chars) are required" }, 400);
    }
    
    if (!env("DATABASE_URL")) {
      return c.json({ error: "DATABASE_URL is not configured" }, 500);
    }

    const db = createClient();
    
    // Update user password using admin API
    const { error } = await db.auth.admin.updateUserById(
      userId,
      { password: newPassword }
    );
    
    if (error) {
      console.error("Error resetting password:", error);
      return c.json({ error: error.message }, 500);
    }
    
    return c.json({ success: true });
  } catch (error: any) {
    console.error("Error resetting password:", error);
    return c.json({ error: error.message }, 500);
  }
});

// Sales Plan endpoints
app.get("/make-server-f9553289/sales-plan", async (c) => {
  try {
    const now = new Date();
    const monthKey = `sales-plan-${now.getFullYear()}-${now.getMonth() + 1}`;
    const plan = await kv.get(monthKey);
    return c.json({ plan: plan || 0 });
  } catch (error: any) {
    // Silently fail - database may be temporarily unavailable
    return c.json({ plan: 0 }, 200);
  }
});

app.post("/make-server-f9553289/sales-plan", async (c) => {
  try {
    const body = await c.req.json();
    const { plan } = body;
    
    if (typeof plan !== 'number' || plan < 0) {
      return c.json({ error: "Invalid plan value" }, 400);
    }

    const now = new Date();
    const monthKey = `sales-plan-${now.getFullYear()}-${now.getMonth() + 1}`;
    await kv.set(monthKey, plan);
    
    return c.json({ success: true });
  } catch (error: any) {
    console.error("Error saving sales plan:", error);
    return c.json({ error: error.message }, 500);
  }
});

// Pipeline management endpoints
app.get("/make-server-f9553289/pipelines", async (c) => {
  try {
    const pipelines = await kv.getByPrefix("pipeline:");
    return c.json(pipelines || []);
  } catch (error: any) {
    console.error("Error fetching pipelines:", error);
    return c.json({ error: error.message }, 500);
  }
});

app.post("/make-server-f9553289/pipelines", async (c) => {
  try {
    const body = await c.req.json();
    const { name, description, isDefault } = body;
    
    if (!name || !name.trim()) {
      return c.json({ error: "Pipeline name is required" }, 400);
    }

    const id = `pipeline-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const pipeline = {
      id,
      name: name.trim(),
      description: description?.trim() || '',
      isDefault: isDefault || false,
      createdAt: new Date().toISOString(),
      stages: [
        { id: `${id}-stage-1`, name: 'Новая', order: 1, color: '#3b82f6' },
        { id: `${id}-stage-2`, name: 'Квалификация', order: 2, color: '#f59e0b' },
        { id: `${id}-stage-3`, name: 'Переговоры', order: 3, color: '#8b5cf6' },
        { id: `${id}-stage-4`, name: 'Закрыта', order: 4, color: '#10b981' },
      ],
    };

    // If this should be default, unset other defaults
    if (isDefault) {
      const allPipelines = await kv.getByPrefix("pipeline:");
      for (const p of allPipelines) {
        if (p.isDefault) {
          await kv.set(`pipeline:${p.id}`, { ...p, isDefault: false });
        }
      }
    }

    await kv.set(`pipeline:${id}`, pipeline);
    return c.json({ success: true, pipeline });
  } catch (error: any) {
    console.error("Error creating pipeline:", error);
    return c.json({ error: error.message }, 500);
  }
});

// Product/Recipe Management
app.get("/make-server-f9553289/products", async (c) => {
  try {
    const products = await kv.getByPrefix("product:");
    return c.json(products || []);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

app.post("/make-server-f9553289/products", async (c) => {
  try {
    const body = await c.req.json();
    const { name, description, category } = body;
    
    if (!name) return c.json({ error: "Name is required" }, 400);

    const id = `product:${name.trim()}`; // Use name as ID for uniqueness (simple approach)
    const product = {
      id,
      name: name.trim(),
      description: description || '',
      category: category || '',
      createdAt: new Date().toISOString()
    };

    await kv.set(id, product);
    return c.json({ success: true, product });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

app.put("/make-server-f9553289/pipelines/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    
    const existingPipeline = await kv.get(`pipeline:${id}`);
    if (!existingPipeline) {
      return c.json({ error: "Pipeline not found" }, 404);
    }

    const updatedPipeline = {
      ...existingPipeline,
      ...body,
      id, // Ensure ID doesn't change
      updatedAt: new Date().toISOString(),
    };

    // If this should be default, unset other defaults
    if (body.isDefault) {
      const allPipelines = await kv.getByPrefix("pipeline:");
      for (const p of allPipelines) {
        if (p.id !== id && p.isDefault) {
          await kv.set(`pipeline:${p.id}`, { ...p, isDefault: false });
        }
      }
    }

    await kv.set(`pipeline:${id}`, updatedPipeline);
    return c.json({ success: true, pipeline: updatedPipeline });
  } catch (error: any) {
    console.error("Error updating pipeline:", error);
    return c.json({ error: error.message }, 500);
  }
});

app.delete("/make-server-f9553289/pipelines/:id", async (c) => {
  try {
    const id = c.req.param("id");
    
    const existingPipeline = await kv.get(`pipeline:${id}`);
    if (!existingPipeline) {
      return c.json({ error: "Pipeline not found" }, 404);
    }

    // Prevent deleting default pipeline
    if (existingPipeline.isDefault) {
      return c.json({ error: "Cannot delete default pipeline. Please set another pipeline as default first." }, 400);
    }

    await kv.del(`pipeline:${id}`);
    return c.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting pipeline:", error);
    return c.json({ error: error.message }, 500);
  }
});

// AI Insights endpoint (called by Dashboard)
app.post("/make-server-f9553289/ai-insights", async (c) => {
  try {
    const apiKey = env("OPENAI_API_KEY");
    if (!apiKey) {
      return c.json({ error: "OpenAI API key not configured" }, 500);
    }

    const body = await c.req.json();
    const { stats, hotDeals } = body;

    // Construct Prompt
    const prompt = `
      Ты опытный бизнес-аналитик и эксперт по продажам (РОП). Проанализируй следующие данные из CRM системы за выбранный период и дай 3 кратких, конкретных совета (insight) по улучшению продаж на русском языке.
      
      Статистика:
      - Выручка: ${new Intl.NumberFormat('uz-UZ', { style: 'currency', currency: 'UZS' }).format(stats?.revenue || 0)}
      - Активных сделок: ${stats?.activeDeals || 0}
      - Новых лидов: ${stats?.newLeads || 0}
      - Конверсия: ${stats?.conversion?.toFixed(1) || 0}%
      
      Топ сделок:
      ${hotDeals?.map((d: any) => `- ${d.title}: ${d.amount} (${d.status})`).join('\n') || 'Нет данных'}
      
      Формат ответа: JSON объект с полем "insights", содержащим текст ответа с использованием Markdown (жирный шрифт для акцентов).
      Пример: { "insights": "1. **Низк��я конверсия**: ... \\n2. **Работа с лидами**: ..." }
    `;

    // Call OpenAI
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini", 
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" } 
      }),
    });

    if (!response.ok) {
        return c.json({ error: "Failed to fetch analysis from OpenAI" }, 500);
    }

    const json = await response.json();
    const content = json.choices[0].message.content;
    
    let result;
    try {
       result = JSON.parse(content);
    } catch (e) {
       result = { insights: content };
    }

    // Fallback if AI didn't return JSON with insights key
    if (!result.insights && result.message) {
        result.insights = result.message;
    }

    return c.json(result);

  } catch (error: any) {
    console.error("AI Insights Error:", error);
    return c.json({ error: error.message || "Internal Server Error" }, 500);
  }
});

app.post("/make-server-f9553289/ai-analyze", async (c) => {
  try {
    const apiKey = env("OPENAI_API_KEY");
    if (!apiKey) {
      return c.json({ error: "OpenAI API key not configured" }, 500);
    }

    if (!env("DATABASE_URL")) {
        return c.json({ error: "DATABASE_URL is not configured" }, 500);
    }

    const db = createClient();

    // Fetch Data Summary
    const { data: deals, error } = await db
        .from('deals')
        .select('amount, status, created_at, stage_id, stages(name)');
    
    if (error) throw error;

    // Summarize Data
    const safeDeals = deals || [];
    const totalDeals = safeDeals.length;
    const totalAmount = safeDeals.reduce((sum, d) => sum + (d.amount || 0), 0);
    const wonDeals = safeDeals.filter(d => d.status === 'won').length;
    const lostDeals = safeDeals.filter(d => d.status === 'lost').length;
    const openDeals = safeDeals.filter(d => d.status === 'open').length;

    // Construct Prompt
    const prompt = `
      Ты опытный бизнес-аналитик и эксперт по продажам (РОП). Проанализируй следующие данные из CRM системы и дай 3 кратких, конкретных совета (insight) по улучшению продаж на русск��м языке.
      
      Данные:
      - Всего сделок: ${totalDeals}
      - Общая сумма в воронке (узбекские сомы): ${totalAmount.toLocaleString('uz-UZ')} UZS
      - Выиграно сделок: ${wonDeals}
      - Проиграно сделок: ${lostDeals}
      - Открытых сделок: ${openDeals}
      
      Формат ответа: JSON объект с полем "message", содержащим текст ответа с использованием Markdown (жирный шри��т для акцентов).
      Пример: { "message": "1. **Низкая конверсия**: ... \\n2. **Зависание сделок**: ..." }
    `;

    // Call OpenAI
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini", 
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" } 
      }),
    });

    if (!response.ok) {
        const text = await response.text();
        console.error("OpenAI API Error:", text);
        return c.json({ error: "Failed to fetch analysis from OpenAI" }, 500);
    }

    const json = await response.json();
    const content = json.choices[0].message.content;
    
    let result;
    try {
       result = JSON.parse(content);
    } catch (e) {
       result = { message: content };
    }

    return c.json(result);

  } catch (error: any) {
    console.error("AI Analysis Error:", error);
    return c.json({ error: error.message || "Internal Server Error" }, 500);
  }
});

// AI Chat endpoint
app.post("/make-server-f9553289/ai-chat", async (c) => {
  try {
    const apiKey = env("OPENAI_API_KEY");
    if (!apiKey) {
      return c.json({ error: "OpenAI API key not configured" }, 500);
    }

    if (!env("DATABASE_URL")) {
        return c.json({ error: "DATABASE_URL is not configured" }, 500);
    }

    const body = await c.req.json();
    const { messages, userId } = body;

    if (!messages || !Array.isArray(messages)) {
      return c.json({ error: "Invalid messages format" }, 400);
    }

    const db = createClient();

    // Fetch ALL CRM data for comprehensive AI context
    const { data: deals } = await db
        .from('deals')
        .select('id, amount, status, created_at, stage_id, stages(name), title, companies(name)')
        .order('created_at', { ascending: false });
    
    const { data: tasks } = await db
        .from('tasks')
        .select('id, title, priority, status, due_date, assigned_to')
        .order('due_date', { ascending: true });

    const { data: companies } = await db
        .from('companies')
        .select('id, name, industry, phone, email, created_at')
        .order('created_at', { ascending: false });

    const { data: contacts } = await db
        .from('contacts')
        .select('id, name, position, phone, email, company_id, companies(name)')
        .order('created_at', { ascending: false });

    const { data: leads } = await db
        .from('leads')
        .select('id, name, phone, status, source, created_at')
        .order('created_at', { ascending: false });

    const { data: pipelines } = await db
        .from('pipelines')
        .select('id, name, stages(id, name, order)')
        .order('created_at', { ascending: false });

    const { data: events } = await db
        .from('calendar_events')
        .select('id, title, start, end, type')
        .gte('start', new Date().toISOString())
        .order('start', { ascending: true })
        .limit(10);

    // Get sales plan
    const now = new Date();
    const monthKey = `sales-plan-${now.getFullYear()}-${now.getMonth() + 1}`;
    const salesPlan = await kv.get(monthKey);

    // Get production recipes
    const recipes = await kv.getByPrefix('recipe-');

    // Summarize Data for context
    const safeDeals = deals || [];
    const totalDeals = safeDeals.length;
    const totalAmount = safeDeals.reduce((sum, d) => sum + (d.amount || 0), 0);
    const wonDeals = safeDeals.filter(d => d.status === 'won').length;
    const lostDeals = safeDeals.filter(d => d.status === 'lost').length;
    const openDeals = safeDeals.filter(d => d.status === 'open').length;
    const avgDealSize = totalDeals > 0 ? Math.round(totalAmount / totalDeals) : 0;
    const conversionRate = (wonDeals + lostDeals) > 0 ? Math.round((wonDeals / (wonDeals + lostDeals)) * 100) : 0;

    // Detailed context for recent items
    const recentOpenDeals = safeDeals.filter(d => d.status === 'open').slice(0, 5).map(d => 
      `- ${d.title} (${d.companies?.name || 'Нет компании'}): ${d.amount?.toLocaleString('uz-UZ')} UZS, Этап: ${d.stages?.name || 'Неизвестно'}`
    ).join('\n') || "Нет открытых сделок";

    const safeTasks = tasks || [];
    const highPriorityTasks = safeTasks.filter(t => t.status !== 'completed' && t.priority === 'high').slice(0, 5).map(t =>
      `- [🔥] ${t.title} (Срок: ${t.due_date ? new Date(t.due_date).toLocaleDateString('ru-RU') : 'Нет'})`
    ).join('\n') || "Нет в��жных задач";

    const overdueTasks = safeTasks.filter(t => t.status !== 'completed' && t.due_date && new Date(t.due_date) < new Date()).length;
    const safeCompanies = companies || [];
    const totalCompanies = safeCompanies.length;

    // Construct Prompt with Smart Search
    const lastMessage = messages[messages.length - 1];
    let lastUserText = "";
    
    if (typeof lastMessage.content === 'string') {
        lastUserText = lastMessage.content;
    } else if (Array.isArray(lastMessage.content)) {
        // Handle OpenAI content array format
        const textPart = lastMessage.content.find((c: any) => c.type === 'text');
        if (textPart) {
            lastUserText = textPart.text;
        }
    }

    const searchTerms = lastUserText.toLowerCase().split(' ').filter((t: string) => t.length > 2);
    
    let foundCompaniesStr = "";
    if (searchTerms.length > 0) {
       const found = safeCompanies.filter(c => 
         searchTerms.some((term: string) => c.name.toLowerCase().includes(term))
       );
       if (found.length > 0) {
         foundCompaniesStr = found.map(c => 
           `- [НАЙДЕНО] ${c.name} (Тел: ${c.phone || 'нет'}, Email: ${c.email || 'нет'}, Индустрия: ${c.industry || 'нет'})`
         ).join('\n');
       }
    }

    const recentCompanies = safeCompanies.slice(0, 10).map(c => `- ${c.name}`).join('\n') || "NONE";
    const safeContacts = contacts || [];
    const totalContacts = safeContacts.length;
    const safeLeads = leads || [];
    const totalLeads = safeLeads.length;
    const newLeads = safeLeads.filter(l => l.status === 'new').length;
    const qualifiedLeads = safeLeads.filter(l => l.status === 'qualified').length;
    const recentLeads = safeLeads.slice(0, 5).map(l => `- ${l.name} (${l.phone})`).join('\n') || "NONE";
    const safePipelines = pipelines || [];
    const pipelinesList = safePipelines.map(p => `- ${p.name}`).join('\n') || "NONE";
    const safeEvents = events || [];
    const upcomingEvents = safeEvents.slice(0, 5).map(e => `- ${e.title}`).join('\n') || "NONE";
    const planData = salesPlan as any;
    const salesPlanSummary = planData ? `${planData.target || 0} / ${planData.actual || 0} UZS` : "NONE";
    const safeRecipes = recipes || [];
    const totalRecipes = safeRecipes.length;

    // System prompt with ALL CRM DATA - using external function
    const systemPrompt = generateSystemPrompt({
      totalDeals,
      totalAmount,
      wonDeals,
      lostDeals,
      openDeals,
      avgDealSize,
      conversionRate,
      recentOpenDeals,
      tasksLength: tasks?.length || 0,
      highPriorityTasks,
      overdueTasks,
      totalCompanies,
      recentCompanies,
      foundCompanies: foundCompaniesStr,
      totalContacts,
      totalLeads,
      newLeads,
      qualifiedLeads,
      recentLeads,
      pipelinesList,
      upcomingEvents,
      salesPlanSummary,
      totalRecipes
    });
    
    /* OLD PROMPT TEXT REMOVED - keeping for debugging */
    /*

    // Call OpenAI with conversation context ��ксперт по продажам и маркетингу, работающий как персональный консультант для узбекской CRM-системы. 

ТВОИ НАВЫКИ:
- Стратегическое планирование продаж и маркетинга
- Анализ воронки продаж и оптимизация конверсии
- Работа с лидами и управление сделками
- Прогнозирование выручки
- Разработка маркетинговых кампаний
- Управление клиентскими отношениями

ТЕКУЩИЕ ДАННЫЕ CRM:
- Всего сделок: ${totalDeals}
- Общая сумма в воронке: ${totalAmount.toLocaleString('uz-UZ')} UZS
- Выигран��: ${wonDeals} | Проигр��но: ${lostDeals} | Открыто: ${openDeals}
- Средний чек: ${avgDealSize.toLocaleString('uz-UZ')} UZS
- Конверсия: ${conversionRate}%
- Задач в систем��: ${tasks?.length || 0}

АКТУАЛЬНЫЕ СДЕЛКИ (Топ-5 новых):
${recentOpenDeals}

ВАЖНЫЕ ЗАДАЧИ:
${highPriorityTasks}

СТИЛЬ ОБЩЕНИЯ:
- Отвечай на русском языке профессионально, но ��ружелюбно
- Давай конкретные, применимые советы
- Используй эмодзи для визуальной структуры (📊 💰 🎯 ✅ ⚡)
- Структурируй ответы с заголовками и списками
- При анализе данных ссылайся на конкретные цифры
- Предлагай практические действия, которые можн�� выполни��ь в CRM

ВАЖНО: 
- Валюта - узбекские сомы (UZS)
- Фокус на B2B продажах
- Учитывай специфику узбекского рынка
- Ты умеешь анал����ировать ИЗОБРАЖЕНИЯ. Если пользователь прислал ��ото, проанализируй его.
    */
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages
        ],
        temperature: 0.8,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
        const text = await response.text();
        console.error("OpenAI API Error:", text);
        return c.json({ error: "Failed to get response from OpenAI" }, 500);
    }

    const json = await response.json();
    const content = json.choices[0].message.content;

    // Save chat history to kv_store
    if (userId) {
      const updatedMessages = [
        ...messages,
        { role: 'assistant', content, timestamp: new Date().toISOString() }
      ];
      
      await kv.set(`ai_chat_history_${userId}`, {
        messages: updatedMessages,
        lastUpdated: new Date().toISOString()
      });
    }

    return c.json({ message: content });

  } catch (error: any) {
    console.error("AI Chat Error:", error);
    return c.json({ error: error.message || "Internal Server Error" }, 500);
  }
});

// Signup Endpoint
app.post("/make-server-f9553289/signup", async (c) => {
  try {
    const body = await c.req.json();
    const { email, password, name } = body;
    
    if (!email || !password) {
      return c.json({ error: "Email and password are required" }, 400);
    }

    if (!env("DATABASE_URL")) {
        return c.json({ error: "DATABASE_URL is not configured" }, 500);
    }
    if (env("ALLOW_SELF_SIGNUP") !== "true") {
      return c.json({ error: "Self-signup is disabled" }, 403);
    }

    const db = createClient();

    const { data, error } = await db.auth.admin.createUser({
      email,
      password,
      user_metadata: { name: name || email.split('@')[0], role: "manager" },
      email_confirm: true // Automatically confirm email
    });

    if (error) throw error;

    return c.json({ user: data.user });
  } catch (error: any) {
    console.error("Signup Error:", error);
    return c.json({ error: error.message || "Signup failed" }, 500);
  }
});

// Upload Image Endpoint
app.post("/make-server-f9553289/upload", async (c) => {
  try {
    const body = await c.req.parseBody();
    const file = body['file'];

    if (!file || !(file instanceof File)) {
      return c.json({ error: "No file uploaded" }, 400);
    }

    if (!env("DATABASE_URL")) {
        return c.json({ error: "DATABASE_URL is not configured" }, 500);
    }

    const db = createClient();
    const bucketName = "make-f9553289-chat-images";

    // Ensure bucket exists
    const { data: buckets } = await db.storage.listBuckets();
    if (!buckets?.some(b => b.name === bucketName)) {
      await db.storage.createBucket(bucketName, { public: false });
    }

    // Upload
    const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '')}`;
    const { error: uploadError } = await db.storage
      .from(bucketName)
      .upload(fileName, file, {
        contentType: file.type,
        upsert: false
      });

    if (uploadError) throw uploadError;

    // Get Signed URL (valid for 1 year)
    const { data: signedData, error: signError } = await db.storage
      .from(bucketName)
      .createSignedUrl(fileName, 31536000); // 1 year in seconds

    if (signError) throw signError;

    return c.json({ url: signedData?.signedUrl });
  } catch (error: any) {
    console.error("Upload error:", error);
    return c.json({ error: error.message }, 500);
  }
});

// Get AI Chat History
app.get("/make-server-f9553289/ai-chat-history", async (c) => {
  try {
    const userId = c.req.query('userId');
    
    if (!userId) {
      return c.json({ error: "userId is required" }, 400);
    }

    const history = await kv.get(`ai_chat_history_${userId}`);
    
    return c.json({ 
      messages: history?.messages || [],
      lastUpdated: history?.lastUpdated || null
    });

  } catch (error: any) {
    console.error("Get AI Chat History Error:", error);
    return c.json({ error: error.message || "Internal Server Error" }, 500);
  }
});

// Clear AI Chat History
app.delete("/make-server-f9553289/ai-chat-history", async (c) => {
  try {
    const userId = c.req.query('userId');
    
    if (!userId) {
      return c.json({ error: "userId is required" }, 400);
    }

    await kv.del(`ai_chat_history_${userId}`);
    
    return c.json({ success: true });

  } catch (error: any) {
    console.error("Clear AI Chat History Error:", error);
    return c.json({ error: error.message || "Internal Server Error" }, 500);
  }
});

// Email Templates endpoints
app.get("/make-server-f9553289/email-templates", async (c) => {
  try {
    const userId = c.req.query('userId');
    
    if (!userId) {
      return c.json({ error: "userId is required" }, 400);
    }

    const data = await kv.get(`email_templates_${userId}`);
    
    return c.json({ 
      templates: data?.templates || []
    });

  } catch (error: any) {
    console.error("Get Email Templates Error:", error);
    return c.json({ error: error.message || "Internal Server Error" }, 500);
  }
});

app.post("/make-server-f9553289/email-templates", async (c) => {
  try {
    const body = await c.req.json();
    const { userId, templates } = body;
    
    if (!userId || !templates) {
      return c.json({ error: "userId and templates are required" }, 400);
    }

    await kv.set(`email_templates_${userId}`, {
      templates,
      lastUpdated: new Date().toISOString()
    });
    
    return c.json({ success: true });

  } catch (error: any) {
    console.error("Save Email Templates Error:", error);
    return c.json({ error: error.message || "Internal Server Error" }, 500);
  }
});

// Production Events Endpoints
app.get("/make-server-f9553289/production-events", async (c) => {
  try {
    const events = await kv.getByPrefix("production_event:");
    return c.json(events || []);
  } catch (error: any) {
    console.error("Error fetching production events:", error);
    return c.json({ error: error.message }, 500);
  }
});

  app.post("/make-server-f9553289/production-events", async (c) => {
    try {
      const body = await c.req.json();
      const { lineId, recipeId, amount, startDate, endDate, notes, status } = body;
      
      if (!lineId || !startDate || !endDate) {
        return c.json({ error: "Missing required fields" }, 400);
      }
  
      const id = body.id || `evt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const event = {
        id,
        lineId,
        recipeId, // Optional link to recipe
        amount,
        startDate,
        endDate,
        notes: notes || '',
        status: status || 'planned', // planned, in_progress, completed, issue
        updatedAt: new Date().toISOString()
      };
  
      await kv.set(`production_event:${id}`, event);
      return c.json({ success: true, event });
    } catch (error: any) {
      console.error("Error creating production event:", error);
      return c.json({ error: error.message }, 500);
    }
  });

app.delete("/make-server-f9553289/production-events/:id", async (c) => {
  try {
    const id = c.req.param("id");
    await kv.del(`production_event:${id}`);
    return c.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting production event:", error);
    return c.json({ error: error.message }, 500);
  }
});

// Production Event Payments
app.get("/make-server-f9553289/production-events/:id/payments", async (c) => {
  try {
    const eventId = c.req.param("id");
    const payments = await kv.getByPrefix(`production_payment:${eventId}:`);
    return c.json(payments || []);
  } catch (error: any) {
    console.error("Error fetching payments:", error);
    return c.json({ error: error.message }, 500);
  }
});

app.post("/make-server-f9553289/production-events/:id/payments", async (c) => {
  try {
    const eventId = c.req.param("id");
    const body = await c.req.json();
    const { amount, date, method, comment } = body;

    if (!amount || !date) {
      return c.json({ error: "Amount and date are required" }, 400);
    }

    const paymentId = `pay-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const payment = {
      id: paymentId,
      eventId,
      amount: parseFloat(amount),
      date,
      method: method || "transfer",
      comment: comment || "",
      createdAt: new Date().toISOString(),
    };

    await kv.set(`production_payment:${eventId}:${paymentId}`, payment);
    return c.json({ success: true, payment });
  } catch (error: any) {
    console.error("Error saving payment:", error);
    return c.json({ error: error.message }, 500);
  }
});

app.delete("/make-server-f9553289/production-events/:id/payments/:paymentId", async (c) => {
  try {
    const eventId = c.req.param("id");
    const paymentId = c.req.param("paymentId");
    await kv.del(`production_payment:${eventId}:${paymentId}`);
    return c.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting payment:", error);
    return c.json({ error: error.message }, 500);
  }
});

// Recipe Endpoints
app.get("/make-server-f9553289/recipes", async (c) => {
  try {
    const recipes = await kv.getByPrefix("recipe:");
    return c.json(recipes || []);
  } catch (error: any) {
    console.error("Error fetching recipes:", error);
    return c.json({ error: error.message }, 500);
  }
});

app.post("/make-server-f9553289/recipes", async (c) => {
  try {
    const body = await c.req.json();
    const id = body.id || `recipe-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const recipe = { ...body, id, updatedAt: new Date().toISOString() };
    await kv.set(`recipe:${id}`, recipe);
    return c.json(recipe);
  } catch (error: any) {
    console.error("Error saving recipe:", error);
    return c.json({ error: error.message }, 500);
  }
});

app.delete("/make-server-f9553289/recipes/:id", async (c) => {
  try {
    const id = c.req.param("id");
    // Handle both cases: ID with prefix (Telegram) and without (Legacy Manual)
    const key = id.startsWith("recipe:") ? id : `recipe:${id}`;
    await kv.del(key);
    return c.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting recipe:", error);
    return c.json({ error: error.message }, 500);
  }
});

// Email sending endpoint
app.post("/make-server-f9553289/send-email", async (c) => {
  const guard = await requireAdmin(c);
  if (!guard.ok) return guard.response;
  try {
    const body = await c.req.json();
    const { to, subject, message, dealTitle } = body;

    if (!to || !subject || !message) {
      return c.json({ error: "Missing required fields" }, 400);
    }

    const kvCreds = await kv.get("integration:resend");
    const resendApiKey = kvCreds?.apiKey || env("RESEND_API_KEY");
    
    if (!resendApiKey) {
      return c.json({ 
        error: "Email service not configured. Please add RESEND_API_KEY to environment variables.",
        hint: "Visit https://resend.com to get your API key"
      }, 500);
    }

    // Send email using Resend API
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: "CRM System <onboarding@resend.dev>", // Use verified domain in production
        to: [to],
        subject: subject,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #3b82f6;">${subject}</h2>
            ${dealTitle ? `<p style="color: #666;"><strong>Сделка:</strong> ${dealTitle}</p>` : ''}
            <div style="margin-top: 20px; line-height: 1.6;">
              ${message.replace(/\n/g, '<br>')}
            </div>
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
            <p style="color: #999; font-size: 12px;">
              Отправлено из CRM системы
            </p>
          </div>
        `,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Resend API Error:", errorText);
      return c.json({ error: "Failed to send email", details: errorText }, 500);
    }

    const result = await response.json();
    return c.json({ success: true, emailId: result.id });

  } catch (error: any) {
    console.error("Email sending error:", error);
    return c.json({ error: error.message || "Internal Server Error" }, 500);
  }
});

// Telegram Webhook Endpoint (PUBLIC - no auth required, Telegram can't send headers)
app.post("/make-server-f9553289/telegram-webhook", async (c) => {
  try {
    const expectedSecret = env("TELEGRAM_WEBHOOK_SECRET");
    if (expectedSecret) {
      const gotSecret =
        c.req.header("X-Telegram-Bot-Api-Secret-Token") ||
        c.req.header("x-telegram-bot-api-secret-token");
      if (!gotSecret || gotSecret !== expectedSecret) {
        return c.json({ error: "Unauthorized webhook source" }, 401);
      }
    }

    const body = await c.req.json();
    
    // Support various update types (messages, edits, channel posts)
    const msg = body.message || body.edited_message || body.channel_post || body.edited_channel_post;
    
    // Verify it's a message
    const messageText = msg.text || msg.caption || "";
    
    if (!msg || !messageText) {
      return c.json({ status: "ignored", reason: "no text or caption" });
    }

    // Quick Ping-Pong for debugging
    if (messageText === '/ping' || messageText === '/start') {
         const kvCreds = await kv.get("integration:telegram");
         const botToken = kvCreds?.botToken || env("TELEGRAM_BOT_TOKEN");
         if (botToken && msg.chat?.id) {
             await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                 method: 'POST',
                 headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify({
                     chat_id: msg.chat.id,
                     text: `🏓 Pong! Система работает.\nID чата: ${msg.chat.id}\nВерсия: 2.1`
                 })
             });
         }
         return c.json({ status: "ok", type: "ping" });
    }

    const sender = msg.from?.first_name || msg.from?.username || msg.chat?.title || "Unknown";
    const senderId = msg.from?.id || msg.chat?.id;
    const chatId = msg.chat?.id;
    const timestamp = new Date().toISOString();

    // Debug Logger
    const logDebug = async (status: string, reason: string, details: any = {}) => {
        try {
             const logs = await kv.get("system:webhook_logs") || [];
             logs.unshift({
                 id: Date.now().toString(),
                 timestamp: new Date().toISOString(),
                 sender,
                 message: messageText,
                 status,
                 reason,
                 details
             });
             // Keep logs manageable
             await kv.set("system:webhook_logs", logs.slice(0, 50));
        } catch(e) { console.error("Log error", e); }
    };

    let amount: number | null = null;
    let article: string | null = null;
    let unit = 'кг';

    const simpleRegex = /^(\d+(\.\d+)?)\s*(kg|кг)?$/i;
    const simpleMatch = messageText.trim().match(simpleRegex);

    if (simpleMatch) {
      amount = parseFloat(simpleMatch[1]);
    }

    if (!amount) {
        const apiKey = env("OPENAI_API_KEY");
        if (apiKey) {
            try {
                // Unified Smart Prompt for intent detection
                const systemPrompt = `You are an AI assistant for a rattan factory CRM. Analyze the message to determine if it is a **Production Log** or a **Product Recipe**.

1. **Production Log**: A worker reports produced quantity. 
   - Look for numbers indicating weight/quantity (e.g., "50", "50kg", "50.5").
   - Extract: "amount" (number), "article" (string, optional).
   - Set "type": "production".

2. **Product Recipe**: A technologist defines or describes a product specs.
   - Look for specific sections like "Основа" (Base), "Краска" (Dye), "Градус" (Temp), "Скорость" (Speed).
   - Structure usually has a header (Article) and lists of ingredients.
   - Extract: 
     - "article" (First line or product name)
     - "base" (Content under 'Основа')
     - "dye" (Content under 'Краска')
     - "temperature" (Content under 'Градус' or numbers like '200 200 190')
     - "screwSpeed" (Main screw speed)
     - "dyeSpeed" (Dye speed)
     - "winding" (Winding/Намотка info)
   - Set "type": "recipe".

Return JSON:
{
  "type": "production" | "recipe" | "unknown",
  "amount": number | null,
  "article": string | null,
  "base": string | null,
  "dye": string | null,
  "temperature": string | null,
  "screwSpeed": string | null,
  "dyeSpeed": string | null,
  "winding": string | null,
  "description": string | null
}`;

                const response = await fetch("https://api.openai.com/v1/chat/completions", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${apiKey}`,
                  },
                  body: JSON.stringify({
                    model: "gpt-4o-mini",
                    messages: [
                        { role: "system", content: systemPrompt },
                        { role: "user", content: messageText }
                    ],
                    response_format: { type: "json_object" }
                  }),
                });
                
                if (response.ok) {
                    const json = await response.json();
                    const content = JSON.parse(json.choices[0].message.content);
                    
                    // HANDLE RECIPE
                    if (content.type === 'recipe' && content.article) {
                         // Create unique ID for recipe (Idempotent using message ID)
                         const recipeId = (msg.message_id && msg.chat?.id) 
                            ? `recipe:tg_${msg.chat.id}_${msg.message_id}` 
                            : `recipe:${Date.now()}`;
                         
                         // Helper to convert objects to strings
                         const toString = (val: any): string => {
                             if (!val) return '';
                             if (typeof val === 'string') return val;
                             if (typeof val === 'object') {
                                 // Convert object to readable multi-line string
                                 return Object.entries(val)
                                     .map(([k, v]) => `${k}: ${v}`)
                                     .join('\n');
                             }
                             return String(val);
                         };
                         
                         await kv.set(recipeId, {
                             id: recipeId,
                             name: content.article.trim(),
                             description: content.description || '',
                             base: toString(content.base),
                             dye: toString(content.dye),
                             temperature: toString(content.temperature),
                             screwSpeed: toString(content.screwSpeed),
                             dyeSpeed: toString(content.dyeSpeed),
                             winding: toString(content.winding),
                             image: null,
                             updatedAt: new Date().toISOString(),
                             createdAt: new Date().toISOString(),
                             source: 'telegram_bot'
                         });
                         
                         const kvCreds = await kv.get("integration:telegram");
                         const botToken = kvCreds?.botToken || env("TELEGRAM_BOT_TOKEN");
                         if (botToken && chatId) {
                             await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                                 method: 'POST',
                                 headers: { 'Content-Type': 'application/json' },
                                 body: JSON.stringify({
                                     chat_id: chatId,
                                     text: `✨ Рецепт сохранен!\n��� Артикул: ${content.article}\n�� Основа: ${content.base ? 'Да' : 'Нет'}\n🎨 Краска: ${content.dye ? 'Да' : 'Нет'}`
                                 })
                             });
                         }
                         return c.json({ success: true, type: 'recipe', article: content.article });
                    }
                    
                    // HANDLE PRODUCTION
                    if (content.type === 'production' && content.amount && content.amount > 0) {
                        amount = content.amount;
                        article = content.article || null;
                    }
                } else {
                    console.error("OpenAI API Error:", await response.text());
                }
            } catch (e: any) {
                console.error("OpenAI parsing error:", e);
                await logDebug("error", "OpenAI Error", { error: e.message });
            }
        } else {
             await logDebug("error", "Missing OpenAI Key");
        }
    }
    
    if (amount && amount > 0) {
      const logId = (msg.message_id && msg.chat?.id) 
        ? `production_log:tg_${msg.chat.id}_${msg.message_id}` 
        : `production_log:${Date.now()}`;

      const logEntry = {
        id: logId,
        date: timestamp,
        user: sender,
        userId: senderId,
        amount: amount,
        article: article || '',
        originalMessage: messageText,
        status: 'pending_sync',
        unit: unit
      };

      await kv.set(logId, logEntry);
      console.log(`Logged production from Telegram: ${amount} kg (Art: ${article}) from ${sender}`);
      await logDebug("success", "Log Added", { amount, article });
      
      const kvCreds = await kv.get("integration:telegram");
      const botToken = kvCreds?.botToken || env("TELEGRAM_BOT_TOKEN");
      
      if (botToken && chatId) {
        try {
           const replyText = article 
             ? `✅ Записано: ${amount} кг (Арт: ${article})\nСпасибо, ${sender}!`
             : `✅ Записано: ${amount} кг\nСпасибо, ${sender}!`;

           await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({
               chat_id: chatId,
               text: replyText
             })
           });
        } catch (e) {
          console.error("Failed to reply to Telegram:", e);
        }
      }

      return c.json({ success: true });
    }

    await logDebug("ignored", "No amount found");
    return c.json({ status: "ignored", reason: "no amount found" });

  } catch (error: any) {
    console.error("Telegram Webhook Error:", error);
    return c.json({ error: error.message }, 500);
  }
});

// Get Production Logs
app.get("/make-server-f9553289/production-logs", async (c) => {
  try {
    let logs: any[] = [];
    try {
      logs = await kv.getByPrefix("production_log:");
    } catch (e) {
      console.error("KV lookup failed:", e);
      logs = [];
    }
    
    // Sort by date descending
    const sortedLogs = (logs || []).sort((a: any, b: any) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    return c.json(sortedLogs);
  } catch (error: any) {
    console.error("Error fetching production logs:", error);
    return c.json({ error: error.message }, 500);
  }
});

// Create Manual Production Log
app.post("/make-server-f9553289/production-logs", async (c) => {
  try {
    const body = await c.req.json();
    const { amount, article, date, note, warehouse, materialType, worker, twistedWorker } = body;
    
    if (amount === undefined || amount === null || isNaN(Number(amount))) {
      return c.json({ error: "Amount required" }, 400);
    }

    // --- SNAPSHOT RATES LOGIC ---
    const employees = await kv.getByPrefix("employee:") || [];
    const globalRates = (await kv.get("settings:rates")) || { winding: 1000, twisting: 1500 };

    let rateSnapshotWinding = null;
    let rateSnapshotTwisting = null;

    if (worker) {
        const emp = employees.find((e: any) => e.name.toLowerCase() === worker.toLowerCase());
        rateSnapshotWinding = (emp && emp.windingRate) ? parseFloat(emp.windingRate) : parseFloat(globalRates.winding);
    }

    if (twistedWorker) {
        const emp = employees.find((e: any) => e.name.toLowerCase() === twistedWorker.toLowerCase());
        rateSnapshotTwisting = (emp && emp.twistingRate) ? parseFloat(emp.twistingRate) : parseFloat(globalRates.twisting);
    }
    // ----------------------------

    const logId = `production_log:${Date.now()}`;
    const logEntry = {
      id: logId,
      date: date || new Date().toISOString(),
      user: "Администратор (Ручной ввод)",
      userId: "manual",
      amount: parseFloat(amount),
      article: article || '',
      originalMessage: note || "Ручной ввод",
      status: 'pending_sync',
      unit: 'кг',
      warehouse: warehouse || 'AIKO',
      materialType: materialType || 'Искусстве��ный ротанг',
      worker: worker || '',
      twistedWorker: twistedWorker || '',
      rateSnapshotWinding,
      rateSnapshotTwisting
    };

    await kv.set(logId, logEntry);
    return c.json({ success: true, log: logEntry });

  } catch (error: any) {
    console.error("Error creating manual log:", error);
    return c.json({ error: error.message }, 500);
  }
});

// Update Production Log
app.put("/make-server-f9553289/production-logs/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const { amount, article, date, note, warehouse, materialType, worker, twistedWorker } = body;

    const existing = await kv.get(id);
    if (!existing) {
        return c.json({ error: "Log not found" }, 404);
    }

    // --- SNAPSHOT RATES LOGIC (Re-calculate on update) ---
    const employees = await kv.getByPrefix("employee:") || [];
    const globalRates = (await kv.get("settings:rates")) || { winding: 1000, twisting: 1500 };

    let rateSnapshotWinding = existing.rateSnapshotWinding;
    let rateSnapshotTwisting = existing.rateSnapshotTwisting;

    // Only update snapshot if worker changed OR if it didn't exist before (migration)
    // Actually, if we are editing, let's refresh the rate to the current one for the assigned worker.
    // This allows "fixing" a rate by updating the log.
    
    const newWorker = worker !== undefined ? worker : existing.worker;
    const newTwistedWorker = twistedWorker !== undefined ? twistedWorker : existing.twistedWorker;

    if (newWorker) {
        const emp = employees.find((e: any) => e.name.toLowerCase() === newWorker.toLowerCase());
        rateSnapshotWinding = (emp && emp.windingRate) ? parseFloat(emp.windingRate) : parseFloat(globalRates.winding);
    } else {
        rateSnapshotWinding = null;
    }

    if (newTwistedWorker) {
        const emp = employees.find((e: any) => e.name.toLowerCase() === newTwistedWorker.toLowerCase());
        rateSnapshotTwisting = (emp && emp.twistingRate) ? parseFloat(emp.twistingRate) : parseFloat(globalRates.twisting);
    } else {
        rateSnapshotTwisting = null;
    }
    // ----------------------------

    const updatedLog = {
        ...existing,
        amount: parseFloat(amount) || existing.amount,
        article: article || '',
        date: date || existing.date,
        originalMessage: note || existing.originalMessage,
        warehouse: warehouse || existing.warehouse,
        materialType: materialType || existing.materialType,
        worker: newWorker,
        twistedWorker: newTwistedWorker,
        rateSnapshotWinding,
        rateSnapshotTwisting,
        user: existing.user
    };

    await kv.set(id, updatedLog);
    return c.json({ success: true, log: updatedLog });

  } catch (error: any) {
    console.error("Error updating log:", error);
    return c.json({ error: error.message }, 500);
  }
});

// Delete Production Log
app.delete("/make-server-f9553289/production-logs/:id", async (c) => {
  try {
    const id = c.req.param("id");
    await kv.del(id);
    return c.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting log:", error);
    return c.json({ error: error.message }, 500);
  }
});

// Get Stock Transaction History by Article
app.get("/make-server-f9553289/stock-history/:article", async (c) => {
  try {
    const article = decodeURIComponent(c.req.param("article"));
    const warehouse = c.req.query("warehouse") || null;
    
    const transactions: any[] = [];
    
    // 1. Get all production logs (ПРИХОДЫ - positive amounts)
    const allLogs = await kv.getByPrefix("production_log:");
    (allLogs || []).forEach((log: any) => {
      const matchesArticle = log.article && log.article.toLowerCase() === article.toLowerCase();
      const matchesWarehouse = !warehouse || log.warehouse === warehouse;
      
      if (matchesArticle && matchesWarehouse) {
        transactions.push({
          id: log.id,
          date: log.date,
          amount: log.amount,
          type: log.amount > 0 ? 'in' : 'out',
          note: log.originalMessage || '',
          warehouse: log.warehouse,
          worker: log.worker || '',
          user: log.user || 'Unknown',
          source: 'production_log'
        });
      }
    });
    
    // 2. Get all shipments (ОТГРУЗКИ - negative amounts)
    const allShipments = await kv.getByPrefix("shipment:");
    (allShipments || []).forEach((shipment: any) => {
      if (shipment.status === 'completed') {
        const matchesWarehouse = !warehouse || shipment.warehouse === warehouse;
        
        if (matchesWarehouse && shipment.items) {
          shipment.items.forEach((item: any) => {
            const matchesArticle = item.article && item.article.toLowerCase() === article.toLowerCase();
            
            if (matchesArticle) {
              const weight = parseFloat(item.weight) || 0;
              transactions.push({
                id: `${shipment.id}_${item.id}`,
                date: item.date || shipment.date,
                amount: -weight, // Negative for outgoing
                type: 'out',
                note: shipment.note || 'Отгрузка',
                warehouse: shipment.warehouse,
                worker: '',
                user: 'Отгрузка',
                source: 'shipment'
              });
            }
          });
        }
      }
    });
    
    // 3. Sort all transactions by date (oldest first for balance calculation)
    const sortedTransactions = transactions.sort((a: any, b: any) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    
    // 4. Calculate running balance
    let balance = 0;
    const transactionsWithBalance = sortedTransactions.map((transaction: any) => {
      balance += transaction.amount;
      return {
        ...transaction,
        balance: balance
      };
    });
    
    // 5. Reverse to show newest first
    transactionsWithBalance.reverse();
    
    return c.json(transactionsWithBalance);
  } catch (error: any) {
    console.error("Error fetching stock history:", error);
    return c.json({ error: error.message }, 500);
  }
});

// Get Webhook Debug Logs
app.get("/make-server-f9553289/debug/logs", async (c) => {
  const guard = await requireAdmin(c);
  if (!guard.ok) return guard.response;
  try {
    const logs = await kv.get("system:webhook_logs") || [];

    // Get Telegram Webhook Info
    let webhookInfo = null;
    const kvCreds = await kv.get("integration:telegram");
    const botToken = kvCreds?.botToken || env("TELEGRAM_BOT_TOKEN");
    
    if (botToken) {
        try {
            const res = await fetch(`https://api.telegram.org/bot${botToken}/getWebhookInfo`);
            const data = await res.json();
            webhookInfo = data.result;
        } catch (e: any) {
            webhookInfo = { error: e.message };
        }
    } else {
        webhookInfo = { error: "No bot token found in KV or ENV" };
    }

    const apiBase = (env("PUBLIC_BASE_URL") || "http://localhost:4000").replace(/\/$/, "");
    const expectedUrl = `${apiBase}/make-server-f9553289/telegram-webhook`;

    return c.json({ 
        logs, 
        webhookInfo, 
        expectedUrl,
        envCheck: {
            hasJwtSecret: !!env("JWT_SECRET"),
            hasBotToken: !!botToken,
        }
    });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Fix Webhook Endpoint
app.post("/make-server-f9553289/debug/fix-webhook", async (c) => {
  const guard = await requireAdmin(c);
  if (!guard.ok) return guard.response;
  try {
    const kvCreds = await kv.get("integration:telegram");
    const botToken = kvCreds?.botToken || env("TELEGRAM_BOT_TOKEN");
    
    if (!botToken) {
      return c.json({ error: "Bot token not found. Please connect the bot in Settings." }, 404);
    }

    const apiBase = (env("PUBLIC_BASE_URL") || "http://localhost:4000").replace(/\/$/, "");
    const webhookUrl = `${apiBase}/make-server-f9553289/telegram-webhook`;
    console.log(`Force fixing Telegram Webhook to: ${webhookUrl}`);

    const webhookRes = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: webhookUrl,
          ...(env("TELEGRAM_WEBHOOK_SECRET")
            ? { secret_token: env("TELEGRAM_WEBHOOK_SECRET") }
            : {}),
        })
    });
    
    const data = await webhookRes.json();
    return c.json(data);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Get Integration Status
app.get("/make-server-f9553289/integrations/status", async (c) => {
  const guard = await requireAdmin(c);
  if (!guard.ok) return guard.response;
  const googleKv = await kv.get("integration:google");
  const telegramKv = await kv.get("integration:telegram");
  const resendKv = await kv.get("integration:resend");

  const googleDisabled = await kv.get("integration_disabled:google");
  const telegramDisabled = await kv.get("integration_disabled:telegram");
  const resendDisabled = await kv.get("integration_disabled:resend");

  const google = !googleDisabled && !!(
    googleKv ||
    (env("GOOGLE_SERVICE_ACCOUNT_EMAIL") &&
    env("GOOGLE_PRIVATE_KEY") &&
    env("GOOGLE_SHEET_ID"))
  );

  const telegram = !telegramDisabled && !!(telegramKv?.token || env("TELEGRAM_BOT_TOKEN"));
  const resend = !resendDisabled && !!(resendKv?.apiKey || env("RESEND_API_KEY"));

  return c.json({ google, telegram, resend });
});

// Save Integration Credentials
app.post("/make-server-f9553289/integrations", async (c) => {
  const guard = await requireAdmin(c);
  if (!guard.ok) return guard.response;
  try {
    const body = await c.req.json();
    const { type, credentials } = body;

    if (!type || !credentials) {
      return c.json({ error: "Missing type or credentials" }, 400);
    }

    // Special logic for Telegram: Set Webhook automatically
    if (type === 'telegram') {
        const botToken = credentials.botToken || credentials.token;
        if (botToken) {
             const apiBase = (env("PUBLIC_BASE_URL") || "http://localhost:4000").replace(/\/$/, "");
             const webhookUrl = `${apiBase}/make-server-f9553289/telegram-webhook`;
             
             console.log(`Setting Telegram Webhook to: ${webhookUrl}`);
             
             const webhookRes = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
                 method: 'POST',
                 headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify({
                   url: webhookUrl,
                   ...(env("TELEGRAM_WEBHOOK_SECRET")
                     ? { secret_token: env("TELEGRAM_WEBHOOK_SECRET") }
                     : {}),
                 })
             });
             
             const webhookData = await webhookRes.json();
             
             if (!webhookData.ok) {
                 console.error("Telegram Webhook Error:", webhookData);
                 return c.json({ error: `Failed to set webhook: ${webhookData.description}` }, 400);
             }
        }
    }

    await kv.set(`integration:${type}`, credentials);
    await kv.del(`integration_disabled:${type}`);
    return c.json({ success: true });
  } catch (error: any) {
    console.error("Error saving integration:", error);
    return c.json({ error: error.message }, 500);
  }
});

// Delete Integration
app.delete("/make-server-f9553289/integrations/:type", async (c) => {
  const guard = await requireAdmin(c);
  if (!guard.ok) return guard.response;
  try {
    const type = c.req.param("type");
    await kv.del(`integration:${type}`);
    await kv.set(`integration_disabled:${type}`, true);
    return c.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting integration:", error);
    return c.json({ error: error.message }, 500);
  }
});

// Notification Settings
app.get("/make-server-f9553289/notifications/settings", async (c) => {
  try {
    const settings = await kv.get("settings:notifications");
    return c.json(settings || {
      email: true,
      push: true,
      deals: true,
      tasks: true
    });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

app.post("/make-server-f9553289/notifications/settings", async (c) => {
  try {
    const body = await c.req.json();
    await kv.set("settings:notifications", body);
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Regional Settings
app.get("/make-server-f9553289/regional-settings", async (c) => {
  try {
    const settings = await kv.get("settings:regional");
    return c.json(settings || {
      currency: "UZS",
      timezone: "Asia/Tashkent",
      dateFormat: "DD.MM.YYYY"
    });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

app.post("/make-server-f9553289/regional-settings", async (c) => {
  try {
    const body = await c.req.json();
    await kv.set("settings:regional", body);
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Get Clients
app.get("/make-server-f9553289/clients", async (c) => {
  try {
    const clients = await kv.getByPrefix("client:");
    return c.json(clients || []);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Add Client
app.post("/make-server-f9553289/clients", async (c) => {
  try {
    const body = await c.req.json();
    const { name, phone, email, notes } = body;
    
    if (!name) return c.json({ error: "Name is required" }, 400);

    if (!env("DATABASE_URL")) {
      return c.json({ error: "DATABASE_URL is not configured" }, 500);
    }

    const db = createClient();

    // Create a corresponding company row for linking with deals
    const { data: company, error: companyError } = await db
      .from('companies')
      .insert([{
        name,
        phone: phone || '',
        email: email || '',
        status: 'active'
      }])
      .select('id')
      .single();

    if (companyError) {
      console.error("Error creating company for client:", companyError);
      return c.json({ error: "Failed to create company link" }, 500);
    }

    const id = `client:${Date.now()}`;
    const newClient = {
      id,
      name,
      phone: phone || '',
      email: email || '',
      notes: notes || '',
      company_id: company.id, // Link to companies row
      createdAt: new Date().toISOString()
    };

    await kv.set(id, newClient);
    return c.json({ success: true, client: newClient });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Update Client
app.put("/make-server-f9553289/clients/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    
    const existing = await kv.get(id);
    if (!existing) return c.json({ error: "Client not found" }, 404);

    // Update corresponding company row if it exists
    if (existing.company_id) {
      if (env("DATABASE_URL")) {
        const db = createClient();
        
        await db
          .from('companies')
          .update({
            name: body.name || existing.name,
            phone: body.phone || existing.phone || '',
            email: body.email || existing.email || ''
          })
          .eq('id', existing.company_id);
      }
    }

    const updated = { ...existing, ...body };
    await kv.set(id, updated);
    
    return c.json({ success: true, client: updated });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Delete Client
app.delete("/make-server-f9553289/clients/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const existing = await kv.get(id);
    
    // Note: We don't delete the company row to preserve data integrity
    // Deals linked to this company will remain valid
    
    await kv.del(id);
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// ============= NOTIFICATIONS SYSTEM =============

// Get all notifications
app.get("/make-server-f9553289/notifications", async (c) => {
  try {
    const notifications = await kv.getByPrefix("notification:");
    // Sort by created date (newest first)
    const sorted = (notifications || []).sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    return c.json(sorted);
  } catch (error: any) {
    console.error("Error fetching notifications:", error);
    return c.json({ error: error.message }, 500);
  }
});

// Create notification
app.post("/make-server-f9553289/notifications", async (c) => {
  try {
    const body = await c.req.json();
    const { type, title, message, priority, entityType, entityId, actionUrl } = body;
    
    const id = `notification:${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const notification = {
      id,
      type: type || 'info', // info, warning, success, error
      title: title || 'Уведомление',
      message: message || '',
      priority: priority || 'medium', // low, medium, high
      entityType: entityType || null, // deal, task, client
      entityId: entityId || null,
      actionUrl: actionUrl || null,
      isRead: false,
      createdAt: new Date().toISOString()
    };
    
    await kv.set(id, notification);
    return c.json({ success: true, notification });
  } catch (error: any) {
    console.error("Error creating notification:", error);
    return c.json({ error: error.message }, 500);
  }
});

// Mark notification as read
app.put("/make-server-f9553289/notifications/:id/read", async (c) => {
  try {
    const id = c.req.param("id");
    const notification = await kv.get(id);
    
    if (!notification) {
      return c.json({ error: "Notification not found" }, 404);
    }
    
    const updated = { ...notification, isRead: true };
    await kv.set(id, updated);
    
    return c.json({ success: true, notification: updated });
  } catch (error: any) {
    console.error("Error marking notification as read:", error);
    return c.json({ error: error.message }, 500);
  }
});

// Mark all notifications as read
app.put("/make-server-f9553289/notifications/read-all", async (c) => {
  try {
    const notifications = await kv.getByPrefix("notification:");
    
    for (const notif of notifications) {
      if (!notif.isRead) {
        await kv.set(notif.id, { ...notif, isRead: true });
      }
    }
    
    return c.json({ success: true, count: notifications.length });
  } catch (error: any) {
    console.error("Error marking all notifications as read:", error);
    return c.json({ error: error.message }, 500);
  }
});

// Delete notification
app.delete("/make-server-f9553289/notifications/:id", async (c) => {
  try {
    const id = c.req.param("id");
    await kv.del(id);
    return c.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting notification:", error);
    return c.json({ error: error.message }, 500);
  }
});

// Generate automatic notifications (called by cron or manually)
app.post("/make-server-f9553289/notifications/generate", async (c) => {
  try {
    if (!env("DATABASE_URL")) {
      return c.json({ error: "DATABASE_URL is not configured" }, 500);
    }

    const db = createClient();
    const notifications = [];

    // Load Automation Settings
    const settings = (await kv.get("settings:automation")) || {};
    const { stalledNotifications } = settings;

    // 1. Check for stale deals (no activity for 7+ days)
    // ONLY IF ENABLED IN SETTINGS
    if (stalledNotifications) {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        
        const { data: staleDeals } = await db
          .from('deals')
          .select('id, title, created_at')
          .eq('status', 'open')
          .lte('created_at', sevenDaysAgo.toISOString());
        
        for (const deal of (staleDeals || [])) {
          const notifId = `notification:stale-deal-${deal.id}`;
          
          // Check if notification already exists (with error handling)
          let existing = null;
          try {
            existing = await kv.get(notifId);
          } catch (e) {
            console.error(`Error checking existing notification for deal ${deal.id}:`, e);
            // Continue - assume it doesn't exist if we can't check
          }
          
          // Only create if doesn't exist
          if (!existing) {
            const notification = {
              id: notifId,
              type: 'warning',
              title: 'Сделка требует внимания',
              message: `Сделка "${deal.title}" без движения более 7 дней`,
              priority: 'high',
              entityType: 'deal',
              entityId: deal.id,
              actionUrl: '/deals',
              isRead: false,
              createdAt: new Date().toISOString()
            };
            
            await kv.set(notifId, notification);
            notifications.push(notification);

            // Auto-create task for stale deal (only if notification is generated)
            try {
              await db.from('tasks').insert({
                  title: `Связаться с клиентом: ${deal.title}`,
                  description: `Автоматическая задача: Сделка без движения более 7 дней.`,
                  status: 'planned',
                  priority: 'high',
                  type: 'call',
                  due_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                  deal_id: deal.id
              });
            } catch (e) {
              console.error("Failed to auto-create task for stale deal:", e);
            }
          }
        }
    }

    // 2. Check for inactive clients (no purchases for 30+ days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const { data: allDeals } = await db
      .from('deals')
      .select('company_id, created_at, companies(name)')
      .eq('status', 'won');
    
    // Group by company and find last purchase date
    const clientLastPurchase = new Map();
    (allDeals || []).forEach(deal => {
      if (deal.company_id) {
        const current = clientLastPurchase.get(deal.company_id);
        if (!current || new Date(deal.created_at) > new Date(current.date)) {
          clientLastPurchase.set(deal.company_id, {
            date: deal.created_at,
            name: deal.companies?.name
          });
        }
      }
    });
    
    for (const [companyId, data] of clientLastPurchase.entries()) {
      if (new Date(data.date) < thirtyDaysAgo) {
        const notifId = `notification:inactive-client-${companyId}`;
        
        // Check if notification already exists (with error handling)
        let existing = null;
        try {
          existing = await kv.get(notifId);
        } catch (e) {
          console.error(`Error checking existing notification for client ${companyId}:`, e);
          // Continue - assume it doesn't exist if we can't check
        }
        
        if (!existing) {
          const notification = {
            id: notifId,
            type: 'info',
            title: 'Клиент неактивен',
            message: `Клиент "${data.name}" не совершал покупок более 30 дней`,
            priority: 'medium',
            entityType: 'client',
            entityId: companyId,
            actionUrl: '/database',
            isRead: false,
            createdAt: new Date().toISOString()
          };
          
          await kv.set(notifId, notification);
          notifications.push(notification);

          // Auto-create task for inactive client
          try {
             await db.from('tasks').insert({
                title: `Вернуть клиента: ${data.name}`,
                description: `Клиент не совершал покупок более 30 дней. Последняя покупка: ${new Date(data.date).toLocaleDateString()}`,
                status: 'planned',
                priority: 'medium',
                type: 'call',
                due_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
             });
          } catch (e) {
            console.error("Failed to auto-create task for inactive client:", e);
          }
        }
      }
    }

    // 3. Check for overdue tasks
    const now = new Date();
    const { data: overdueTasks } = await db
      .from('tasks')
      .select('id, title, due_date')
      .eq('status', 'planned')
      .lt('due_date', now.toISOString());
    
    for (const task of (overdueTasks || [])) {
      const notifId = `notification:overdue-task-${task.id}`;
      
      // Check if notification already exists (with error handling)
      let existing = null;
      try {
        existing = await kv.get(notifId);
      } catch (e) {
        console.error(`Error checking existing notification for task ${task.id}:`, e);
        // Continue - assume it doesn't exist if we can't check
      }
      
      if (!existing) {
        const notification = {
          id: notifId,
          type: 'error',
          title: 'Задача просрочена',
          message: `Задача "${task.title}" не выполнена в срок`,
          priority: 'high',
          entityType: 'task',
          entityId: task.id,
          actionUrl: '/tasks',
          isRead: false,
          createdAt: new Date().toISOString()
        };
        
        await kv.set(notifId, notification);
        notifications.push(notification);
      }
    }

    return c.json({ 
      success: true, 
      generated: notifications.length,
      notifications 
    });
  } catch (error: any) {
    console.error("Error generating notifications:", error);
    return c.json({ error: error.message }, 500);
  }
});

// Get Employees
app.get("/make-server-f9553289/employees", async (c) => {
  try {
    const employees = await kv.getByPrefix("employee:");
    return c.json(employees || []);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Add Employee
app.post("/make-server-f9553289/employees", async (c) => {
  try {
    const { name, hourlyRate, windingRate, twistingRate, role, fixedSalary } = await c.req.json();
    if (!name) return c.json({ error: "Name required" }, 400);

    const id = `employee:${Date.now()}`;
    const employee = { 
      id, 
      name, 
      role: role || 'master',
      fixedSalary: fixedSalary ? parseFloat(fixedSalary) : null,
      hourlyRate: parseFloat(hourlyRate) || 0,
      windingRate: windingRate ? parseFloat(windingRate) : null,
      twistingRate: twistingRate ? parseFloat(twistingRate) : null,
      active: true 
    };
    await kv.set(id, employee);
    
    return c.json({ success: true, employee });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Update Employee
app.put("/make-server-f9553289/employees/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const { name, hourlyRate, windingRate, twistingRate, role, fixedSalary } = await c.req.json();
    
    const existing = await kv.get(id);
    if (!existing) return c.json({ error: "Employee not found" }, 404);

    const updated = {
        ...existing,
        name: name || existing.name,
        role: role !== undefined ? role : (existing.role || 'master'),
        fixedSalary: fixedSalary !== undefined ? parseFloat(fixedSalary) : existing.fixedSalary,
        hourlyRate: hourlyRate !== undefined ? parseFloat(hourlyRate) : existing.hourlyRate,
        windingRate: windingRate !== undefined ? (windingRate === "" ? null : parseFloat(windingRate)) : existing.windingRate,
        twistingRate: twistingRate !== undefined ? (twistingRate === "" ? null : parseFloat(twistingRate)) : existing.twistingRate,
    };

    await kv.set(id, updated);
    return c.json({ success: true, employee: updated });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Delete Employee
app.delete("/make-server-f9553289/employees/:id", async (c) => {
  try {
    const id = c.req.param("id");
    await kv.del(id);
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// ============= TIMESHEET SYSTEM =============

app.get("/make-server-f9553289/timesheets", async (c) => {
  try {
    const sheets = await kv.getByPrefix("timesheet:");
    return c.json(sheets || []);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

app.post("/make-server-f9553289/timesheets", async (c) => {
  try {
    const body = await c.req.json();
    const { employeeId, date, hours, rate } = body;
    
    if (!employeeId || !date || hours === undefined) {
      return c.json({ error: "Missing required fields" }, 400);
    }

    const id = `timesheet:${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    const entry = {
      id,
      employeeId,
      date,
      hours: parseFloat(hours),
      rate: parseFloat(rate) || 0,
      createdAt: new Date().toISOString()
    };
    
    await kv.set(id, entry);
    return c.json({ success: true, entry });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

app.delete("/make-server-f9553289/timesheets/:id", async (c) => {
  try {
    const id = c.req.param("id");
    // Ensure key has prefix
    const key = id.startsWith("timesheet:") ? id : `timesheet:${id}`;
    await kv.del(key);
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});


// Sync to Google Sheets
app.post("/make-server-f9553289/sync-google-sheets", async (c) => {
  try {
    const sheetId = env("GOOGLE_SHEET_ID");
    const email = env("GOOGLE_SERVICE_ACCOUNT_EMAIL");
    const key = env("GOOGLE_PRIVATE_KEY");

    if (!sheetId || !email || !key) {
      return c.json({ error: "Google Integration not configured" }, 400);
    }

    // Authenticate using jose (manual JWT flow)
    const privateKey = await importPKCS8(key.replace(/\\n/g, '\n'), 'RS256');
    const jwt = await new SignJWT({
        scope: 'https://www.googleapis.com/auth/spreadsheets'
    })
      .setProtectedHeader({ alg: 'RS256' })
      .setIssuer(email)
      .setSubject(email)
      .setAudience('https://oauth2.googleapis.com/token')
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(privateKey);

    // Get Access Token
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt
      })
    });

    if (!tokenRes.ok) {
        throw new Error(`Auth failed: ${await tokenRes.text()}`);
    }
    const { access_token } = await tokenRes.json();


    // Get Pending Logs
    let logs: any[] = [];
    try {
        logs = await kv.getByPrefix("production_log:");
    } catch(e) { console.error(e); }

    const pendingLogs = (logs || []).filter((l: any) => l.status === 'pending_sync');

    if (pendingLogs.length === 0) {
        return c.json({ success: true, synced: 0, message: "No pending logs" });
    }

    // Sort by date ascending
    pendingLogs.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Prepare rows
    const values = pendingLogs.map((log: any) => [
        new Date(log.date).toLocaleDateString("ru-RU") + " " + new Date(log.date).toLocaleTimeString("ru-RU"),
        log.warehouse || "AIKO",
        log.article || "",
        log.amount,
        log.unit || "кг",
        log.worker || "",
        log.twistedWorker || "",
        log.user || "Unknown",
        log.originalMessage || ""
    ]);

    // Append to Sheet "Отчеты"
    const appendToSheet = async (rangeName: string) => {
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${rangeName}:append?valueInputOption=USER_ENTERED`;
        const res = await fetch(url, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${access_token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ values })
        });
        if (!res.ok) throw new Error(await res.text());
        return res.json();
    };

    try {
        await appendToSheet("Отчеты!A:I");
    } catch (e: any) {
        console.warn("Failed to append to 'Отчеты', trying 'Лист1'", e.message);
        try {
             await appendToSheet("Лист1!A:I");
        } catch (e2: any) {
             console.warn("Failed to append to 'Лист1', trying 'Sheet1'", e2.message);
             try {
                await appendToSheet("Sheet1!A:I");
             } catch (e3) {
                console.error("All sheet names failed. Aborting sync.", e3);
                throw new Error("Failed to append to Google Sheets (Tried: Отчеты, Лист1, Sheet1). Check Sheet Name and Permissions.");
             }
        }
    }

    // Mark as Synced
    let updateCount = 0;
    for (const log of pendingLogs) {
        try {
            const updated = { ...log, status: 'synced' };
            await kv.set(log.id, updated);
            updateCount++;
        } catch (e) {
            console.error(`Failed to update status for log ${log.id}`, e);
        }
    }

    return c.json({ success: true, synced: updateCount });

  } catch (error: any) {
    console.error("Google Sync Error:", error);
    return c.json({ error: error.message }, 500);
  }
});

// Get Webhook Logs (Debug)
app.get("/make-server-f9553289/system/webhook-logs", async (c) => {
  return c.json(await kv.get("system:webhook_logs") || []);
});

// --- INVENTORY & DEAL ITEMS ---

// Save items for a deal
app.post("/make-server-f9553289/deal-items", async (c) => {
  try {
    const body = await c.req.json();
    const { dealId, items } = body; // items: [{ article: string, quantity: number, price: number }]
    
    if (!dealId) {
      return c.json({ error: "dealId is required" }, 400);
    }

    await kv.set(`deal_items:${dealId}`, items || []);
    return c.json({ success: true });
  } catch (error: any) {
    console.error("Error saving deal items:", error);
    return c.json({ error: error.message }, 500);
  }
});

// Get items for a deal
app.get("/make-server-f9553289/deal-items/:dealId", async (c) => {
  try {
    const dealId = c.req.param("dealId");
    const items = await kv.get(`deal_items:${dealId}`);
    return c.json(items || []);
  } catch (error: any) {
    console.error("Error fetching deal items:", error);
    return c.json({ error: error.message }, 500);
  }
});

// --- PRODUCTION ORDERS (linked to Deals) ---

// Get all production orders — synthesised from ALL deal_items in KV + Postgres deals
app.get("/make-server-f9553289/production-orders", async (c) => {
  try {
    // 1. Grab any manually saved prod-order entries (legacy metadata)
    let manualOrders: any[] = [];
    try { manualOrders = await kv.getByPrefix("prod-order:"); } catch (e) { /* ignore */ }

    const manualMap: Record<string, any> = {};
    for (const o of manualOrders) {
      if (o?.dealId) manualMap[o.dealId] = o;
    }

    // 2. Fetch ALL open/active deals from Postgres with company name
    let dealsMap: Record<string, { title: string; companyName: string; status: string; createdAt: string }> = {};
    if (env("DATABASE_URL")) {
      try {
        const db = createClient();
        const { data: deals, error: dealsErr } = await db
          .from("deals")
          .select("id, title, status, created_at, companies(name)")
          .eq("status", "open");
        if (dealsErr) console.error("Postgres deals error:", dealsErr.message);
        for (const d of (deals || [])) {
          dealsMap[d.id] = {
            title: d.title || "Без названия",
            companyName: (d.companies as any)?.name || "",
            status: d.status,
            createdAt: d.created_at,
          };
        }
      } catch (e) {
        console.error("Error fetching deals from Postgres:", e);
      }
    }

    // 3. Build result map — start from manual prod-orders, then fill gaps from deal_items
    const resultMap: Record<string, any> = {};

    for (const o of manualOrders) {
      if (!o?.dealId || !o.items?.length) continue;
      const dealInfo = dealsMap[o.dealId] || {};
      resultMap[o.dealId] = {
        id: o.id || `prod-order-${o.dealId}`,
        dealId: o.dealId,
        dealTitle: o.dealTitle || dealInfo.title || "Без названия",
        companyName: o.companyName || dealInfo.companyName || "",
        items: o.items,
        status: o.status || "pending",
        createdAt: o.createdAt || dealInfo.createdAt || new Date().toISOString(),
      };
    }

    // For every deal in Postgres not already covered, check KV for items
    const dealIdsToCheck = Object.keys(dealsMap).filter(id => !resultMap[id]);
    for (const dealId of dealIdsToCheck) {
      try {
        const items = await kv.get(`deal_items:${dealId}`) as any[] | null;
        if (Array.isArray(items) && items.length > 0 && items.some((i: any) => i.article)) {
          const dealInfo = dealsMap[dealId];
          resultMap[dealId] = {
            id: `prod-order-${dealId}`,
            dealId,
            dealTitle: dealInfo.title,
            companyName: dealInfo.companyName,
            items: items.filter((i: any) => i.article),
            status: "pending",
            createdAt: dealInfo.createdAt || new Date().toISOString(),
          };
        }
      } catch (e) { /* skip */ }
    }

    const result = Object.values(resultMap).sort((a: any, b: any) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    console.log(`Production orders: ${result.length} total (${manualOrders.length} manual, ${dealIdsToCheck.length} synthesised from deal_items)`);
    return c.json(result);
  } catch (error: any) {
    console.error("Error fetching production orders:", error);
    return c.json({ error: error.message }, 500);
  }
});

// Create / update a production order for a deal
app.post("/make-server-f9553289/production-orders", async (c) => {
  try {
    const body = await c.req.json();
    const { dealId, dealTitle, companyName, items } = body;
    if (!dealId) return c.json({ error: "dealId is required" }, 400);

    const existing = await kv.get(`prod-order:${dealId}`) as any;
    const order = {
      id: `prod-order-${dealId}`,
      dealId,
      dealTitle: dealTitle || '',
      companyName: companyName || '',
      items: items || [],
      status: 'pending',
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await kv.set(`prod-order:${dealId}`, order);
    return c.json({ success: true, order });
  } catch (error: any) {
    console.error("Error saving production order:", error);
    return c.json({ error: error.message }, 500);
  }
});

// Delete a production order
app.delete("/make-server-f9553289/production-orders/:dealId", async (c) => {
  try {
    const dealId = c.req.param("dealId");
    await kv.del(`prod-order:${dealId}`);
    return c.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting production order:", error);
    return c.json({ error: error.message }, 500);
  }
});

// Get Full Warehouse Inventory (Calculated) - v8 with enhanced logging
app.get("/make-server-f9553289/warehouse/inventory", async (c) => {
  try {
     console.log("Fetching warehouse inventory...");
     // 1. Get all production logs (Additions)
     let logs: any[] = [];
     try { logs = await kv.getByPrefix("production_log:"); } catch (e) {
       console.error("Error fetching production logs:", e);
     }
     
     // Initialize structure for all warehouses
     const finalInventory: Record<string, any> = {
         'AIKO': { 
             produced: { total: 0, byArticle: {} as Record<string, number> },
             sold: { total: 0, byArticle: {} as Record<string, number> }
         },
         'BTT': { 
             produced: { total: 0, byArticle: {} as Record<string, number> },
             sold: { total: 0, byArticle: {} as Record<string, number> }
         },
         'Bizly': { 
             produced: { total: 0, byArticle: {} as Record<string, number> },
             sold: { total: 0, byArticle: {} as Record<string, number> }
         }
     };

     // Process Production Logs (Additions)
     logs.forEach((log: any) => {
        const wh = log.warehouse || 'AIKO';
        if (!finalInventory[wh]) finalInventory[wh] = { produced: { total: 0, byArticle: {} }, sold: { total: 0, byArticle: {} } };
        
        finalInventory[wh].produced.total += (log.amount || 0);
        const art = log.article ? log.article.trim() : "Без артикула";
        finalInventory[wh].produced.byArticle[art] = (finalInventory[wh].produced.byArticle[art] || 0) + (log.amount || 0);
     });

     // Inject Defined Products (Recipes) into AIKO inventory (as 0 stock if not present)
     // This ensures they appear in ProductSelect
     try {
         const products = await kv.getByPrefix("product:");
         if (products) {
             const wh = 'AIKO'; // Default warehouse for definitions
             if (!finalInventory[wh]) finalInventory[wh] = { produced: { total: 0, byArticle: {} }, sold: { total: 0, byArticle: {} } };
             
             products.forEach((p: any) => {
                 const art = p.name;
                 if (!finalInventory[wh].produced.byArticle[art]) {
                     finalInventory[wh].produced.byArticle[art] = 0;
                 }
             });
         }
     } catch (e) {
         console.error("Error fetching products for inventory:", e);
     }

     // 2. Process Shipments (Add to Sold AND build deduplication map)
     // Map structure: DealID -> Warehouse -> Article -> Amount Shipped
     const shippedByDeal: Record<string, Record<string, Record<string, number>>> = {};
     
     try {
         const shipments = await kv.getByPrefix("shipment:");
         if (shipments) {
             shipments.forEach((s: any) => {
                 if (s.status === 'completed') {
                     const wh = s.warehouse || 'AIKO';
                     
                     // Add to Stats
                     if (!finalInventory[wh]) finalInventory[wh] = { produced: { total: 0, byArticle: {} }, sold: { total: 0, byArticle: {} } };

                     s.items.forEach((item: any) => {
                         const weight = parseFloat(item.weight) || 0;
                         finalInventory[wh].sold.total += weight;
                         const art = item.article ? item.article.trim() : "Без артикула";
                         finalInventory[wh].sold.byArticle[art] = (finalInventory[wh].sold.byArticle[art] || 0) + weight;
                         
                         // Add to Deduplication Map
                         if (s.dealId) {
                             if (!shippedByDeal[s.dealId]) shippedByDeal[s.dealId] = {};
                             if (!shippedByDeal[s.dealId][wh]) shippedByDeal[s.dealId][wh] = {};
                             
                             const current = shippedByDeal[s.dealId][wh][art] || 0;
                             shippedByDeal[s.dealId][wh][art] = current + weight;
                         }
                     });
                 }
             });
         }
     } catch (e) {
         console.error("Error processing shipments for inventory:", e);
     }

     // 3. Process Won Deals (Add Reserved/Unshipped portion) - FIXED
     if (env("DATABASE_URL")) {
        try {
            const db = createClient();
            const { data: wonDeals, error } = await db.from('deals').select('id').eq('status', 'won');
            
            if (error) {
                console.error("Error fetching won deals for inventory:", error);
            }
            
            if (!error && wonDeals && wonDeals.length > 0) {
                const wonDealIds = new Set(wonDeals.map(d => d.id));

                const allDealItems = await kv.scanByKeyLike('deal_items:%');
                    
                if (allDealItems) {
                    allDealItems.forEach((row: any) => {
                     // Extract dealId from key "deal_items:UUID"
                     const dealId = row.key.replace('deal_items:', '');
                     
                     // Only process if deal is WON
                     if (wonDealIds.has(dealId)) {
                         const items = row.value;
                         if (items && Array.isArray(items)) {
                             items.forEach((item: any) => {
                                 const qty = parseFloat(item.quantity) || 0;
                                 const wh = item.warehouse || 'AIKO';
                                 const art = item.article ? item.article.trim() : "Без артикула";

                                 // Check how much is already shipped for this specific deal/warehouse/article
                                 let shippedQty = 0;
                                 if (shippedByDeal[dealId] && shippedByDeal[dealId][wh] && shippedByDeal[dealId][wh][art]) {
                                     shippedQty = shippedByDeal[dealId][wh][art];
                                 }
                                 
                                 // Calculate remaining reservation (Unshipped amount)
                                 // We consume the shippedQty so it doesn't count for other lines of same article in this deal
                                 const consumed = Math.min(qty, shippedQty);
                                 const reserved = Math.max(0, qty - consumed);
                                 
                                 // Update tracking to reduce available shippedQty for next iteration (handle duplicate lines)
                                 if (consumed > 0 && shippedByDeal[dealId] && shippedByDeal[dealId][wh]) {
                                     shippedByDeal[dealId][wh][art] -= consumed;
                                 }

                                 // Add ONLY the reserved (unshipped) part to the total sold
                                 if (reserved > 0) {
                                     if (!finalInventory[wh]) finalInventory[wh] = { produced: { total: 0, byArticle: {} }, sold: { total: 0, byArticle: {} } };

                                     finalInventory[wh].sold.total += reserved;
                                     finalInventory[wh].sold.byArticle[art] = (finalInventory[wh].sold.byArticle[art] || 0) + reserved;
                                 }
                             });
                         }
                     }
                });
            }
            }
        } catch (e) {
            console.error("Error processing won deals for inventory:", e);
        }
     }

     // 4. (Removed redundant loop)

     // Calculate Current
     const response: Record<string, any> = {};
     for (const [wh, data] of Object.entries(finalInventory)) {
         const currentByArticle: Record<string, number> = {};
         const allArticles = new Set([
             ...Object.keys(data.produced.byArticle),
             ...Object.keys(data.sold.byArticle)
         ]);

         allArticles.forEach(art => {
             const p = data.produced.byArticle[art] || 0;
             const s = data.sold.byArticle[art] || 0;
             currentByArticle[art] = p - s;
         });

         response[wh] = {
             produced: data.produced,
             sold: data.sold,
             current: {
                 total: data.produced.total - data.sold.total,
                 byArticle: currentByArticle
             }
         };
     }

     console.log("Warehouse inventory fetched successfully");
     return c.json(response);

  } catch (e: any) {
      console.error("Inventory Calculation Error:", e);
      console.error("Error stack:", e.stack);
      return c.json({ error: e.message || "Internal server error", details: e.toString() }, 500);
  }
});

// ============= SHIPMENTS SYSTEM =============

app.get("/make-server-f9553289/shipments", async (c) => {
  try {
    const shipments = await kv.getByPrefix("shipment:");
    // Sort by date descending
    const sorted = (shipments || []).sort((a: any, b: any) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    return c.json(sorted);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

app.post("/make-server-f9553289/shipments", async (c) => {
  try {
    const body = await c.req.json();
    const { date, note, items, status, warehouse, dealId, stickerClient } = body;
    
    const id = `shipment:${Date.now()}`;
    const shipment = {
      id,
      date: date || new Date().toISOString(),
      note: note || '',
      status: status || 'draft', // draft, completed
      warehouse: warehouse || 'AIKO',
      items: items || [], // Array of { id, article, weight, date }
      dealId: dealId || null,
      stickerClient: stickerClient || '',
      createdAt: new Date().toISOString()
    };
    
    await kv.set(id, shipment);
    return c.json({ success: true, shipment });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

app.put("/make-server-f9553289/shipments/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    
    const existing = await kv.get(id);
    if (!existing) return c.json({ error: "Shipment not found" }, 404);
    
    const updated = { ...existing, ...body };
    await kv.set(id, updated);
    return c.json({ success: true, shipment: updated });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

app.delete("/make-server-f9553289/shipments/:id", async (c) => {
  try {
    const id = c.req.param("id");
    await kv.del(id);
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// ============= WAREHOUSE TRANSFERS SYSTEM =============

app.get("/make-server-f9553289/transfers", async (c) => {
  try {
    const transfers = await kv.getByPrefix("transfer:");
    // Sort by date descending
    const sorted = (transfers || []).sort((a: any, b: any) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    return c.json(sorted);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

app.post("/make-server-f9553289/transfers", async (c) => {
  try {
    const body = await c.req.json();
    const fromWarehouse = (body.fromWarehouse || '').trim();
    const toWarehouse = (body.toWarehouse || '').trim();
    const article = (body.article || '').trim();
    const note = body.note;
    const quantity = parseFloat(body.quantity);
    
    console.log('📦 Creating transfer:', { 
      fromWarehouse, 
      toWarehouse, 
      article, 
      articleType: typeof article,
      quantity,
      quantityType: typeof quantity 
    });
    
    // Validation
    if (!fromWarehouse || !toWarehouse || !article || !quantity) {
      return c.json({ error: "Missing required fields" }, 400);
    }
    
    if (fromWarehouse === toWarehouse) {
      return c.json({ error: "Source and destination warehouses must be different" }, 400);
    }
    
    if (quantity <= 0 || isNaN(quantity)) {
      return c.json({ error: "Quantity must be greater than 0" }, 400);
    }
    
    // Check available stock in source warehouse
    const logs = await kv.getByPrefix("warehouse:log:");
    const whLogs = (logs || []).filter((l: any) => (l.warehouse || 'AIKO') === fromWarehouse);
    
    console.log('📦 Production logs for', fromWarehouse, ':', {
      totalLogs: logs?.length || 0,
      warehouseLogs: whLogs.length,
      articles: [...new Set(whLogs.map((l: any) => l.article))]
    });
    
    // Calculate current stock for this article
    const stockByArticle: Record<string, number> = {};
    whLogs.forEach((log: any) => {
      const art = (log.article || 'Unknown').trim();
      if (!stockByArticle[art]) stockByArticle[art] = 0;
      stockByArticle[art] += log.amount || 0;
    });
    
    console.log('💼 Initial stock after production:', JSON.stringify(stockByArticle));
    
    // Subtract shipments
    const shipments = await kv.getByPrefix("shipment:");
    const completedShipments = (shipments || []).filter((s: any) => 
      s.status === 'completed' && (s.warehouse || 'AIKO') === fromWarehouse
    );
    
    completedShipments.forEach((shipment: any) => {
      (shipment.items || []).forEach((item: any) => {
        const art = (item.article || '').trim();
        if (stockByArticle[art] !== undefined) {
          stockByArticle[art] -= item.weight || 0;
        }
      });
    });
    
    console.log('📤 Stock after shipments:', JSON.stringify(stockByArticle));
    
    // Subtract previous transfers FROM this warehouse
    const prevTransfers = await kv.getByPrefix("transfer:");
    
    console.log('📋 Processing transfers:', {
      totalTransfers: (prevTransfers || []).length,
      fromWarehouse,
      article
    });
    
    (prevTransfers || []).forEach((t: any) => {
      const art = (t.article || '').trim();
      const qty = parseFloat(t.quantity) || 0;
      const tFromWarehouse = (t.fromWarehouse || '').trim();
      const tToWarehouse = (t.toWarehouse || '').trim();
      
      console.log('  Transfer:', {
        from: tFromWarehouse,
        to: tToWarehouse,
        article: art,
        articleMatches: (art === article),
        quantity: qty,
        isFromWarehouse: (tFromWarehouse === fromWarehouse),
        isToWarehouse: (tToWarehouse === fromWarehouse)
      });
      
      // Initialize key if doesn't exist
      if (!stockByArticle[art]) {
        stockByArticle[art] = 0;
      }
      
      if (tFromWarehouse === fromWarehouse) {
        stockByArticle[art] -= qty;
      }
      
      // Add transfers TO this warehouse
      if (tToWarehouse === fromWarehouse) {
        stockByArticle[art] += qty;
      }
    });
    
    console.log('🔄 Stock after transfers:', JSON.stringify(stockByArticle));
    console.log('🎯 Final available for article', article, ':', stockByArticle[article] || 0);
    
    const availableStock = stockByArticle[article] || 0;
    
    console.log('📊 Stock calculation for', article, 'in', fromWarehouse, ':', {
      produced: whLogs.filter((l: any) => l.article === article).reduce((sum: number, l: any) => sum + (l.amount || 0), 0),
      shipped: completedShipments.reduce((sum: number, s: any) => {
        return sum + (s.items || [])
          .filter((i: any) => i.article === article)
          .reduce((itemSum: number, i: any) => itemSum + (i.weight || 0), 0);
      }, 0),
      transferredOut: (prevTransfers || [])
        .filter((t: any) => t.fromWarehouse === fromWarehouse && t.article === article)
        .reduce((sum: number, t: any) => sum + (parseFloat(t.quantity) || 0), 0),
      transferredIn: (prevTransfers || [])
        .filter((t: any) => t.toWarehouse === fromWarehouse && t.article === article)
        .reduce((sum: number, t: any) => sum + (parseFloat(t.quantity) || 0), 0),
      availableStock,
      requestedQuantity: quantity
    });
    
    if (availableStock < quantity) {
      return c.json({ 
        error: `Insufficient stock. Available: ${availableStock.toFixed(2)} кг, Requested: ${quantity} кг` 
      }, 400);
    }
    
    // Create transfer record
    const id = `transfer:${Date.now()}`;
    const transfer = {
      id,
      fromWarehouse,
      toWarehouse,
      article,
      quantity,
      note: note || '',
      date: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };
    
    await kv.set(id, transfer);
    
    console.log('✅ Transfer created:', transfer);
    
    return c.json({ success: true, transfer });
  } catch (error: any) {
    console.error('❌ Transfer creation error:', error);
    return c.json({ error: error.message }, 500);
  }
});

app.delete("/make-server-f9553289/transfers/:id", async (c) => {
  try {
    const id = c.req.param("id");
    await kv.del(id);
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// ============= MARKETING SYSTEM =============

app.get("/make-server-f9553289/marketing/reports", async (c) => {
  try {
    const reports = await kv.getByPrefix("marketing:report:");
    return c.json(reports || []);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

app.post("/make-server-f9553289/marketing/reports", async (c) => {
  try {
    const body = await c.req.json();
    const { reports } = body;
    
    if (!Array.isArray(reports)) {
       return c.json({ error: "Reports must be an array" }, 400);
    }

    const savedReports = [];
    for (const report of reports) {
      const id = report.id || `marketing:report:${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
      const reportWithId = { ...report, id };
      // If the ID doesn't start with prefix, ensure key does
      const key = id.startsWith('marketing:report:') ? id : `marketing:report:${id}`;
      
      await kv.set(key, reportWithId);
      savedReports.push(reportWithId);
    }

    return c.json({ success: true, reports: savedReports });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

app.delete("/make-server-f9553289/marketing/reports/:id", async (c) => {
  try {
    const id = c.req.param("id");
    // Ensure we delete the correct key.
    const key = id.startsWith('marketing:report:') ? id : `marketing:report:${id}`;
    await kv.del(key);
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Marketing Target
app.get("/make-server-f9553289/marketing/target", async (c) => {
  try {
    const target = await kv.get("marketing:target");
    return c.json({ target: target || 50000000 });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

app.post("/make-server-f9553289/marketing/target", async (c) => {
  try {
    const body = await c.req.json();
    const { target } = body;
    await kv.set("marketing:target", Number(target));
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Marketing Calendar Events
app.get("/make-server-f9553289/marketing/events", async (c) => {
  try {
    const events = await kv.getByPrefix("marketing:event:");
    return c.json(events || []);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

app.post("/make-server-f9553289/marketing/events", async (c) => {
  try {
    const body = await c.req.json();
    const { title, date, type, channel, description } = body;
    
    if (!title || !date) return c.json({ error: "Title and Date required" }, 400);

    const id = `marketing:event:${Date.now()}`;
    const event = {
        id,
        title, 
        date,
        type: type || 'campaign', // campaign, holiday, technical
        channel: channel || 'all',
        description: description || ''
    };

    await kv.set(id, event);
    return c.json({ success: true, event });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

app.delete("/make-server-f9553289/marketing/events/:id", async (c) => {
  try {
    const id = c.req.param("id");
    // Ensure we delete the correct key. The ID from frontend might or might not have prefix.
    // Our GET returns the full object which has 'id' field same as key usually.
    // Let's assume frontend sends the full ID string which is the key.
    await kv.del(id); 
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// ============= TIMELINE SYSTEM =============

app.get("/make-server-f9553289/timeline/:dealId", async (c) => {
  try {
    const dealId = c.req.param("dealId");
    const events = await kv.get(`timeline:deal:${dealId}`);
    return c.json(events || []);
  } catch (error: any) {
    console.error("Error fetching timeline:", error);
    return c.json({ error: error.message }, 500);
  }
});

app.post("/make-server-f9553289/timeline", async (c) => {
  try {
    const body = await c.req.json();
    const { dealId, event } = body;
    
    if (!dealId || !event) {
       return c.json({ error: "Missing dealId or event" }, 400);
    }

    const current = await kv.get(`timeline:deal:${dealId}`) || [];
    const updated = [event, ...current];
    const truncated = updated.slice(0, 100); // Limit history size
    
    await kv.set(`timeline:deal:${dealId}`, truncated);
    return c.json({ success: true });
  } catch (error: any) {
    console.error("Error saving timeline event:", error);
    return c.json({ error: error.message }, 500);
  }
});

// ============= GLOBAL SETTINGS =============

app.get("/make-server-f9553289/settings/rates", async (c) => {
  try {
    const rates = await kv.get("settings:rates");
    // Default values if not set
    const defaultRates = {
        winding: 1000,
        twisting: 1500
    };
    return c.json(rates || defaultRates);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

app.post("/make-server-f9553289/settings/rates", async (c) => {
  try {
    const body = await c.req.json();
    const { winding, twisting } = body;
    
    await kv.set("settings:rates", {
        winding: parseFloat(winding) || 0,
        twisting: parseFloat(twisting) || 0
    });
    
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// ============= PAYMENT SYSTEM =============

app.get("/make-server-f9553289/payments", async (c) => {
  try {
    const payments = await kv.getByPrefix("payment:");
    return c.json(payments || []);
  } catch (error: any) {
    console.error("Error fetching payments:", error);
    console.error("Error stack:", error.stack);
    return c.json({ error: error.message || "Failed to fetch payments", details: error.toString() }, 500);
  }
});

app.get("/make-server-f9553289/payments/deal/:dealId", async (c) => {
  try {
    const dealId = c.req.param("dealId");
    // Get all payments and filter (kv currently supports prefix, but let's be safe)
    // If we name keys as payment:deal:{dealId}:{random}, we can prefix search
    const payments = await kv.getByPrefix(`payment:${dealId}:`);
    return c.json(payments || []);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

app.post("/make-server-f9553289/payments", async (c) => {
  try {
    const body = await c.req.json();
    const { dealId, amount, date, note, type } = body; // type: 'income' | 'expense' (future proof)

    if (!dealId || !amount) {
       return c.json({ error: "Missing required fields" }, 400);
    }

    const id = `payment:${dealId}:${Date.now()}`;
    const payment = {
      id,
      dealId,
      amount: parseFloat(amount),
      date: date || new Date().toISOString(),
      note: note || '',
      type: type || 'income',
      createdAt: new Date().toISOString()
    };
    
    await kv.set(id, payment);
    return c.json({ success: true, payment });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

app.delete("/make-server-f9553289/payments/:id", async (c) => {
  try {
    const id = c.req.param("id");
    // The ID passed from frontend should be the full key
    await kv.del(id); 
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// ============= RECIPE LIBRARY =============

app.get("/make-server-f9553289/recipes", async (c) => {
  try {
    const recipes = await kv.getByPrefix("recipe:");
    return c.json(recipes || []);
  } catch (error: any) {
    console.error("Error fetching recipes:", error);
    return c.json({ error: error.message }, 500);
  }
});

app.post("/make-server-f9553289/recipes", async (c) => {
  try {
    const body = await c.req.json();
    const { id, name, description, base, dye, temperature, screwSpeed, dyeSpeed, winding, image } = body;
    
    if (!name) {
      return c.json({ error: "Name is required" }, 400);
    }

    // If ID is provided (update), it should already be the key "recipe:..."
    // If not (create), generate one
    let recipeId = id;
    if (!recipeId) {
        recipeId = `recipe:${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    
    // Ensure ID starts with prefix if it doesn't (safety)
    const key = recipeId.startsWith('recipe:') ? recipeId : `recipe:${recipeId}`;

    const recipe = {
      id: key,
      name,
      description: description || '',
      base: base || '',
      dye: dye || '',
      temperature: temperature || '',
      screwSpeed: screwSpeed || '',
      dyeSpeed: dyeSpeed || '',
      winding: winding || '',
      image: image || null,
      updatedAt: new Date().toISOString()
    };
    
    await kv.set(key, recipe);
    
    return c.json({ success: true, recipe });
  } catch (error: any) {
    console.error("Error saving recipe:", error);
    return c.json({ error: error.message }, 500);
  }
});

app.delete("/make-server-f9553289/recipes/:id", async (c) => {
  try {
    const id = c.req.param("id");
    // Frontend should send the full ID (key)
    // But just in case, ensure prefix
    const key = id.startsWith('recipe:') ? id : `recipe:${id}`;
    
    await kv.del(key);
    return c.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting recipe:", error);
    return c.json({ error: error.message }, 500);
  }
});

// ============= AUTOMATION SYSTEM =============

// Get Automation Settings
app.get("/make-server-f9553289/automation/settings", async (c) => {
  try {
    const settings = await kv.get("settings:automation");
    return c.json(settings || {
      autoCreateTasks: false,
      stalledNotifications: false,
      emailOnWin: false
    });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Save Automation Settings
app.post("/make-server-f9553289/automation/settings", async (c) => {
  try {
    const body = await c.req.json();
    await kv.set("settings:automation", body);
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Update Deal with Automation
app.post("/make-server-f9553289/deals/update-with-automation", async (c) => {
  try {
    const body = await c.req.json();
    const { id, updates, previousStatus, previousStageId } = body;
    
    if (!id || !updates) {
      return c.json({ error: "Missing id or updates" }, 400);
    }

    if (!env("DATABASE_URL")) return c.json({ error: "DATABASE_URL is not configured" }, 500);
    const db = createClient();

    // 1. Perform Update
    const { error: updateError } = await db
      .from('deals')
      .update(updates)
      .eq('id', id);

    if (updateError) throw updateError;

    // 2. Load Automation Settings
    const settings = (await kv.get("settings:automation")) || {};
    const { autoCreateTasks, emailOnWin } = settings;

    // 3. Auto-Create Task Logic
    if (autoCreateTasks && updates.stage_id && updates.stage_id !== previousStageId) {
       // Check if this is "Qualification" stage
       const { data: stage } = await db.from('stages').select('name').eq('id', updates.stage_id).single();
       
       if (stage && (stage.name.toLowerCase().includes('квалификация') || stage.name.toLowerCase().includes('qualification'))) {
           // Create Task
           await db.from('tasks').insert({
               title: `Подготовить документы: ${updates.title || 'Сделка'}`,
               description: 'Автоматическая задача: Сделка перешла на этап ����алификации. Необходимо проверить и подготовить документы.',
               status: 'planned',
               priority: 'high',
               deal_id: id,
               due_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
           });
           console.log(`Automation: Created task for deal ${id}`);
       }
    }

    // 4. Auto-Email Logic
    if (emailOnWin && updates.status === 'won' && previousStatus !== 'won') {
        // Send Email
        const { data: deal } = await db.from('deals').select('*, companies(email, name)').eq('id', id).single();
        const clientEmail = deal?.companies?.email;
        
        if (clientEmail) {
             const subject = `Заказ принят в работу: ${deal.title}`;
             const message = `
               Ува��аемый(ая) ${deal.companies?.name || 'Клиент'},
               
               Спасибо за ваш заказ! Мы рады сообщить, что ваша сделка "${deal.title}" успешно пере��едена в статус "Выиграна".
               Мы приступаем к выполнению обязательств.
               
               С ��важением,
               Команда BTT NEXUS
             `;
             
             // Use internal fetch to trigger email logic to avoid code duplication
             // Or direct call if we prefer. Let's use kv lookup for resend key directly.
             const kvCreds = await kv.get("integration:resend");
             const resendApiKey = kvCreds?.apiKey || env("RESEND_API_KEY");
             
             if (resendApiKey) {
                await fetch("https://api.resend.com/emails", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${resendApiKey}`,
                    },
                    body: JSON.stringify({
                        from: "CRM System <onboarding@resend.dev>",
                        to: [clientEmail],
                        subject: subject,
                        html: message.replace(/\n/g, '<br>')
                    })
                });
                console.log(`Automation: Sent email to ${clientEmail}`);
             }
        }
    }

    return c.json({ success: true });
  } catch (error: any) {
    console.error("Automation Update Error:", error);
    return c.json({ error: error.message }, 500);
  }
});

// Check Stalled Deals (Called by Frontend periodically or on load)
app.post("/make-server-f9553289/deals/check-stalled", async (c) => {
  try {
     const settings = (await kv.get("settings:automation")) || {};
     if (!settings.stalledNotifications) {
         return c.json({ skipped: true });
     }

     // Limit frequency: Check if we ran this recently (e.g., last 12 hours)
     const lastRun = await kv.get("system:last_stalled_check");
     const now = Date.now();
     if (lastRun && (now - lastRun) < 12 * 60 * 60 * 1000) {
         return c.json({ skipped: true, reason: "Too frequent" });
     }
     
     await kv.set("system:last_stalled_check", now);

     if (!env("DATABASE_URL")) return c.json({ error: "DATABASE_URL is not configured" }, 500);
     const db = createClient();

     // Find deals updated > 7 days ago and OPEN
     const sevenDaysAgo = new Date();
     sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
     
     // Note: table deals might not have updated_at; we use created_at or timeline events
     // Assuming 'created_at' for simplicity if updated_at is missing, OR we can check timeline events.
     // Let's stick to created_at for now as a proxy for "stuck at start" or if user requested "not updated".
     // Ideally we need updated_at column. If it doesn't exist, we can't do "not updated".
     // Let's assume created_at for now to be safe.
     
     const { data: stalled } = await db
        .from('deals')
        .select('id, title, created_at, amount')
        .eq('status', 'open')
        .lt('created_at', sevenDaysAgo.toISOString());

     if (!stalled || stalled.length === 0) {
         return c.json({ found: 0 });
     }

     // Send Telegram Notification
     const kvCreds = await kv.get("integration:telegram");
     const botToken = kvCreds?.botToken || env("TELEGRAM_BOT_TOKEN");
     // We need a chat_id. Usually this is stored when user interacts with bot, OR we can broadcast to a known channel.
     // For now, let's try to send to the last user who interacted? 
     // Or we need a setting for "Notification Chat ID".
     // Let's look at webhook logs to find a chat ID? No, unreliable.
     // We will skip sending if we don't know WHERE to send.
     // BUT, we can use the 'production_log' to find a recent user ID?
     // Better: In IntegrationDialog, we asked user to /start. We should have stored the chat_id then.
     // I'll assume we don't have a specific chat_id stored for notifications yet.
     // I'll skip the actual sending for now if I can't find a recipient, but I'll log it.
     
     // Workaround: We will rely on the "Notification Center" in the app (already implemented in notifications/generate)
     // which creates in-app notifications.
     // Does 'notifications/generate' also send Telegram?
     // No.
     // Let's just run 'notifications/generate' logic here, which creates in-app notifications.
     // AND if we have a Telegram token, maybe try to send a summary.
     
     // Let's just call the internal generate logic.
     // Actually, let's just use the `notifications/generate` endpoint which I already saw in index.tsx!
     // It already does exactly this (checks for 7 days stale deals).
     
     // So I don't need to rewrite logic. I just need the frontend to CALL `notifications/generate`.
     
     return c.json({ success: true, message: "Use notifications/generate instead" });

  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Reset Inventory Endpoint
app.post("/make-server-f9553289/warehouse/inventory/reset", async (c) => {
  try {
     // 1. Calculate Inventory (Copy logic from GET /warehouse/inventory)
     let logs: any[] = [];
     try { logs = await kv.getByPrefix("production_log:"); } catch (e) {}
     
     const inventory: Record<string, Record<string, number>> = {}; // Warehouse -> Article -> Qty

     // Add Production
     if (logs) {
         logs.forEach((log: any) => {
            const wh = log.warehouse || 'AIKO';
            if (!inventory[wh]) inventory[wh] = {};
            const art = log.article ? log.article.trim() : "Без артикула";
            inventory[wh][art] = (inventory[wh][art] || 0) + (log.amount || 0);
         });
     }

     // Subtract Shipments
     const shipments = await kv.getByPrefix("shipment:");
     if (shipments) {
         shipments.forEach((s: any) => {
             if (s.status === 'completed') {
                 const wh = s.warehouse || 'AIKO';
                 if (!inventory[wh]) inventory[wh] = {};
                 s.items.forEach((item: any) => {
                     const art = item.article ? item.article.trim() : "Без артикула";
                     inventory[wh][art] = (inventory[wh][art] || 0) - (item.weight || 0);
                 });
             }
         });
     }

     // 2. Prepare Snapshot & Zeroing Logs
     const timestamp = new Date().toISOString();
     const snapshotId = `archive_inventory:${Date.now()}`;
     const snapshotItems: any[] = [];
     const newLogs: any[] = [];

     Object.entries(inventory).forEach(([wh, articles]) => {
         Object.entries(articles).forEach(([art, qty]) => {
             if (Math.abs(qty) > 0.001) { // Only process non-zero items
                 // Snapshot Item
                 snapshotItems.push({
                     warehouse: wh,
                     article: art,
                     quantity: qty,
                     date: timestamp
                 });

                 // Zeroing Log
                 newLogs.push({
                     id: `production_log:reset_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                     date: timestamp,
                     user: "Система (Инвентаризация)",
                     userId: "system",
                     amount: -qty, // Negative of current to zero it
                     article: art,
                     originalMessage: `Инвентаризация (Сброс)`,
                     status: 'synced',
                     unit: art.toLowerCase().includes('к��шпо') ? 'шт' : 'кг',
                     warehouse: wh,
                     materialType: "Инвентаризация",
                 });
             }
         });
     });

     // 3. Save Snapshot
     await kv.set(snapshotId, { 
         id: snapshotId, 
         date: timestamp, 
         items: snapshotItems 
     });

     // 4. Save Logs
     for (const log of newLogs) {
         await kv.set(log.id, log);
     }

     return c.json({ success: true, snapshot: snapshotItems, archiveId: snapshotId });

  } catch (error: any) {
    console.error("Inventory Reset Error:", error);
    return c.json({ error: error.message }, 500);
  }
});

// ============= LEADS SYSTEM =============

app.get("/make-server-f9553289/leads", async (c) => {
  try {
    const leads = await kv.getByPrefix("lead:");
    // Sort by date descending
    const sorted = (leads || []).sort((a: any, b: any) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    return c.json(sorted);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

app.post("/make-server-f9553289/leads", async (c) => {
  try {
    const body = await c.req.json();
    const { name, phone, info, status, country } = body;
    
    if (!name || !phone) {
      return c.json({ error: "Name and Phone are required" }, 400);
    }

    const id = `lead:${Date.now()}`;
    const lead = {
      id,
      name,
      phone,
      info: info || '',
      status: status || 'new',
      country: country || 'Uzbekistan',
      createdAt: new Date().toISOString()
    };
    
    await kv.set(id, lead);
    return c.json({ success: true, lead });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

app.put("/make-server-f9553289/leads/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    
    const existing = await kv.get(id);
    if (!existing) return c.json({ error: "Lead not found" }, 404);
    
    const updated = { ...existing, ...body };
    await kv.set(id, updated);
    return c.json({ success: true, lead: updated });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

app.delete("/make-server-f9553289/leads/:id", async (c) => {
  try {
    const id = c.req.param("id");
    await kv.del(id);
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Import from Google - DEPRECATED/REMOVED
// app.post("/make-server-f9553289/leads/import-google", ... )

// Deal Metadata (Exclusions) Endpoints
app.get("/make-server-f9553289/deals/excluded", async (c) => {
  try {
    const meta = await kv.getByPrefix("deal-meta:");
    // Filter only those marked as excluded
    const excludedIds = (meta || [])
        .filter((m: any) => m.excluded === true)
        .map((m: any) => m.id);
        
    return c.json({ excludedIds });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

app.post("/make-server-f9553289/deals/exclude", async (c) => {
  try {
    const body = await c.req.json();
    const { dealId, excluded } = body;
    
    if (!dealId) {
      return c.json({ error: "dealId is required" }, 400);
    }

    const key = `deal-meta:${dealId}`;
    if (excluded) {
        await kv.set(key, { id: dealId, excluded: true });
    } else {
        // If un-excluding, we can either set false or delete the key
        await kv.del(key);
    }
    
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Payroll endpoints
// Save monthly payroll calculation
app.post("/make-server-f9553289/payroll", async (c) => {
  try {
    const { month, payrollData } = await c.req.json();
    if (!month || !payrollData) {
      return c.json({ error: "Month and payrollData are required" }, 400);
    }

    const payrollId = `payroll:${month}`;
    const payroll = {
      id: payrollId,
      month,
      createdAt: new Date().toISOString(),
      data: payrollData,
      totalCalculated: payrollData.reduce((sum: number, item: any) => sum + item.calculatedSalary, 0),
      totalPaid: payrollData.reduce((sum: number, item: any) => sum + item.paidAmount, 0),
      totalRemaining: payrollData.reduce((sum: number, item: any) => sum + item.remaining, 0)
    };

    await kv.set(payrollId, payroll);
    
    return c.json({ success: true, payroll });
  } catch (error: any) {
    console.error("Error saving payroll:", error);
    return c.json({ error: error.message }, 500);
  }
});

// Get payroll history
app.get("/make-server-f9553289/payroll", async (c) => {
  try {
    const payrolls = await kv.getByPrefix("payroll:");
    return c.json(payrolls || []);
  } catch (error: any) {
    console.error("Error fetching payrolls:", error);
    return c.json({ error: error.message }, 500);
  }
});

// Get specific month payroll
app.get("/make-server-f9553289/payroll/:month", async (c) => {
  try {
    const month = c.req.param("month");
    const payroll = await kv.get(`payroll:${month}`);
    return c.json(payroll || null);
  } catch (error: any) {
    console.error("Error fetching payroll:", error);
    return c.json({ error: error.message }, 500);
  }
});

// ==================== SALES ANALYTICS ENDPOINTS ====================

// ABC Analysis - Shows which clients bring 80% of revenue
app.get("/make-server-f9553289/analytics/abc-analysis", async (c) => {
  try {
    if (!env("DATABASE_URL")) {
      return c.json({ error: "DATABASE_URL is not configured" }, 500);
    }

    const db = createClient();

    // Get date range from query params
    const startDate = c.req.query("startDate");
    const endDate = c.req.query("endDate");

    // Get all won deals with company info and optional date filtering
    let query = db
      .from('deals')
      .select('id, company_id, amount, status, companies(id, name)')
      .eq('status', 'won')
      .order('amount', { ascending: false });

    if (startDate) {
      query = query.gte('created_at', startDate);
    }
    if (endDate) {
      query = query.lte('created_at', endDate);
    }

    const { data: deals, error } = await query;

    if (error) throw error;

    // Group by company and calculate total revenue
    const companyRevenue = new Map<string, { name: string; revenue: number; dealCount: number }>();
    
    deals?.forEach((deal: any) => {
      const companyId = deal.company_id;
      const companyName = deal.companies?.name || 'Неизвестно';
      const amount = parseFloat(deal.amount) || 0;

      if (companyRevenue.has(companyId)) {
        const existing = companyRevenue.get(companyId)!;
        existing.revenue += amount;
        existing.dealCount += 1;
      } else {
        companyRevenue.set(companyId, {
          name: companyName,
          revenue: amount,
          dealCount: 1
        });
      }
    });

    // Convert to array and sort by revenue
    const sortedCompanies = Array.from(companyRevenue.entries())
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.revenue - a.revenue);

    // Calculate cumulative percentage
    const totalRevenue = sortedCompanies.reduce((sum, c) => sum + c.revenue, 0);
    let cumulative = 0;
    
    const analysis = sortedCompanies.map((company, index) => {
      cumulative += company.revenue;
      const percentage = (company.revenue / totalRevenue) * 100;
      const cumulativePercentage = (cumulative / totalRevenue) * 100;
      
      let category = 'C';
      if (cumulativePercentage <= 80) category = 'A';
      else if (cumulativePercentage <= 95) category = 'B';

      return {
        ...company,
        rank: index + 1,
        percentage: percentage,
        cumulativePercentage: cumulativePercentage,
        category: category
      };
    });

    return c.json({
      totalRevenue,
      totalCompanies: sortedCompanies.length,
      analysis
    });
  } catch (error: any) {
    console.error("Error in ABC analysis:", error);
    return c.json({ error: error.message }, 500);
  }
});

// RFM Segmentation - Recency, Frequency, Monetary analysis
app.get("/make-server-f9553289/analytics/rfm-segmentation", async (c) => {
  try {
    if (!env("DATABASE_URL")) {
      return c.json({ error: "DATABASE_URL is not configured" }, 500);
    }

    const db = createClient();

    // Get date range from query params
    const startDate = c.req.query("startDate");
    const endDate = c.req.query("endDate");

    // Get all won deals with optional date filtering
    let query = db
      .from('deals')
      .select('id, company_id, amount, status, created_at, companies(id, name)')
      .eq('status', 'won')
      .order('created_at', { ascending: false });

    if (startDate) {
      query = query.gte('created_at', startDate);
    }
    if (endDate) {
      query = query.lte('created_at', endDate);
    }

    const { data: deals, error } = await query;

    if (error) throw error;

    const now = Date.now();
    const companyMetrics = new Map<string, { 
      name: string; 
      lastDealDate: number; 
      dealCount: number; 
      totalRevenue: number;
      recencyDays: number;
    }>();

    // Calculate metrics for each company
    deals?.forEach((deal: any) => {
      const companyId = deal.company_id;
      const companyName = deal.companies?.name || 'Неизвестно';
      const amount = parseFloat(deal.amount) || 0;
      const dealDate = new Date(deal.created_at).getTime();

      if (companyMetrics.has(companyId)) {
        const existing = companyMetrics.get(companyId)!;
        existing.dealCount += 1;
        existing.totalRevenue += amount;
        if (dealDate > existing.lastDealDate) {
          existing.lastDealDate = dealDate;
          existing.recencyDays = Math.floor((now - dealDate) / (1000 * 60 * 60 * 24));
        }
      } else {
        companyMetrics.set(companyId, {
          name: companyName,
          lastDealDate: dealDate,
          dealCount: 1,
          totalRevenue: amount,
          recencyDays: Math.floor((now - dealDate) / (1000 * 60 * 60 * 24))
        });
      }
    });

    // Convert to array for quartile calculation
    const companies = Array.from(companyMetrics.entries())
      .map(([id, data]) => ({ id, ...data }));

    // Calculate quartiles for R, F, M
    const sortedByRecency = [...companies].sort((a, b) => a.recencyDays - b.recencyDays);
    const sortedByFrequency = [...companies].sort((a, b) => b.dealCount - a.dealCount);
    const sortedByMonetary = [...companies].sort((a, b) => b.totalRevenue - a.totalRevenue);

    const getQuartile = (arr: any[], item: any, key: string) => {
      const index = arr.findIndex(c => c.id === item.id);
      const percentile = index / arr.length;
      if (percentile <= 0.25) return 4;
      if (percentile <= 0.5) return 3;
      if (percentile <= 0.75) return 2;
      return 1;
    };

    // Assign RFM scores
    const rfmAnalysis = companies.map(company => {
      const R = getQuartile(sortedByRecency, company, 'recencyDays');
      const F = getQuartile(sortedByFrequency, company, 'dealCount');
      const M = getQuartile(sortedByMonetary, company, 'totalRevenue');
      const rfmScore = `${R}${F}${M}`;

      // Segment classification
      let segment = 'At Risk';
      if (R >= 4 && F >= 4 && M >= 4) segment = 'Champions';
      else if (R >= 3 && F >= 3 && M >= 3) segment = 'Loyal Customers';
      else if (R >= 4 && F <= 2) segment = 'New Customers';
      else if (R <= 2 && F >= 3) segment = 'At Risk';
      else if (R <= 2 && F <= 2) segment = 'Lost';
      else if (R >= 3 && M >= 4) segment = 'Big Spenders';

      return {
        id: company.id,
        name: company.name,
        recencyDays: company.recencyDays,
        frequency: company.dealCount,
        monetary: company.totalRevenue,
        rfmScore,
        R, F, M,
        segment
      };
    });

    return c.json({
      totalCompanies: companies.length,
      analysis: rfmAnalysis.sort((a, b) => b.monetary - a.monetary)
    });
  } catch (error: any) {
    console.error("Error in RFM segmentation:", error);
    return c.json({ error: error.message }, 500);
  }
});

// Sales Funnel Conversion Analysis
app.get("/make-server-f9553289/analytics/funnel-conversion", async (c) => {
  try {
    if (!env("DATABASE_URL")) {
      return c.json({ error: "DATABASE_URL is not configured" }, 500);
    }

    const db = createClient();

    // Get date range from query params
    const startDate = c.req.query("startDate");
    const endDate = c.req.query("endDate");

    // Get all deals with optional date filtering
    let query = db
      .from('deals')
      .select('id, status, amount, created_at');

    if (startDate) {
      query = query.gte('created_at', startDate);
    }
    if (endDate) {
      query = query.lte('created_at', endDate);
    }

    const { data: deals, error } = await query;

    if (error) throw error;

    // Define funnel based on status
    const stages = ['open', 'won', 'lost'];
    const stageCounts = new Map<string, { count: number; totalValue: number }>();
    
    deals?.forEach((deal: any) => {
      const status = deal.status || 'open';
      const amount = parseFloat(deal.amount) || 0;
      
      if (stageCounts.has(status)) {
        const existing = stageCounts.get(status)!;
        existing.count += 1;
        existing.totalValue += amount;
      } else {
        stageCounts.set(status, { count: 1, totalValue: amount });
      }
    });

    const totalDeals = deals?.length || 0;

    const funnelData = stages.map((status, index) => {
      const stageData = stageCounts.get(status) || { count: 0, totalValue: 0 };
      const conversionRate = totalDeals > 0 ? (stageData.count / totalDeals) * 100 : 0;
      
      let dropoffRate = 0;
      if (index > 0) {
        const prevStatus = stages[index - 1];
        const prevCount = stageCounts.get(prevStatus)?.count || 0;
        dropoffRate = prevCount > 0 ? ((prevCount - stageData.count) / prevCount) * 100 : 0;
      }

      return {
        stage: status,
        count: stageData.count,
        totalValue: stageData.totalValue,
        avgDealSize: stageData.count > 0 ? stageData.totalValue / stageData.count : 0,
        conversionRate,
        dropoffRate
      };
    });

    // Calculate win rate
    const wonDeals = stageCounts.get('won')?.count || 0;
    const lostDeals = stageCounts.get('lost')?.count || 0;
    const winRate = (wonDeals + lostDeals) > 0 ? (wonDeals / (wonDeals + lostDeals)) * 100 : 0;

    return c.json({
      totalDeals,
      wonDeals,
      lostDeals,
      winRate,
      funnel: funnelData
    });
  } catch (error: any) {
    console.error("Error in funnel conversion analysis:", error);
    return c.json({ error: error.message }, 500);
  }
});

// Sales Forecast using AI (OpenAI)
app.get("/make-server-f9553289/analytics/sales-forecast", async (c) => {
  try {
    const openaiKey = env("OPENAI_API_KEY");
    
    if (!env("DATABASE_URL")) {
      return c.json({ error: "DATABASE_URL is not configured" }, 500);
    }

    const db = createClient();

    // Get historical won deals (last 12 months)
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const { data: deals, error } = await db
      .from('deals')
      .select('amount, created_at, status')
      .eq('status', 'won')
      .gte('created_at', oneYearAgo.toISOString())
      .order('created_at', { ascending: true });

    if (error) throw error;

    // Group by month
    const monthlyRevenue = new Map<string, number>();
    deals?.forEach((deal: any) => {
      const month = new Date(deal.created_at).toISOString().substring(0, 7); // YYYY-MM
      const amount = parseFloat(deal.amount) || 0;
      monthlyRevenue.set(month, (monthlyRevenue.get(month) || 0) + amount);
    });

    const historicalData = Array.from(monthlyRevenue.entries())
      .map(([month, revenue]) => ({ month, revenue }))
      .sort((a, b) => a.month.localeCompare(b.month));

    // Simple forecast: average growth rate
    if (historicalData.length < 2) {
      return c.json({
        historical: historicalData,
        forecast: [],
        message: "Недостаточно данных для прогноза (нужно минимум 2 месяца)"
      });
    }

    // Calculate average monthly growth
    let totalGrowth = 0;
    for (let i = 1; i < historicalData.length; i++) {
      const growth = (historicalData[i].revenue - historicalData[i-1].revenue) / historicalData[i-1].revenue;
      totalGrowth += growth;
    }
    const avgGrowth = totalGrowth / (historicalData.length - 1);

    // Forecast next 3 months
    const forecast = [];
    let lastRevenue = historicalData[historicalData.length - 1].revenue;
    const lastMonth = new Date(historicalData[historicalData.length - 1].month);

    for (let i = 1; i <= 3; i++) {
      lastMonth.setMonth(lastMonth.getMonth() + 1);
      lastRevenue = lastRevenue * (1 + avgGrowth);
      forecast.push({
        month: lastMonth.toISOString().substring(0, 7),
        predictedRevenue: Math.round(lastRevenue),
        confidence: Math.max(0.5, 0.9 - (i * 0.1)) // Decreasing confidence
      });
    }

    // If OpenAI is available, enhance forecast with AI insights
    let aiInsights = null;
    if (openaiKey) {
      try {
        const prompt = `На основе исторических данных продаж за последние месяцы:
${historicalData.map(d => `${d.month}: ${d.revenue.toLocaleString('uz-UZ')} сум`).join('\n')}

Текущий средний рост: ${(avgGrowth * 100).toFixed(1)}% в месяц

Дай краткий анализ (2-3 предложения):
1. Какой тренд наблюдается?
2. Есть ли сезонность?
3. Какие риски или возможности?`;

        const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${openaiKey}`
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.7,
            max_tokens: 300
          })
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          aiInsights = aiData.choices[0]?.message?.content || null;
        }
      } catch (e) {
        console.error("AI forecast error:", e);
      }
    }

    return c.json({
      historical: historicalData,
      forecast,
      avgGrowthRate: avgGrowth,
      aiInsights
    });
  } catch (error: any) {
    console.error("Error in sales forecast:", error);
    return c.json({ error: error.message }, 500);
  }
});

// Manager Performance Analysis
// Note: owner_id field doesn't exist yet, returning overall statistics
app.get("/make-server-f9553289/analytics/manager-performance", async (c) => {
  try {
    if (!env("DATABASE_URL")) {
      return c.json({ error: "DATABASE_URL is not configured" }, 500);
    }

    const db = createClient();

    // Get date range from query params
    const startDate = c.req.query("startDate");
    const endDate = c.req.query("endDate");

    // Get all deals with optional date filtering
    let query = db
      .from('deals')
      .select('id, amount, status, created_at');

    if (startDate) {
      query = query.gte('created_at', startDate);
    }
    if (endDate) {
      query = query.lte('created_at', endDate);
    }

    const { data: deals, error } = await query;

    if (error) throw error;

    // Since we don't have owner_id field, return overall statistics
    const totalDeals = deals?.length || 0;
    const wonDeals = deals?.filter(d => d.status === 'won').length || 0;
    const lostDeals = deals?.filter(d => d.status === 'lost').length || 0;
    const totalRevenue = deals?.filter(d => d.status === 'won').reduce((sum, d) => sum + (parseFloat(d.amount as any) || 0), 0) || 0;
    const avgDealSize = wonDeals > 0 ? totalRevenue / wonDeals : 0;
    const closedDeals = wonDeals + lostDeals;
    const winRate = closedDeals > 0 ? (wonDeals / closedDeals) * 100 : 0;

    // Return as single "System" manager until owner_id is added
    const performance = [{
      id: 'system',
      name: 'Все менеджеры',
      totalDeals,
      wonDeals,
      lostDeals,
      totalRevenue,
      avgDealSize,
      winRate
    }];

    return c.json({ performance });
  } catch (error: any) {
    console.error("Error in manager performance analysis:", error);
    return c.json({ error: error.message }, 500);
  }
});

// Lost Deals Analysis (Why deals are lost)
app.get("/make-server-f9553289/analytics/lost-deals", async (c) => {
  try {
    if (!env("DATABASE_URL")) {
      return c.json({ error: "DATABASE_URL is not configured" }, 500);
    }

    const db = createClient();

    // Get date range from query params
    const startDate = c.req.query("startDate");
    const endDate = c.req.query("endDate");

    // Get all lost deals with optional date filtering
    let query = db
      .from('deals')
      .select('id, title, amount, created_at, companies(name)')
      .eq('status', 'lost')
      .order('created_at', { ascending: false });

    if (startDate) {
      query = query.gte('created_at', startDate);
    }
    if (endDate) {
      query = query.lte('created_at', endDate);
    }

    const { data: deals, error } = await query;

    if (error) throw error;

    // Note: lost_reason field doesn't exist, showing generic reason
    const reasonCounts = new Map<string, { count: number; totalValue: number }>();
    
    deals?.forEach((deal: any) => {
      const reason = 'Причина не указана';
      const amount = parseFloat(deal.amount) || 0;
      
      if (reasonCounts.has(reason)) {
        const existing = reasonCounts.get(reason)!;
        existing.count += 1;
        existing.totalValue += amount;
      } else {
        reasonCounts.set(reason, { count: 1, totalValue: amount });
      }
    });

    const reasonAnalysis = Array.from(reasonCounts.entries())
      .map(([reason, data]) => ({
        reason,
        count: data.count,
        totalValue: data.totalValue,
        percentage: (data.count / (deals?.length || 1)) * 100
      }))
      .sort((a, b) => b.count - a.count);

    return c.json({
      totalLost: deals?.length || 0,
      totalLostValue: deals?.reduce((sum: number, d: any) => sum + (parseFloat(d.amount) || 0), 0) || 0,
      reasonAnalysis,
      recentLost: deals?.slice(0, 10).map((d: any) => ({
        id: d.id,
        title: d.title,
        company: d.companies?.name,
        amount: parseFloat(d.amount) || 0,
        reason: 'Не указана',
        date: d.created_at
      })) || []
    });
  } catch (error: any) {
    console.error("Error in lost deals analysis:", error);
    return c.json({ error: error.message }, 500);
  }
});

// ==================== ADVANCED ANALYTICS ENDPOINTS ====================

// Cohort Analysis - Customer retention and LTV by cohort
app.get("/make-server-f9553289/analytics/cohort-analysis", async (c) => {
  try {
    if (!env("DATABASE_URL")) {
      return c.json({ error: "DATABASE_URL is not configured" }, 500);
    }

    const db = createClient();

    // Get all won deals with company info
    const { data: deals, error } = await db
      .from('deals')
      .select('id, company_id, amount, status, created_at, companies(name)')
      .eq('status', 'won')
      .order('created_at', { ascending: true });

    if (error) throw error;

    // Group companies by their first purchase month (cohort)
    const companyCohorts = new Map<string, string>(); // company_id -> cohort_month
    const cohortData = new Map<string, {
      month: string;
      customers: Set<string>;
      revenue: number;
      dealCount: number;
      avgDealSize: number;
    }>();

    deals?.forEach((deal: any) => {
      const companyId = deal.company_id;
      const dealMonth = new Date(deal.created_at).toISOString().substring(0, 7);
      const amount = parseFloat(deal.amount) || 0;

      // Determine cohort (first purchase month)
      if (!companyCohorts.has(companyId)) {
        companyCohorts.set(companyId, dealMonth);
      }

      const cohortMonth = companyCohorts.get(companyId)!;

      if (!cohortData.has(cohortMonth)) {
        cohortData.set(cohortMonth, {
          month: cohortMonth,
          customers: new Set(),
          revenue: 0,
          dealCount: 0,
          avgDealSize: 0
        });
      }

      const cohort = cohortData.get(cohortMonth)!;
      cohort.customers.add(companyId);
      cohort.revenue += amount;
      cohort.dealCount += 1;
    });

    // Calculate CLV and retention for each cohort
    const cohorts = Array.from(cohortData.entries())
      .map(([month, data]) => {
        const customerCount = data.customers.size;
        const avgDealSize = data.dealCount > 0 ? data.revenue / data.dealCount : 0;
        const avgRevenuePerCustomer = customerCount > 0 ? data.revenue / customerCount : 0;
        
        // Calculate retention (simplified: how many customers made repeat purchases)
        const repeatCustomers = Array.from(data.customers).filter(customerId => {
          const customerDeals = deals?.filter(d => d.company_id === customerId) || [];
          return customerDeals.length > 1;
        }).length;
        const retentionRate = customerCount > 0 ? (repeatCustomers / customerCount) * 100 : 0;

        return {
          cohortMonth: month,
          customerCount,
          revenue: data.revenue,
          dealCount: data.dealCount,
          avgDealSize,
          avgRevenuePerCustomer,
          repeatCustomers,
          retentionRate,
          ltv: avgRevenuePerCustomer // Simplified LTV (actual LTV requires time period analysis)
        };
      })
      .sort((a, b) => a.cohortMonth.localeCompare(b.cohortMonth));

    return c.json({
      cohorts,
      totalCohorts: cohorts.length,
      avgRetentionRate: cohorts.reduce((sum, c) => sum + c.retentionRate, 0) / (cohorts.length || 1),
      totalCustomers: Array.from(companyCohorts.keys()).length
    });
  } catch (error: any) {
    console.error("Error in cohort analysis:", error);
    return c.json({ error: error.message }, 500);
  }
});

// Sales Velocity - Speed metrics
app.get("/make-server-f9553289/analytics/sales-velocity", async (c) => {
  try {
    if (!env("DATABASE_URL")) {
      return c.json({ error: "DATABASE_URL is not configured" }, 500);
    }

    const db = createClient();

    const startDate = c.req.query("startDate");
    const endDate = c.req.query("endDate");

    // Get all closed deals (won/lost)
    let query = db
      .from('deals')
      .select('id, amount, status, created_at')
      .in('status', ['won', 'lost']);

    if (startDate) query = query.gte('created_at', startDate);
    if (endDate) query = query.lte('created_at', endDate);

    const { data: dealsData, error } = await query;
    if (error) throw error;

    // Fetch excluded metadata and filter
    const meta = await kv.getByPrefix("deal-meta:");
    const excludedIds = new Set((meta || [])
        .filter((m: any) => m.excluded === true)
        .map((m: any) => m.id));
    
    // Filter deals to exclude hidden ones
    const deals = dealsData?.filter((d: any) => !excludedIds.has(d.id)) || [];

    const paymentsList = await kv.getByPrefix("payment:");
    const allPayments = (paymentsList || []).map((p: any) => ({
      dealId: p.dealId,
      date: p.date,
    }));

    // Calculate sales cycle length (created -> last payment date or current date)
    const cycles: number[] = [];
    deals.forEach((deal: any) => {
      const created = new Date(deal.created_at).getTime();
      
      // Find last payment date for this deal
      const dealPayments = allPayments?.filter((p: any) => p.dealId === deal.id) || [];
      let closeDate: number;
      
      if (dealPayments.length > 0) {
        // Use the latest payment date as close date
        const lastPaymentDate = dealPayments
          .map((p: any) => new Date(p.date).getTime())
          .sort((a, b) => b - a)[0];
        closeDate = lastPaymentDate;
      } else {
        // If no payments, use current date (deal is closed but not paid)
        closeDate = new Date().getTime();
      }
      
      const cycleDays = Math.max(0, Math.round((closeDate - created) / (1000 * 60 * 60 * 24)));
      cycles.push(cycleDays);
    });

    const avgSalesCycle = cycles.length > 0 
      ? cycles.reduce((sum, c) => sum + c, 0) / cycles.length 
      : 0;

    const wonDeals = deals?.filter(d => d.status === 'won') || [];
    const wonCycles = wonDeals.map((d: any) => {
      const created = new Date(d.created_at).getTime();
      
      // Find last payment date for won deals
      const dealPayments = allPayments?.filter((p: any) => p.dealId === d.id) || [];
      let closeDate: number;
      
      if (dealPayments.length > 0) {
        const lastPaymentDate = dealPayments
          .map((p: any) => new Date(p.date).getTime())
          .sort((a, b) => b - a)[0];
        closeDate = lastPaymentDate;
      } else {
        closeDate = new Date().getTime();
      }
      
      return Math.max(0, Math.round((closeDate - created) / (1000 * 60 * 60 * 24)));
    });
    const avgWonCycle = wonCycles.length > 0
      ? wonCycles.reduce((sum, c) => sum + c, 0) / wonCycles.length
      : 0;

    // Calculate velocity metrics
    const totalRevenue = wonDeals.reduce((sum, d) => sum + (parseFloat(d.amount as any) || 0), 0);
    const dealCount = wonDeals.length;
    const winRate = deals && deals.length > 0 ? (wonDeals.length / deals.length) * 100 : 0;

    // Velocity = (# of opportunities × deal value × win rate) / sales cycle length
    const avgDealValue = dealCount > 0 ? totalRevenue / dealCount : 0;
    const velocity = avgWonCycle > 0 
      ? (dealCount * avgDealValue * (winRate / 100)) / avgWonCycle 
      : 0;

    return c.json({
      avgSalesCycle: Math.round(avgSalesCycle),
      avgWonCycle: Math.round(avgWonCycle),
      totalDeals: deals?.length || 0,
      wonDeals: wonDeals.length,
      winRate,
      avgDealValue,
      velocity: Math.round(velocity),
      cycleDaysDistribution: {
        '0-7': cycles.filter(c => c <= 7).length,
        '8-30': cycles.filter(c => c > 7 && c <= 30).length,
        '31-60': cycles.filter(c => c > 30 && c <= 60).length,
        '61+': cycles.filter(c => c > 60).length
      }
    });
  } catch (error: any) {
    console.error("Error in sales velocity analysis:", error);
    return c.json({ error: error.message }, 500);
  }
});

// Time-based Activity Heatmap
app.get("/make-server-f9553289/analytics/activity-heatmap", async (c) => {
  try {
    if (!env("DATABASE_URL")) {
      return c.json({ error: "DATABASE_URL is not configured" }, 500);
    }

    const db = createClient();

    // Get all won deals
    const { data: deals, error } = await db
      .from('deals')
      .select('id, created_at, status')
      .eq('status', 'won');

    if (error) throw error;

    // Create heatmap data structure: [day of week][hour] = count
    const heatmap: number[][] = Array(7).fill(0).map(() => Array(24).fill(0));
    const dayNames = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];

    deals?.forEach((deal: any) => {
      const date = new Date(deal.created_at);
      const dayOfWeek = date.getDay(); // 0-6 (Sunday-Saturday)
      const hour = date.getHours(); // 0-23
      heatmap[dayOfWeek][hour]++;
    });

    // Find best time (highest activity)
    let maxCount = 0;
    let bestDay = 0;
    let bestHour = 0;

    for (let day = 0; day < 7; day++) {
      for (let hour = 0; hour < 24; hour++) {
        if (heatmap[day][hour] > maxCount) {
          maxCount = heatmap[day][hour];
          bestDay = day;
          bestHour = hour;
        }
      }
    }

    // Format data for frontend
    const heatmapData = heatmap.map((hours, dayIndex) => ({
      day: dayNames[dayIndex],
      dayIndex,
      hours: hours.map((count, hourIndex) => ({
        hour: hourIndex,
        count
      }))
    }));

    return c.json({
      heatmap: heatmapData,
      bestTime: {
        day: dayNames[bestDay],
        hour: bestHour,
        count: maxCount,
        timeRange: `${bestHour}:00 - ${bestHour + 1}:00`
      },
      totalDeals: deals?.length || 0
    });
  } catch (error: any) {
    console.error("Error in activity heatmap analysis:", error);
    return c.json({ error: error.message }, 500);
  }
});

// Advanced Sales Forecast with multiple methods
app.get("/make-server-f9553289/analytics/advanced-forecast", async (c) => {
  try {
    const openaiKey = env("OPENAI_API_KEY");
    
    if (!env("DATABASE_URL")) {
      return c.json({ error: "DATABASE_URL is not configured" }, 500);
    }

    const db = createClient();

    // Get historical won deals (last 12 months)
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const { data: deals, error } = await db
      .from('deals')
      .select('amount, created_at, status')
      .eq('status', 'won')
      .gte('created_at', oneYearAgo.toISOString())
      .order('created_at', { ascending: true });

    if (error) throw error;

    // Group by month
    const monthlyRevenue = new Map<string, number>();
    deals?.forEach((deal: any) => {
      const month = new Date(deal.created_at).toISOString().substring(0, 7);
      const amount = parseFloat(deal.amount) || 0;
      monthlyRevenue.set(month, (monthlyRevenue.get(month) || 0) + amount);
    });

    const historicalData = Array.from(monthlyRevenue.entries())
      .map(([month, revenue]) => ({ month, revenue }))
      .sort((a, b) => a.month.localeCompare(b.month));

    if (historicalData.length < 3) {
      return c.json({
        historical: historicalData,
        forecast: [],
        message: "Недостаточно данных для прогноза (нужно минимум 3 месяца)"
      });
    }

    // Method 1: Simple Moving Average (SMA)
    const smaWindow = Math.min(3, historicalData.length);
    const lastSMA = historicalData.slice(-smaWindow)
      .reduce((sum, d) => sum + d.revenue, 0) / smaWindow;

    // Method 2: Exponential Smoothing
    const alpha = 0.3; // Smoothing factor
    let emaValue = historicalData[0].revenue;
    historicalData.forEach(d => {
      emaValue = alpha * d.revenue + (1 - alpha) * emaValue;
    });

    // Method 3: Linear Regression
    const n = historicalData.length;
    const sumX = historicalData.reduce((sum, _, i) => sum + i, 0);
    const sumY = historicalData.reduce((sum, d) => sum + d.revenue, 0);
    const sumXY = historicalData.reduce((sum, d, i) => sum + i * d.revenue, 0);
    const sumX2 = historicalData.reduce((sum, _, i) => sum + i * i, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Generate 3-month forecast using all methods
    const forecast = [];
    const lastMonth = new Date(historicalData[historicalData.length - 1].month);

    for (let i = 1; i <= 3; i++) {
      lastMonth.setMonth(lastMonth.getMonth() + 1);
      
      // Linear regression prediction
      const lrPrediction = slope * (n + i - 1) + intercept;
      
      // Exponential smoothing prediction
      const esPrediction = emaValue;
      
      // Simple average of methods
      const avgPrediction = (lrPrediction + esPrediction + lastSMA) / 3;
      
      // Calculate confidence (decreases with distance)
      const confidence = Math.max(0.4, 0.85 - (i * 0.12));

      // Calculate prediction interval
      const stdDev = Math.sqrt(
        historicalData.reduce((sum, d, idx) => {
          const predicted = slope * idx + intercept;
          return sum + Math.pow(d.revenue - predicted, 2);
        }, 0) / n
      );
      
      forecast.push({
        month: lastMonth.toISOString().substring(0, 7),
        predictedRevenue: Math.round(avgPrediction),
        linearRegression: Math.round(lrPrediction),
        exponentialSmoothing: Math.round(esPrediction),
        movingAverage: Math.round(lastSMA),
        confidence,
        confidenceInterval: {
          lower: Math.round(avgPrediction - 1.96 * stdDev),
          upper: Math.round(avgPrediction + 1.96 * stdDev)
        }
      });
    }

    // Calculate trend metrics
    const recentRevenue = historicalData.slice(-3).reduce((sum, d) => sum + d.revenue, 0) / 3;
    const olderRevenue = historicalData.slice(-6, -3).reduce((sum, d) => sum + d.revenue, 0) / 3;
    const trendDirection = recentRevenue > olderRevenue ? 'рост' : 'снижение';
    const trendPercent = olderRevenue > 0 ? ((recentRevenue - olderRevenue) / olderRevenue) * 100 : 0;

    // If OpenAI is available, enhance with AI insights
    let aiInsights = null;
    if (openaiKey) {
      try {
        const prompt = `Анализ продаж за последние месяцы (в узбекских сумах):
${historicalData.map(d => `${d.month}: ${d.revenue.toLocaleString('uz-UZ')}`).join('\\n')}

Текущий тренд: ${trendDirection} ${Math.abs(trendPercent).toFixed(1)}%
Прогноз на след. месяц: ${forecast[0].predictedRevenue.toLocaleString('uz-UZ')}

Дай краткий бизнес-анализ (3-4 предложения):
1. Оценка текущей динамики и тренда
2. Выявление сезонности или паттернов
3. Основные риски или возможности
4. Рекомендации для повышения продаж`;

        const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${openaiKey}`
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.7,
            max_tokens: 400
          })
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          aiInsights = aiData.choices[0]?.message?.content || null;
        }
      } catch (e) {
        console.error("AI forecast error:", e);
      }
    }

    return c.json({
      historical: historicalData,
      forecast,
      trend: {
        direction: trendDirection,
        percent: trendPercent,
        recentAvg: recentRevenue,
        olderAvg: olderRevenue
      },
      methods: {
        linearRegression: { slope, intercept },
        exponentialSmoothing: { alpha, lastValue: emaValue },
        movingAverage: { window: smaWindow, value: lastSMA }
      },
      aiInsights
    });
  } catch (error: any) {
    console.error("Error in advanced forecast:", error);
    return c.json({ error: error.message }, 500);
  }
});

// Export analytics data to CSV format
app.get("/make-server-f9553289/analytics/export", async (c) => {
  try {
    const exportType = c.req.query("type") || "all"; // abc, rfm, funnel, all
    if (!env("DATABASE_URL")) {
      return c.json({ error: "DATABASE_URL is not configured" }, 500);
    }

    const db = createClient();

    let csvContent = "";

    if (exportType === "abc" || exportType === "all") {
      // Export ABC analysis
      const { data: deals } = await db
        .from('deals')
        .select('company_id, amount, companies(name)')
        .eq('status', 'won');

      const companyRevenue = new Map<string, { name: string; revenue: number }>();
      deals?.forEach((d: any) => {
        const id = d.company_id;
        const name = d.companies?.name || 'Unknown';
        const amt = parseFloat(d.amount) || 0;
        if (companyRevenue.has(id)) {
          companyRevenue.get(id)!.revenue += amt;
        } else {
          companyRevenue.set(id, { name, revenue: amt });
        }
      });

      const sorted = Array.from(companyRevenue.values())
        .sort((a, b) => b.revenue - a.revenue);
      
      const totalRev = sorted.reduce((sum, c) => sum + c.revenue, 0);
      let cumulative = 0;

      csvContent += "ABC Analysis\\n";
      csvContent += "Rank,Client Name,Revenue,Percentage,Cumulative %,Category\\n";
      
      sorted.forEach((c, idx) => {
        cumulative += c.revenue;
        const pct = (c.revenue / totalRev) * 100;
        const cumPct = (cumulative / totalRev) * 100;
        const cat = cumPct <= 80 ? 'A' : cumPct <= 95 ? 'B' : 'C';
        csvContent += `${idx + 1},"${c.name}",${c.revenue},${pct.toFixed(2)},${cumPct.toFixed(2)},${cat}\\n`;
      });

      csvContent += "\\n\\n";
    }

    return c.text(csvContent, 200, {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="sales-analytics-${new Date().toISOString().split('T')[0]}.csv"`
    });
  } catch (error: any) {
    console.error("Error in export:", error);
    return c.json({ error: error.message }, 500);
  }
});

// ==================== NEW WAREHOUSE FILTERING & ANALYTICS ENDPOINTS ====================

// Get Warehouse Movement History with Filters
app.get("/make-server-f9553289/warehouse/movements", async (c) => {
  try {
    const dateFrom = c.req.query('dateFrom');
    const dateTo = c.req.query('dateTo');
    const warehouses = c.req.query('warehouses')?.split(',') || [];
    const movementTypes = c.req.query('movementTypes')?.split(',') || [];
    const searchQuery = c.req.query('searchQuery')?.toLowerCase() || '';
    const articles = c.req.query('articles')?.split(',') || [];

    // Collect all movements
    const movements: any[] = [];

    // 1. Production logs
    if (movementTypes.length === 0 || movementTypes.includes('production')) {
      const logs = await kv.getByPrefix("production_log:") || [];
      logs.forEach((log: any) => {
        movements.push({
          id: log.id,
          type: 'production',
          date: log.date,
          warehouse: log.warehouse || 'AIKO',
          article: log.article || '',
          amount: log.amount || 0,
          unit: log.unit || 'кг',
          worker: log.worker || '',
          twistedWorker: log.twistedWorker || '',
          materialType: log.materialType || '',
          note: log.originalMessage || '',
          user: log.user || ''
        });
      });
    }

    // 2. Shipments
    if (movementTypes.length === 0 || movementTypes.includes('shipment')) {
      const shipments = await kv.getByPrefix("shipment:") || [];
      shipments.forEach((s: any) => {
        if (s.status === 'completed' && s.items && s.items.length > 0) {
          s.items.forEach((item: any) => {
            movements.push({
              id: `${s.id}_${item.id}`,
              type: 'shipment',
              date: s.date || item.date,
              warehouse: s.warehouse || 'AIKO',
              article: item.article || '',
              amount: -(parseFloat(item.weight) || 0), // Negative for outbound
              unit: 'кг',
              note: s.note || '',
              stickerClient: s.stickerClient || '',
              dealId: s.dealId || ''
            });
          });
        }
      });
    }

    // 3. Transfers
    if (movementTypes.length === 0 || movementTypes.includes('transfer')) {
      const transfers = await kv.getByPrefix("transfer:") || [];
      transfers.forEach((t: any) => {
        // Transfer OUT (from source warehouse)
        movements.push({
          id: `${t.id}_out`,
          type: 'transfer',
          subType: 'out',
          date: t.date,
          warehouse: t.fromWarehouse,
          article: t.article || '',
          amount: -(parseFloat(t.quantity) || 0), // Negative for outbound
          unit: 'кг',
          note: t.note || '',
          transferTo: t.toWarehouse,
          transferFrom: t.fromWarehouse
        });
        
        // Transfer IN (to destination warehouse)
        movements.push({
          id: `${t.id}_in`,
          type: 'transfer',
          subType: 'in',
          date: t.date,
          warehouse: t.toWarehouse,
          article: t.article || '',
          amount: parseFloat(t.quantity) || 0, // Positive for inbound
          unit: 'кг',
          note: t.note || '',
          transferTo: t.toWarehouse,
          transferFrom: t.fromWarehouse
        });
      });
    }

    // 4. Corrections
    if (movementTypes.length === 0 || movementTypes.includes('correction')) {
      const corrections = await kv.getByPrefix("correction:") || [];
      corrections.forEach((corr: any) => {
        const diff = (parseFloat(corr.realAmount) || 0) - (parseFloat(corr.systemAmount) || 0);
        if (Math.abs(diff) > 0.01) {
          movements.push({
            id: corr.id,
            type: 'correction',
            date: corr.date,
            warehouse: corr.warehouse,
            article: corr.article || '',
            amount: diff,
            unit: corr.unit || 'кг',
            note: corr.note || 'Корректировка остатков',
            systemAmount: corr.systemAmount,
            realAmount: corr.realAmount,
            image: corr.image || ''
          });
        }
      });
    }

    // Apply filters
    let filtered = movements;

    // Date filter
    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      filtered = filtered.filter(m => new Date(m.date) >= fromDate);
    }
    if (dateTo) {
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999); // End of day
      filtered = filtered.filter(m => new Date(m.date) <= toDate);
    }

    // Warehouse filter
    if (warehouses.length > 0) {
      filtered = filtered.filter(m => warehouses.includes(m.warehouse));
    }

    // Article filter
    if (articles.length > 0) {
      filtered = filtered.filter(m => articles.includes(m.article));
    }

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(m => 
        (m.article?.toLowerCase().includes(searchQuery)) ||
        (m.note?.toLowerCase().includes(searchQuery)) ||
        (m.worker?.toLowerCase().includes(searchQuery)) ||
        (m.twistedWorker?.toLowerCase().includes(searchQuery)) ||
        (m.stickerClient?.toLowerCase().includes(searchQuery))
      );
    }

    // Sort by date descending (newest first)
    filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return c.json(filtered);
  } catch (error: any) {
    console.error("Error fetching warehouse movements:", error);
    return c.json({ error: error.message }, 500);
  }
});

// Get Monthly Statistics
app.get("/make-server-f9553289/warehouse/monthly-stats", async (c) => {
  try {
    const dateFrom = c.req.query('dateFrom');
    const dateTo = c.req.query('dateTo');
    
    // Get selected warehouses as array from query parameters
    const warehousesParam = c.req.queries('warehouses') || [];
    const selectedWarehouses = Array.isArray(warehousesParam) ? warehousesParam : [warehousesParam];
    const filterByWarehouses = selectedWarehouses.length > 0;

    // Get all production logs and shipments
    const logs = await kv.getByPrefix("production_log:") || [];
    const shipments = await kv.getByPrefix("shipment:") || [];
    const transfers = await kv.getByPrefix("transfer:") || [];
    const corrections = await kv.getByPrefix("correction:") || [];

    // Structure: { "YYYY-MM": { warehouse: { produced, shipped, transferred, corrected } } }
    const monthlyStats: Record<string, Record<string, any>> = {};

    const getMonthKey = (date: string) => {
      const d = new Date(date);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    };

    const initMonth = (monthKey: string, wh: string) => {
      if (!monthlyStats[monthKey]) monthlyStats[monthKey] = {};
      if (!monthlyStats[monthKey][wh]) {
        monthlyStats[monthKey][wh] = {
          produced: 0,
          shipped: 0,
          transferredIn: 0,
          transferredOut: 0,
          corrected: 0,
          producedByArticle: {} as Record<string, number>,
          shippedByArticle: {} as Record<string, number>
        };
      }
    };

    // Process production logs
    logs.forEach((log: any) => {
      const monthKey = getMonthKey(log.date);
      const wh = log.warehouse || 'AIKO';
      
      // Apply filters
      if (dateFrom && new Date(log.date) < new Date(dateFrom)) return;
      if (dateTo && new Date(log.date) > new Date(dateTo)) return;
      if (filterByWarehouses && !selectedWarehouses.includes(wh)) return;

      initMonth(monthKey, wh);
      const amount = log.amount || 0;
      monthlyStats[monthKey][wh].produced += amount;
      
      const art = log.article || 'Без артикула';
      monthlyStats[monthKey][wh].producedByArticle[art] = 
        (monthlyStats[monthKey][wh].producedByArticle[art] || 0) + amount;
    });

    // Process shipments
    shipments.forEach((s: any) => {
      if (s.status !== 'completed') return;
      
      const monthKey = getMonthKey(s.date);
      const wh = s.warehouse || 'AIKO';
      
      if (dateFrom && new Date(s.date) < new Date(dateFrom)) return;
      if (dateTo && new Date(s.date) > new Date(dateTo)) return;
      if (filterByWarehouses && !selectedWarehouses.includes(wh)) return;

      initMonth(monthKey, wh);
      
      s.items.forEach((item: any) => {
        const weight = parseFloat(item.weight) || 0;
        monthlyStats[monthKey][wh].shipped += weight;
        
        const art = item.article || 'Без артикула';
        monthlyStats[monthKey][wh].shippedByArticle[art] = 
          (monthlyStats[monthKey][wh].shippedByArticle[art] || 0) + weight;
      });
    });

    // Process transfers
    transfers.forEach((t: any) => {
      const monthKey = getMonthKey(t.date);
      const fromWh = t.fromWarehouse;
      const toWh = t.toWarehouse;
      const qty = parseFloat(t.quantity) || 0;
      
      if (dateFrom && new Date(t.date) < new Date(dateFrom)) return;
      if (dateTo && new Date(t.date) > new Date(dateTo)) return;

      if (!filterByWarehouses || selectedWarehouses.includes(fromWh)) {
        initMonth(monthKey, fromWh);
        monthlyStats[monthKey][fromWh].transferredOut += qty;
      }
      
      if (!filterByWarehouses || selectedWarehouses.includes(toWh)) {
        initMonth(monthKey, toWh);
        monthlyStats[monthKey][toWh].transferredIn += qty;
      }
    });

    // Process corrections
    corrections.forEach((corr: any) => {
      const monthKey = getMonthKey(corr.date);
      const wh = corr.warehouse;
      const diff = (parseFloat(corr.realAmount) || 0) - (parseFloat(corr.systemAmount) || 0);
      
      if (dateFrom && new Date(corr.date) < new Date(dateFrom)) return;
      if (dateTo && new Date(corr.date) > new Date(dateTo)) return;
      if (filterByWarehouses && !selectedWarehouses.includes(wh)) return;

      initMonth(monthKey, wh);
      monthlyStats[monthKey][wh].corrected += diff;
    });

    // Convert to sorted array format
    const result = Object.entries(monthlyStats)
      .map(([month, warehouses]) => ({
        month,
        warehouses
      }))
      .sort((a, b) => b.month.localeCompare(a.month)); // Newest first

    return c.json(result);
  } catch (error: any) {
    console.error("Error fetching monthly statistics:", error);
    return c.json({ error: error.message }, 500);
  }
});

// Get Available Articles (for filters)
app.get("/make-server-f9553289/warehouse/available-articles", async (c) => {
  try {
    const articlesSet = new Set<string>();

    // Get from production logs
    const logs = await kv.getByPrefix("production_log:") || [];
    logs.forEach((log: any) => {
      if (log.article && log.article.trim()) {
        articlesSet.add(log.article.trim());
      }
    });

    // Get from recipes/products
    const products = await kv.getByPrefix("product:") || [];
    products.forEach((p: any) => {
      if (p.name && p.name.trim()) {
        articlesSet.add(p.name.trim());
      }
    });

    const articles = Array.from(articlesSet).sort();
    return c.json(articles);
  } catch (error: any) {
    console.error("Error fetching available articles:", error);
    return c.json({ error: error.message }, 500);
  }
});

// Nexus Brain Endpoint
app.post("/make-server-f9553289/nexus", async (c) => {
  try {
    const body = await c.req.json();
    const { transcript, context, userId } = body;
    
    // Basic validation
    if (!transcript) return c.json({ error: "No input provided" }, 400);

    const result = await processNexusRequest(userId || 'anon', transcript, context || {});
    return c.json(result);
  } catch (error: any) {
    console.error("Nexus Endpoint Error:", error);
    return c.json({ error: error.message }, 500);
  }
});

export default app;