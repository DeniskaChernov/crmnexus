import type { AiChatClientPayload, CrmAiFocusPayload } from "../lib/aiChatClientPayload.ts";
import * as kv from "./kv_store.ts";

function takeData(res: { data?: any; error?: any }) {
  if (res?.error) return [];
  return res?.data ?? [];
}

type AnyDb = {
  from: (t: string) => {
    select: (s: string) => {
      order: (col: string, opts?: { ascending?: boolean }) => {
        limit?: (n: number) => { gte?: (col: string, v: unknown) => any } & Promise<{ data: any; error: any }>;
        gte?: (col: string, v: unknown) => any;
      } & Promise<{ data: any; error: any }>;
    };
  };
};

const fmtUZS = (n: number) =>
  new Intl.NumberFormat("uz-UZ", { maximumFractionDigits: 0 }).format(Math.round(n));

function termsFromText(text: string): string[] {
  return text
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter((t) => t.length > 2);
}

function oneLine(s: string, max: number) {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

function digestValue(v: unknown, max: number) {
  try {
    return oneLine(JSON.stringify(v), max);
  } catch {
    return "—";
  }
}

/** Доп. выборка по сущности в фокусе UI (глубже, чем общий снимок). */
async function loadFocusDeepDive(db: AnyDb, focus: CrmAiFocusPayload | null | undefined, paymentBlobs: any[]) {
  if (!focus?.id) return "";
  const q: any = db;
  const lines: string[] = [];
  try {
    if (focus.kind === "deal") {
      const res = await q
        .from("deals")
        .select(
          "id, title, amount, status, lost_reason, created_at, updated_at, company_id, contact_id, stage_id, pipeline_id, companies(name, phone, email), contacts(first_name, last_name, phone, email), stages(name), pipelines(name)",
        )
        .eq("id", focus.id)
        .limit(1);
      const row = takeData(res)[0];
      if (!row) {
        lines.push(`Сделка id=${focus.id} не найдена в БД.`);
      } else {
        lines.push(
          `СДЕЛКА: «${row.title || "—"}» | ${fmtUZS(Number(row.amount) || 0)} UZS | ${row.status} | этап: ${row.stages?.name || "—"} | воронка: ${row.pipelines?.name || "—"}`,
        );
        lines.push(
          `Компания: ${row.companies?.name || "—"} | тел. ${row.companies?.phone || "—"} | email: ${row.companies?.email || "—"}`,
        );
        const cn = [row.contacts?.first_name, row.contacts?.last_name].filter(Boolean).join(" ");
        lines.push(
          `Контакт: ${cn || "—"} | ${row.contacts?.phone || "—"} | ${row.contacts?.email || "—"}`,
        );
        lines.push(`Обновлено: ${row.updated_at || "—"} | создано: ${row.created_at || "—"} | причина проигрыша: ${row.lost_reason || "—"}`);
      }
      const tRes = await q
        .from("tasks")
        .select("id, title, priority, status, due_date")
        .eq("deal_id", focus.id)
        .order("due_date", { ascending: true });
      const trows = takeData(tRes);
      lines.push(`Задачи по сделке (${trows.length}):`);
      for (const t of trows.slice(0, 20)) {
        lines.push(
          `  - ${t.title} | ${t.status} | ${t.priority || "—"} | до ${t.due_date ? new Date(t.due_date).toLocaleString("ru-RU") : "—"}`,
        );
      }
      const paySum = (paymentBlobs || [])
        .filter((p: any) => String(p?.dealId) === String(focus.id))
        .reduce((s: number, p: any) => s + (Number(p?.amount) || 0), 0);
      lines.push(`Оплаты в KV по этой сделке (сумма amount): ≈ ${fmtUZS(paySum)} UZS`);
    } else if (focus.kind === "task") {
      const res = await q
        .from("tasks")
        .select(
          "id, title, description, priority, status, due_date, deal_id, contact_id, deals(id, title, amount, status), contacts(first_name, last_name, phone)",
        )
        .eq("id", focus.id)
        .limit(1);
      const row = takeData(res)[0];
      if (!row) lines.push(`Задача id=${focus.id} не найдена.`);
      else {
        lines.push(
          `ЗАДАЧА: ${row.title} | ${row.status} | ${row.priority || "—"} | до ${row.due_date ? new Date(row.due_date).toLocaleString("ru-RU") : "—"}`,
        );
        if (row.description) lines.push(`Описание: ${oneLine(String(row.description), 400)}`);
        lines.push(
          `Сделка: ${row.deals?.title || row.deal_id || "—"} | контакт: ${[row.contacts?.first_name, row.contacts?.last_name].filter(Boolean).join(" ") || "—"}`,
        );
      }
    } else if (focus.kind === "company") {
      const res = await q.from("companies").select("*").eq("id", focus.id).limit(1);
      const row = takeData(res)[0];
      if (!row) lines.push(`Компания id=${focus.id} не найдена.`);
      else {
        lines.push(`КОМПАНИЯ: ${row.name} | ${row.status || "—"} | ${row.city || "—"} | ${row.phone || "—"} | ${row.email || "—"}`);
        lines.push(digestValue(row, 500));
      }
      const cRes = await q
        .from("contacts")
        .select("id, first_name, last_name, phone, email, position")
        .eq("company_id", focus.id)
        .limit(18);
      const crows = takeData(cRes);
      lines.push(`Контакты компании (${crows.length} показано до 18):`);
      for (const c of crows) {
        lines.push(`  - ${[c.first_name, c.last_name].filter(Boolean).join(" ")} | ${c.phone || "—"} | ${c.position || ""}`);
      }
      const dRes = await q
        .from("deals")
        .select("id, title, amount, status, stages(name)")
        .eq("company_id", focus.id)
        .order("updated_at", { ascending: false })
        .limit(12);
      const drows = takeData(dRes);
      lines.push(`Сделки компании (до 12):`);
      for (const d of drows) {
        lines.push(`  - «${d.title}» | ${fmtUZS(Number(d.amount) || 0)} UZS | ${d.status} | ${d.stages?.name || "—"}`);
      }
    } else if (focus.kind === "contact") {
      const res = await q
        .from("contacts")
        .select("id, first_name, last_name, phone, email, position, company_id, companies(name, phone)")
        .eq("id", focus.id)
        .limit(1);
      const row = takeData(res)[0];
      if (!row) lines.push(`Контакт id=${focus.id} не найден.`);
      else {
        lines.push(
          `КОНТАКТ: ${[row.first_name, row.last_name].filter(Boolean).join(" ")} | ${row.phone || "—"} | ${row.email || "—"} | ${row.position || ""}`,
        );
        lines.push(`Компания: ${row.companies?.name || "—"} (${row.company_id || "—"})`);
      }
      const dRes = await q
        .from("deals")
        .select("id, title, amount, status, stages(name)")
        .eq("contact_id", focus.id)
        .order("updated_at", { ascending: false })
        .limit(12);
      const drows = takeData(dRes);
      lines.push(`Сделки с этим контактом (до 12):`);
      for (const d of drows) {
        lines.push(`  - «${d.title}» | ${fmtUZS(Number(d.amount) || 0)} UZS | ${d.status}`);
      }
    } else if (focus.kind === "lead") {
      const res = await q.from("leads").select("*").eq("id", focus.id).limit(1);
      const row = takeData(res)[0];
      if (!row) lines.push(`Лид id=${focus.id} не найден.`);
      else lines.push(`ЛИД: ${digestValue(row, 800)}`);
    }
  } catch (e: any) {
    lines.push(`(ошибка загрузки фокуса: ${e?.message || e})`);
  }
  return lines.filter(Boolean).join("\n");
}

/** Параллельная загрузка сущностей CRM + KV для максимально полного контекста ИИ. */
export async function buildAiChatContext(
  db: AnyDb,
  lastUserText: string,
  client?: AiChatClientPayload | null,
) {
  const now = new Date();
  const monthKey = `sales-plan-${now.getFullYear()}-${now.getMonth() + 1}`;

  const [
    dealsRes,
    tasksRes,
    companiesRes,
    contactsRes,
    leadsRes,
    pipelinesRes,
    eventsFutureRes,
    eventsPastRes,
    usersRes,
    salesPlan,
    recipes,
    paymentBlobs,
    dealMetaBlobs,
    marketingReportsKv,
    marketingEventsKv,
    productionEventsKv,
    employeesKv,
  ] = await Promise.all([
    db
      .from("deals")
      .select("id, amount, status, created_at, updated_at, lost_reason, stage_id, pipeline_id, title, companies(name), stages(name)")
      .order("created_at", { ascending: false }),
    db
      .from("tasks")
      .select("id, title, description, priority, status, due_date, assigned_to, deal_id, contact_id, created_at")
      .order("due_date", { ascending: true }),
    db
      .from("companies")
      .select("id, name, industry, phone, email, status, city, type, created_at")
      .order("created_at", { ascending: false }),
    db
      .from("contacts")
      .select("id, first_name, last_name, position, phone, email, company_id, companies(name)")
      .order("created_at", { ascending: false }),
    db.from("leads").select("id, name, phone, status, source, info, country, created_at").order("created_at", { ascending: false }),
    db.from("pipelines").select("id, name, description, is_default, stages(id, name, order)").order("created_at", { ascending: false }),
    db
      .from("calendar_events")
      .select("id, title, start, end, type")
      .gte("start", now.toISOString())
      .order("start", { ascending: true })
      .limit(25),
    db
      .from("calendar_events")
      .select("id, title, start, end, type")
      .order("start", { ascending: false })
      .limit(8),
    db.from("crm_users").select("email, name, role").order("email", { ascending: true }),
    kv.get(monthKey),
    kv.getByPrefix("recipe-"),
    kv.getByPrefix("payment:"),
    kv.getByPrefix("deal-meta:"),
    kv.getByPrefixRecent("marketing:report:", 8),
    kv.getByPrefixRecent("marketing:event:", 10),
    kv.getByPrefixRecent("production_event:", 14),
    kv.getByPrefixRecent("employee:", 40),
  ]);

  const deals = takeData(dealsRes);
  const tasks = takeData(tasksRes);
  const companies = takeData(companiesRes);
  const contacts = takeData(contactsRes);
  const leads = takeData(leadsRes);
  const pipelines = takeData(pipelinesRes);
  const eventsFuture = takeData(eventsFutureRes);
  const eventsPast = takeData(eventsPastRes);
  const users = takeData(usersRes);

  const marketingReportsLines =
    (marketingReportsKv || [])
      .slice(0, 8)
      .map((r, i) => `${i + 1}. ${r.key}: ${digestValue(r.value, 220)}`)
      .join("\n") || "—";
  const marketingEventsLines =
    (marketingEventsKv || [])
      .slice(0, 10)
      .map((r, i) => `${i + 1}. ${r.key}: ${digestValue(r.value, 220)}`)
      .join("\n") || "—";
  const productionEventsLines =
    (productionEventsKv || [])
      .slice(0, 14)
      .map((r, i) => `${i + 1}. ${r.key}: ${digestValue(r.value, 240)}`)
      .join("\n") || "—";
  const employeesKvLines =
    (employeesKv || [])
      .slice(0, 40)
      .map((r, i) => `${i + 1}. ${r.key}: ${digestValue(r.value, 180)}`)
      .join("\n") || "—";

  const excludedIds = new Set(
    (dealMetaBlobs || []).filter((m: any) => m?.excluded === true).map((m: any) => m?.id).filter(Boolean),
  );
  const dealsVisible = deals.filter((d: any) => !excludedIds.has(d.id));

  const totalDeals = dealsVisible.length;
  const totalAmount = dealsVisible.reduce((s: number, d: any) => s + (Number(d.amount) || 0), 0);
  const wonDeals = dealsVisible.filter((d: any) => d.status === "won").length;
  const lostDeals = dealsVisible.filter((d: any) => d.status === "lost").length;
  const openDeals = dealsVisible.filter((d: any) => d.status === "open").length;
  const avgDealSize = totalDeals > 0 ? Math.round(totalAmount / totalDeals) : 0;
  const conversionRate =
    wonDeals + lostDeals > 0 ? Math.round((wonDeals / (wonDeals + lostDeals)) * 100) : 0;

  const openList = dealsVisible.filter((d: any) => d.status === "open");
  const recentOpenDeals =
    openList
      .slice(0, 18)
      .map(
        (d: any) =>
          `- «${d.title || "Без названия"}» | ${fmtUZS(Number(d.amount) || 0)} UZS | этап: ${d.stages?.name || "—"} | компания: ${d.companies?.name || "—"} | обновлено: ${d.updated_at ? new Date(d.updated_at).toLocaleDateString("ru-RU") : "—"}`,
      )
      .join("\n") || "Нет открытых сделок";

  const staleOpenDays = 14;
  const staleOpen = openList.filter((d: any) => {
    const t = new Date(d.updated_at || d.created_at).getTime();
    return Date.now() - t > staleOpenDays * 86400000;
  }).length;

  const wonRecent = dealsVisible
    .filter((d: any) => d.status === "won")
    .slice(0, 12)
    .map(
      (d: any) =>
        `- «${d.title || "—"}» ${fmtUZS(Number(d.amount) || 0)} UZS | ${d.companies?.name || "—"} | ${new Date(d.updated_at || d.created_at).toLocaleDateString("ru-RU")}`,
    )
    .join("\n");

  const lostRecent = dealsVisible
    .filter((d: any) => d.status === "lost")
    .slice(0, 10)
    .map(
      (d: any) =>
        `- «${d.title || "—"}» ${fmtUZS(Number(d.amount) || 0)} UZS | причина: ${d.lost_reason || "—"} | ${d.companies?.name || "—"}`,
    )
    .join("\n");

  const stageHistogram: Record<string, number> = {};
  for (const d of openList) {
    const k = d.stages?.name || "Без этапа";
    stageHistogram[k] = (stageHistogram[k] || 0) + 1;
  }
  const stageLines = Object.entries(stageHistogram)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `- ${k}: ${v} сдел.`);

  const safeTasks = tasks;
  const highPriorityTasks =
    safeTasks
      .filter((t: any) => t.status !== "done" && t.priority === "high")
      .slice(0, 12)
      .map(
        (t: any) =>
          `- [высокий] ${t.title} | до ${t.due_date ? new Date(t.due_date).toLocaleString("ru-RU") : "—"} | сделка: ${t.deal_id || "—"}`,
      )
      .join("\n") || "Нет задач с высоким приоритетом";

  const mediumTasks =
    safeTasks
      .filter((t: any) => t.status !== "done" && t.priority === "medium")
      .slice(0, 10)
      .map((t: any) => `- [средний] ${t.title} | до ${t.due_date ? new Date(t.due_date).toLocaleDateString("ru-RU") : "—"}`)
      .join("\n");

  const overdueTasks = safeTasks.filter(
    (t: any) => t.status !== "done" && t.due_date && new Date(t.due_date) < now,
  ).length;

  const overdueList =
    safeTasks
      .filter((t: any) => t.status !== "done" && t.due_date && new Date(t.due_date) < now)
      .slice(0, 15)
      .map(
        (t: any) =>
          `- ПРОСРОЧЕНО: ${t.title} (${new Date(t.due_date).toLocaleDateString("ru-RU")}) | приоритет: ${t.priority || "—"}`,
      )
      .join("\n") || "Нет просроченных задач";

  const upcomingTasks = safeTasks
    .filter((t: any) => t.status !== "done" && t.due_date && new Date(t.due_date) >= now)
    .slice(0, 12)
    .map((t: any) => `- ${t.title} → ${new Date(t.due_date).toLocaleString("ru-RU")}`)
    .join("\n");

  const searchTerms = termsFromText(lastUserText);
  let foundCompaniesStr = "";
  if (searchTerms.length > 0) {
    const found = companies.filter((c: any) =>
      searchTerms.some((term) => (c.name || "").toLowerCase().includes(term)),
    );
    if (found.length > 0) {
      foundCompaniesStr = found
        .slice(0, 20)
        .map(
          (c: any) =>
            `- [по тексту чата] ${c.name} | ${c.phone || "—"} | ${c.email || "—"} | ${c.city || ""} ${c.status || ""}`,
        )
        .join("\n");
    }
  }

  const recentCompanies =
    companies
      .slice(0, 28)
      .map(
        (c: any) =>
          `- ${c.name} | статус: ${c.status || "—"} | ${c.city || "—"} | ${c.industry || "—"} | тел. ${c.phone || "—"}`,
      )
      .join("\n") || "—";

  const contactsBlock =
    contacts
      .slice(0, 28)
      .map((c: any) => {
        const nm =
          (c.name || [c.first_name, c.last_name].filter(Boolean).join(" ")).trim() || "—";
        return `- ${nm} | ${c.companies?.name || "без компании"} | ${c.phone || "—"} | ${c.email || "—"} | ${c.position || ""}`;
      })
      .join("\n") || "—";

  const leadsBlock =
    leads
      .slice(0, 25)
      .map((l: any) => `- ${l.name} | ${l.phone} | статус: ${l.status} | источник: ${l.source || "—"}`)
      .join("\n") || "—";

  const pipelinesDetail =
    pipelines
      .map((p: any) => {
        const stages = Array.isArray(p.stages)
          ? p.stages
              .map((s: any) => `${s.order ?? s.order_index ?? "?"}:${s.name}`)
              .join(" → ")
          : "";
        return `- ${p.name}${p.is_default ? " (по умолчанию)" : ""}: ${stages || "этапы не заданы"}`;
      })
      .join("\n") || "—";

  const upcomingEvents =
    eventsFuture
      .map((e: any) => {
        const s = e.start ? new Date(e.start).toLocaleString("ru-RU") : "—";
        return `- ${e.title} | ${s} | ${e.type || "—"}`;
      })
      .join("\n") || "Нет предстоящих событий";

  const pastEvents =
    eventsPast
      .map((e: any) => `- ${e.title} | ${e.start ? new Date(e.start).toLocaleDateString("ru-RU") : "—"}`)
      .join("\n") || "—";

  const planData = salesPlan as any;
  const salesPlanSummary = planData ? `${planData.target || 0} / ${planData.actual || 0} UZS (план месяца)` : "план не задан в KV";

  const recipesArr = recipes || [];
  const totalRecipes = recipesArr.length;

  let paymentTotal = 0;
  const paymentsByDeal: Record<string, number> = {};
  for (const p of paymentBlobs || []) {
    const a = Number((p as any).amount) || 0;
    paymentTotal += a;
    const id = (p as any).dealId;
    if (id) paymentsByDeal[String(id)] = (paymentsByDeal[String(id)] || 0) + a;
  }
  const topPaidDeals = Object.entries(paymentsByDeal)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([dealId, sum]) => {
      const d = dealsVisible.find((x: any) => x.id === dealId);
      return `- ${d?.title || dealId.slice(0, 8)}: ${fmtUZS(sum)} UZS оплачено`;
    })
    .join("\n");

  const usersBlock =
    users
      .map((u: any) => `- ${u.email} | ${u.name || "—"} | роль: ${u.role}`)
      .join("\n") || "—";

  const focusDeep = await loadFocusDeepDive(db, client?.focus, paymentBlobs || []);

  const navHeader: string[] = [];
  if (client?.pathname) {
    navHeader.push(`Маршрут: ${client.pathname}${client.search || ""}`);
  }
  if (client?.pageLabel) navHeader.push(`Раздел UI: ${client.pageLabel}`);
  if (client?.sentAt) navHeader.push(`Время отправки с клиента: ${client.sentAt}`);
  if (client?.focus) {
    navHeader.push(
      `Фокус: ${client.focus.kind} id=${client.focus.id}${client.focus.label ? ` — ${client.focus.label}` : ""}`,
    );
  }
  const navigationContext = navHeader.join("\n") || "контекст экрана не передан — опирайся на общий дамп";

  const fullSnapshot = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📦 РАСШИРЕННЫЙ СНИМОК CRM (все основные сущности; скрытые сделки deal-meta excluded=${excludedIds.size})
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🖥 НАВИГАЦИЯ И ФОКУС ПОЛЬЗОВАТЕЛЯ (учитывай в первую очередь для формулировок «сейчас», «эта сделка»):
${navigationContext}

