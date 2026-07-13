import { getPool } from "../dbPool.ts";

export async function convertSiteCustomerToContact(customerId: string) {
  const pool = getPool();
  const { rows: custRows } = await pool.query<{
    id: string;
    crm_contact_id: string | null;
    first_name: string | null;
    last_name: string | null;
    phone_normalized: string;
    assigned_dealer_id: string | null;
  }>(
    `SELECT id, crm_contact_id, first_name, last_name, phone_normalized, assigned_dealer_id
     FROM site_customers WHERE id = $1`,
    [customerId],
  );
  const customer = custRows[0];
  if (!customer) throw new Error("Клиент не найден");

  if (customer.crm_contact_id) {
    const { rows: existing } = await pool.query(`SELECT * FROM contacts WHERE id = $1`, [
      customer.crm_contact_id,
    ]);
    if (existing[0]) return { contact: existing[0], created: false };
  }

  const { rows: contactRows } = await pool.query(
    `INSERT INTO contacts (company_id, first_name, last_name, phone)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [
      customer.assigned_dealer_id,
      customer.first_name,
      customer.last_name,
      customer.phone_normalized,
    ],
  );
  const contact = contactRows[0];

  await pool.query(
    `UPDATE site_customers SET crm_contact_id = $2, updated_at = now() WHERE id = $1`,
    [customerId, contact.id],
  );

  return { contact, created: true };
}
