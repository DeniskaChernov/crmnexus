import { getPool } from "../dbPool.ts";
import { getCoilByToken } from "./coilsService.ts";

async function findOrCreateClientCompany(pool: ReturnType<typeof getPool>, customer: {
  first_name: string | null;
  last_name: string | null;
  phone_normalized: string;
}) {
  const name =
    [customer.first_name, customer.last_name].filter(Boolean).join(" ").trim() ||
    `Клиент ${customer.phone_normalized}`;

  const { rows: byPhone } = await pool.query<{ id: string }>(
    `SELECT id FROM companies WHERE phone = $1 LIMIT 1`,
    [customer.phone_normalized],
  );
  if (byPhone[0]) return byPhone[0].id;

  const { rows: created } = await pool.query<{ id: string }>(
    `INSERT INTO companies (name, phone, status, type)
     VALUES ($1, $2, 'active', 'client')
     RETURNING id`,
    [name, customer.phone_normalized],
  );
  return created[0]!.id;
}

async function defaultOpenStageId(pool: ReturnType<typeof getPool>) {
  const { rows } = await pool.query<{ id: string }>(
    `SELECT s.id FROM stages s
     JOIN pipelines p ON p.id = s.pipeline_id
     WHERE p.is_default = true
     ORDER BY s.order_index ASC
     LIMIT 1`,
  );
  return rows[0]?.id ?? null;
}

export async function convertSiteCustomerToContact(customerId: string) {
  const pool = getPool();
  const { rows: custRows } = await pool.query<{
    id: string;
    crm_contact_id: string | null;
    deal_id: string | null;
    first_name: string | null;
    last_name: string | null;
    phone_normalized: string;
    assigned_dealer_id: string | null;
    country: string | null;
    source_qr_token: string | null;
  }>(
    `SELECT id, crm_contact_id, deal_id, first_name, last_name, phone_normalized, assigned_dealer_id, country, source_qr_token
     FROM site_customers WHERE id = $1`,
    [customerId],
  );
  const customer = custRows[0];
  if (!customer) throw new Error("Клиент не найден");

  if (customer.crm_contact_id && customer.deal_id) {
    const { rows: existing } = await pool.query(`SELECT * FROM contacts WHERE id = $1`, [
      customer.crm_contact_id,
    ]);
    const { rows: deal } = await pool.query(`SELECT * FROM deals WHERE id = $1`, [customer.deal_id]);
    if (existing[0] && deal[0]) {
      return { contact: existing[0], deal: deal[0], created: false };
    }
  }

  const clientCompanyId = await findOrCreateClientCompany(pool, customer);

  let contactId = customer.crm_contact_id;
  if (!contactId) {
    const { rows: contactRows } = await pool.query(
      `INSERT INTO contacts (company_id, first_name, last_name, phone)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [clientCompanyId, customer.first_name, customer.last_name, customer.phone_normalized],
    );
    contactId = contactRows[0].id;
    await pool.query(
      `UPDATE site_customers SET crm_contact_id = $2, updated_at = now() WHERE id = $1`,
      [customerId, contactId],
    );
  }

  const { rows: contact } = await pool.query(`SELECT * FROM contacts WHERE id = $1`, [contactId]);

  let dealId = customer.deal_id;
  let deal = null;
  if (!dealId) {
    const stageId = await defaultOpenStageId(pool);
    const title = `QR: ${[customer.first_name, customer.last_name].filter(Boolean).join(" ") || customer.phone_normalized}`;
    const { rows: dealRows } = await pool.query(
      `INSERT INTO deals (title, company_id, contact_id, dealer_id, stage_id, amount, status)
       VALUES ($1, $2, $3, $4, $5, 0, 'open')
       RETURNING *`,
      [title, clientCompanyId, contactId, customer.assigned_dealer_id, stageId],
    );
    deal = dealRows[0];
    dealId = deal.id;
    await pool.query(
      `UPDATE site_customers SET deal_id = $2, updated_at = now() WHERE id = $1`,
      [customerId, dealId],
    );

    if (customer.source_qr_token) {
      const coil = await getCoilByToken(customer.source_qr_token);
      if (coil && !coil.deal_id) {
        await pool.query(`UPDATE rattan_coils SET deal_id = $2 WHERE id = $1`, [coil.id, dealId]);
      }
    }
  } else {
    const { rows: dealRows } = await pool.query(`SELECT * FROM deals WHERE id = $1`, [dealId]);
    deal = dealRows[0];
  }

  return { contact: contact[0], deal, created: true, companyId: clientCompanyId };
}