🔎 ДЕТАЛИЗАЦИЯ ФОКУСА (если задано):
${focusDeep || "—"}

👥 ПОЛЬЗОВАТЕЛИ СИСТЕМЫ (crm_users):
${usersBlock}

💼 СДЕЛКИ: всего ${totalDeals}, открытых ${openDeals}, выиграно ${wonDeals}, проиграно ${lostDeals}
   Сумма amount по всем видимым: ${fmtUZS(totalAmount)} UZS | ср. чек: ${fmtUZS(avgDealSize)} | конверсия won/(won+lost): ${conversionRate}%
   Открытые без движения >${staleOpenDays}д: ${staleOpen}

📍 Открытые сделки (до 18):
${recentOpenDeals}

✅ Недавно выигранные (до 12):
${wonRecent || "—"}

❌ Недавно проигранные (до 10):
${lostRecent || "—"}

📊 Открытые по этапам:
${stageLines.join("\n") || "—"}

💳 ОПЛАТЫ (KV payment:): всего по сумме amount ≈ ${fmtUZS(paymentTotal)} UZS
${topPaidDeals || "нет разнесённых оплат в KV"}

✅ Задачи: всего ${tasks.length}, просрочено ${overdueTasks}
Просроченные (до 15):
${overdueList}

🔥 Высокий приоритет (до 12):
${highPriorityTasks}

