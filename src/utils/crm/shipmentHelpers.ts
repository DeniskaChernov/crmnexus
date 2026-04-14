import { toast } from 'sonner@2.0.3';
import { crmUrl, authHeaders } from '../../lib/crmApi.ts';

export interface DealItem {
  id: string;
  article: string;
  quantity: string | number;
  price: string | number;
  warehouse?: string;
  type?: 'product' | 'service' | 'production';
}

export const createShipmentsForDeal = async (
  deal: { id: string; title: string },
  items: DealItem[],
  clientName: string = 'Не указан',
  silent: boolean = false
) => {
  if (items.length === 0) {
    if (!silent) toast.error("Нет товаров для отгрузки");
    return;
  }

  // Filter valid items (skip services and empty items)
  const validItems = items.filter(i => i.article && Number(i.quantity) > 0 && i.type !== 'service' && i.type !== 'production');
  
  if (validItems.length === 0) {
    if (!silent) {
        if (items.length > 0) toast.error("Нет товаров для отгрузки со склада");
        else toast.error("Заполните артикул и количество");
    }
    return;
  }

  // Group by warehouse
  const byWarehouse: Record<string, DealItem[]> = {};
  validItems.forEach(item => {
    const wh = item.warehouse || 'AIKO';
    if (!byWarehouse[wh]) byWarehouse[wh] = [];
    byWarehouse[wh].push(item);
  });

  const warehouses = Object.keys(byWarehouse);
  let createdCount = 0;

  const uuid = () => {
      if (typeof crypto !== 'undefined' && crypto.randomUUID) {
          return crypto.randomUUID();
      }
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
  };

  try {
    for (const wh of warehouses) {
      const warehouseItems = byWarehouse[wh];
      
      const shipmentId = uuid();

      const payload = {
        id: shipmentId,
        date: new Date().toISOString(),
        note: `Сделка: ${deal.title} (Клиент: ${clientName})`,
        status: 'draft',
        warehouse: wh,
        dealId: deal.id, // Link to deal for future reference
        stickerClient: clientName, // Company name for sticker printing
        items: warehouseItems.map(i => ({
          id: uuid(),
          article: i.article,
          weight: Number(i.quantity),
          date: new Date().toISOString(),
          barcode: '',
        }))
      };

      const response = await fetch(`${crmUrl('/shipments')}`, {
        method: 'POST',
        headers: { ...authHeaders() },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Failed to create shipment for ${wh}`);
      }
      createdCount++;
    }

    if (createdCount > 0) {
      toast.success(`Создано отгрузок: ${createdCount} (Черновик)`);
    }

    return createdCount;

  } catch (error: any) {
    console.error("Error creating shipment:", error);
    toast.error("Ошибка при создании отгрузки: " + error.message);
    throw error;
  }
};
