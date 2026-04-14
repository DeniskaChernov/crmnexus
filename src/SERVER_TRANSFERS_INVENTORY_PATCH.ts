/**
 * PATCH для src/server/index.tsx
 * 
 * Добавить этот код после строки 2534, между обработкой shipments и Won Deals
 * 
 * НАЙТИ:
 *      } catch (e) {
 *          console.error("Error processing shipments for inventory:", e);
 *      }
 * 
 *      // 3. Process Won Deals (Add Reserved/Unshipped portion)
 * 
 * ВСТАВИТЬ МЕЖДУ НИМИ:
 */

const TRANSFER_INVENTORY_CODE = `
      // 2.5. Process Transfers (Add/Subtract from warehouses)
      try {
          const transfers = await kv.getByPrefix("transfer:");
          if (transfers) {
              transfers.forEach((t: any) => {
                  const fromWh = t.fromWarehouse;
                  const toWh = t.toWarehouse;
                  const art = t.article ? t.article.trim() : "Без артикула";
                  const qty = parseFloat(t.quantity) || 0;
                  
                  // Initialize warehouses if needed
                  if (!finalInventory[fromWh]) finalInventory[fromWh] = { produced: { total: 0, byArticle: {} }, sold: { total: 0, byArticle: {} } };
                  if (!finalInventory[toWh]) finalInventory[toWh] = { produced: { total: 0, byArticle: {} }, sold: { total: 0, byArticle: {} } };
                  
                  // Subtract from source warehouse (treat as "sold")
                  finalInventory[fromWh].sold.total += qty;
                  finalInventory[fromWh].sold.byArticle[art] = (finalInventory[fromWh].sold.byArticle[art] || 0) + qty;
                  
                  // Add to destination warehouse (treat as "produced")
                  finalInventory[toWh].produced.total += qty;
                  finalInventory[toWh].produced.byArticle[art] = (finalInventory[toWh].produced.byArticle[art] || 0) + qty;
              });
          }
      } catch (e) {
          console.error("Error processing transfers for inventory:", e);
      }
`;

/**
 * ИТОГО ДОЛЖНО БЫТЬ:
 * 
 *      } catch (e) {
 *          console.error("Error processing shipments for inventory:", e);
 *      }
 * 
 *      // 2.5. Process Transfers (Add/Subtract from warehouses)
 *      try {
 *          const transfers = await kv.getByPrefix("transfer:");
 *          ...
 *      } catch (e) {
 *          console.error("Error processing transfers for inventory:", e);
 *      }
 * 
 *      // 3. Process Won Deals (Add Reserved/Unshipped portion)
 */

export {};