⚡ Средний приоритет (до 10):
${mediumTasks || "—"}

📌 Ближайшие по сроку (до 12):
${upcomingTasks || "—"}

🏢 Компании (до 28):
${recentCompanies}

👤 Контакты (до 28):
${contactsBlock}

🎯 Лиды (до 25):
${leadsBlock}

🔄 Воронки и этапы:
${pipelinesDetail}

📅 Календарь: предстоящие (до 25):
${upcomingEvents}

📅 Недавние прошедшие события (до 8):
${pastEvents}

💰 План продаж (KV): ${salesPlanSummary}

🏭 Рецепты (KV recipe-): записей ${totalRecipes}

📣 Маркетинг — отчёты (KV marketing:report:, последние по updated_at):
${marketingReportsLines}

📣 Маркетинг — события (KV marketing:event:):
${marketingEventsLines}

🏭 Производство — события календаря (KV production_event:, выборка):
${productionEventsLines}

👷 Сотрудники / графики (KV employee:, выборка):
${employeesKvLines}
`.trim();

  return {
    totalDeals,
    totalAmount,
    wonDeals,
    lostDeals,
    openDeals,
    avgDealSize,
    conversionRate,
    recentOpenDeals: recentOpenDeals.split("\n").slice(0, 8).join("\n"),
    tasksLength: tasks.length,
    highPriorityTasks,
    overdueTasks,
    totalCompanies: companies.length,
    recentCompanies: companies.slice(0, 12).map((c: any) => `- ${c.name}`).join("\n") || "NONE",
    foundCompanies: foundCompaniesStr,
    totalContacts: contacts.length,
    totalLeads: leads.length,
    newLeads: leads.filter((l: any) => l.status === "new").length,
    qualifiedLeads: leads.filter((l: any) => l.status === "qualified").length,
    recentLeads: leads.slice(0, 6).map((l: any) => `- ${l.name} (${l.phone})`).join("\n") || "NONE",
    pipelinesList: pipelines.map((p: any) => `- ${p.name}`).join("\n") || "NONE",
    upcomingEvents: eventsFuture.slice(0, 8).map((e: any) => `- ${e.title}`).join("\n") || "NONE",
    salesPlanSummary: planData ? `${planData.target || 0} / ${planData.actual || 0} UZS` : "NONE",
    totalRecipes,
    fullSnapshot,
    navigationContext,
  };
}
