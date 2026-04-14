# 🔧 Исправления системы перемещений - Сводка

## 🐛 Проблема:

При попытке создать перемещение товаров между складами система выдавала ошибку:

```
❌ Insufficient stock. Available: 0 кг, Requested: 203.2 кг
```

Хотя товар физически был на складе.

---

## 🔍 Корневая причина:

Система перемещений была реализована, но **не учитывала предыдущие перемещения** при расчете остатков:

1. **Frontend (Warehouse.tsx):**
   - Функция `getAvailableArticles()` брала данные из `stats` с сервера
   - `stats` не учитывали transfers (т.к. патч не был применен)
   - После первого перемещения показывало 0 кг

2. **Backend (server/index.tsx):**
   - Логика учета transfers **была**, но работала **неправильно**
   - Лишнее условие `&& stockByArticle[t.article] !== undefined` пропускало артикулы
   - Не использовался `parseFloat()` для quantity
   - Результат: всегда показывало 0 кг доступных

---

## ✅ Что исправлено:

### 1. Frontend - Клиентский расчет остатков

**Файл:** `/components/Warehouse.tsx`  
**Строки:** ~1086-1115

#### Обновлена функция `getAvailableArticles()`:

```javascript
const getAvailableArticles = (warehouse: string) => {
  if (!stats || !stats[warehouse]) return [];
  
  // Базовые остатки с сервера
  const baseStock = { ...stats[warehouse].current.byArticle };
  
  // ✅ Применяем все transfers локально
  transfers.forEach(t => {
    const art = t.article;
    const qty = parseFloat(t.quantity) || 0;
    
    if (t.fromWarehouse === warehouse) {
      if (!baseStock[art]) baseStock[art] = 0;
      baseStock[art] -= qty;  // Вычитаем отгруженное
    }
    
    if (t.toWarehouse === warehouse) {
      if (!baseStock[art]) baseStock[art] = 0;
      baseStock[art] += qty;  // Добавляем полученное
    }
  });
  
  return Object.entries(baseStock)
    .filter(([_, qty]) => qty > 0)
    .map(([art, qty]) => ({ article: art, qty }));
};
```

#### Добавлена функция `getAvailableQuantity()`:

```javascript
const getAvailableQuantity = (warehouse: string, article: string): number => {
  if (!stats || !stats[warehouse]) return 0;
  
  let qty = stats[warehouse].current.byArticle[article] || 0;
  
  // ✅ Применяем transfers для конкретного артикула
  transfers.forEach(t => {
    if (t.article === article) {
      const transferQty = parseFloat(t.quantity) || 0;
      
      if (t.fromWarehouse === warehouse) {
        qty -= transferQty;
      }
      
      if (t.toWarehouse === warehouse) {
        qty += transferQty;
      }
    }
  });
  
  return Math.max(0, qty);
};
```

#### Использование в UI:

```javascript
// Показ остатка в диалоге перемещения
<p className="text-xs text-slate-500">
  Доступно на складе {transferForm.fromWarehouse}: {
    getAvailableQuantity(transferForm.fromWarehouse, transferForm.article).toFixed(2)
  } кг
</p>
```

---

### 2. Backend - Серверная валидация

**Файл:** `/supabase/functions/server/index.tsx`  
**Строки:** 2762-2803

#### Исправлена логика учета transfers:

**Было (❌ неправильно):**
```javascript
(prevTransfers || []).forEach((t: any) => {
  // ❌ Лишнее условие пропускало артикулы
  if (t.fromWarehouse === fromWarehouse && stockByArticle[t.article] !== undefined) {
    stockByArticle[t.article] -= t.quantity || 0;  // ❌ quantity - строка!
  }
  if (t.toWarehouse === fromWarehouse) {
    if (!stockByArticle[t.article]) stockByArticle[t.article] = 0;
    stockByArticle[t.article] += t.quantity || 0;
  }
});
```

**Стало (✅ правильно):**
```javascript
(prevTransfers || []).forEach((t: any) => {
  const art = t.article;
  const qty = parseFloat(t.quantity) || 0;  // ✅ Парсим в число
  
  // ✅ Убрано лишнее условие
  if (t.fromWarehouse === fromWarehouse) {
    if (!stockByArticle[art]) stockByArticle[art] = 0;  // ✅ Создаем ключ
    stockByArticle[art] -= qty;
  }
  
  if (t.toWarehouse === fromWarehouse) {
    if (!stockByArticle[art]) stockByArticle[art] = 0;
    stockByArticle[art] += qty;
  }
});
```

#### Добавлено детальное логирование:

```javascript
console.log('📊 Stock calculation for', article, 'in', fromWarehouse, ':', {
  produced: ...,           // Произведено
  shipped: ...,            // Отгружено
  transferredOut: ...,     // Перемещено отсюда
  transferredIn: ...,      // Перемещено сюда
  availableStock,          // Доступно сейчас
  requestedQuantity        // Запрашивают
});
```

---

## 📊 Как работает теперь:

### Формула расчета остатков:

```
Остаток артикула на складе = 
  + Произведено на этом складе
  - Отгружено с этого склада
  - Перемещено С этого склада    ← ✅ Теперь учитывается!
  + Перемещено НА этот склад     ← ✅ Теперь учитывается!
```

### Двухуровневая защита:

```
┌─────────────────────────────────────────────────┐
│                   USER                          │
└────────────────┬────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│  FRONTEND (Warehouse.tsx)                       │
│  ✅ getAvailableArticles()                      │
│  ✅ getAvailableQuantity()                      │
│  → Показывает правильные остатки в UI           │
│  → Скрывает недоступные артикулы                │
└────────────────┬────────────────────────────────┘
                 │
                 │ POST /transfers
                 ▼
┌─────────────────────────────────────────────────┐
│  BACKEND (server/index.tsx)                     │
│  ✅ Пересчет остатков с учетом transfers        │
│  ✅ Валидация: availableStock >= quantity       │
│  → Защита от некорректных запросов              │
│  → Логирование для отладки                      │
└────────────────┬────────────────────────────────┘
                 │
                 ▼
         ✅ Transfer создан
         или
         ❌ Ошибка с деталями
```

---

## 🎯 Тестовый сценарий:

### Начальное состояние:
- **AIKO:** XP-3658 = 300 кг (произведено)
- **BTT:** XP-3658 = 0 кг
- **Bizly:** XP-3658 = 0 кг

### Шаг 1: Переместить 100 кг из AIKO в BTT

**Frontend показывает:**
```
Доступно на складе AIKO: 300.00 кг ✅
```

**Backend логирует:**
```javascript
📊 Stock calculation for XP-3658 in AIKO : {
  produced: 300,
  shipped: 0,
  transferredOut: 0,
  transferredIn: 0,
  availableStock: 300,
  requestedQuantity: 100
}
```

**Результат:** ✅ Success

**Новое состояние:**
- AIKO: 200 кг
- BTT: 100 кг
- Bizly: 0 кг

---

### Шаг 2: Переместить 150 кг из AIKO в Bizly

**Frontend показывает:**
```
Доступно на складе AIKO: 200.00 кг ✅  (было 300, минус 100)
```

**Backend логирует:**
```javascript
📊 Stock calculation for XP-3658 in AIKO : {
  produced: 300,
  shipped: 0,
  transferredOut: 100,    ← Учитывается первое перемещение!
  transferredIn: 0,
  availableStock: 200,
  requestedQuantity: 150
}
```

**Результат:** ✅ Success

**Новое состояние:**
- AIKO: 50 кг
- BTT: 100 кг
- Bizly: 150 кг

---

### Шаг 3: Попытка переместить 200 кг из AIKO в BTT

**Frontend показывает:**
```
Доступно на складе AIKO: 50.00 кг ✅
```

**Backend логирует:**
```javascript
📊 Stock calculation for XP-3658 in AIKO : {
  produced: 300,
  shipped: 0,
  transferredOut: 250,    ← Учитываются ОБА перемещения!
  transferredIn: 0,
  availableStock: 50,
  requestedQuantity: 200
}
```

**Результат:** ❌ Error
```
Insufficient stock. Available: 50.00 кг, Requested: 200 кг
```

**Всё работает правильно!** ✅

---

## ✅ Что работает сейчас:

### Frontend:
- ✅ Правильный расчет остатков с учетом всех transfers
- ✅ Показ только доступных артикулов в выпадающем списке
- ✅ Динамический пересчет при выборе склада
- ✅ Отображение текущего остатка под полем количества

### Backend:
- ✅ Валидация с учетом всех previous transfers
- ✅ Корректная работа с числами (parseFloat)
- ✅ Создание ключей для несуществующих артикулов
- ✅ Детальное логирование для отладки
- ✅ Понятные сообщения об ошибках

### Общее:
- ✅ Можно делать несколько перемещений подряд
- ✅ Нет ошибки "Available: 0 кг"
- ✅ Двухуровневая защита от ошибок
- ✅ Realtime обновление данных

---

## 📚 Связанная документация:

1. **`/TRANSFERS_FEATURE_DOCUMENTATION.md`** - Общая документация по системе перемещений
2. **`/FIX_AVAILABLE_0_KG_ISSUE.md`** - Детали исправления frontend
3. **`/SERVER_TRANSFER_FIX.md`** - Детали исправления backend
4. **`/SERVER_TRANSFERS_INVENTORY_PATCH.ts`** - Опциональный патч для dashboard (не обязательно)

---

## 🎉 Итог:

### ДО исправлений:
- ❌ Ошибка "Available: 0 кг" после первого перемещения
- ❌ Невозможно сделать второе перемещение
- ❌ Неправильный расчет остатков
- ❌ Нет логирования

### ПОСЛЕ исправлений:
- ✅ Правильный расчет на frontend (клиентский)
- ✅ Правильная валидация на backend (серверная)
- ✅ Можно делать сколько угодно перемещений
- ✅ Детальное логирование
- ✅ Понятные сообщения об ошибках
- ✅ Двойная защита

---

**Система перемещений полностью работает!** 🚀

Теперь можно свободно перемещать товары между складами AIKO, BTT и Bizly без ошибок.
