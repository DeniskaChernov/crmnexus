# 🔍 DEBUG: Пошаговая отладка ошибки "Available: 0 кг"

## ❌ Текущая ошибка:
```
Transfer failed: {
  "error": "Insufficient stock. Available: 0.00 кг, Requested: 203 кг"
}
```

---

## 📋 ЧТО НУЖНО СДЕЛАТЬ:

### Шаг 1: Открыть консоль браузера (F12)

1. Откройте **Developer Tools** (F12 или Ctrl+Shift+I)
2. Перейдите на вкладку **Console**
3. Очистите консоль (кнопка 🚫 или Ctrl+L)

---

### Шаг 2: Попробовать создать перемещение

1. Откройте диалог перемещения
2. Заполните:
   - **Откуда:** BTT (или тот склад откуда пытаетесь)
   - **Куда:** Bizly
   - **Артикул:** 4342 (или тот который не работает)
   - **Количество:** 203
3. Нажмите "Переместить"

---

### Шаг 3: Скопировать ВСЕ логи из консоли

В консоли должны появиться логи вида:

```javascript
🚀 Sending transfer request: {
  fromWarehouse: "BTT",
  toWarehouse: "Bizly",
  article: "4342",
  articleType: "string",  // ← Важно!
  quantity: 203,
  quantityType: "number"  // ← Важно!
}

📥 Server response: {
  error: "Insufficient stock. Available: 0.00 кг, Requested: 203 кг"
}
```

**СКОПИРУЙТЕ ВСЕ ЭТИ ЛОГИ** и отправьте мне!

---

### Шаг 4: Проверить серверные логи (если есть доступ)

Если у вас есть доступ к Supabase Dashboard:

1. Откройте **Supabase Dashboard**
2. Перейдите в **Edge Functions** → **server**
3. Откройте вкладку **Logs**
4. Там должны быть логи вида:

```javascript
📦 Creating transfer: {
  fromWarehouse: "BTT",
  toWarehouse: "Bizly",
  article: "4342",
  articleType: "string",
  quantity: 203,
  quantityType: "number"
}

📦 Production logs for BTT: {
  totalLogs: 150,       // ← Сколько всего production logs
  warehouseLogs: 0,     // ← Сколько для склада BTT
  articles: []          // ← Какие артикулы производились
}

💼 Initial stock after production: {}  // ← Остатки после production

📤 Stock after shipments: {}  // ← Остатки после вычитания отгрузок

📋 Processing transfers: {
  totalTransfers: 5,    // ← Сколько всего transfers
  fromWarehouse: "BTT",
  article: "4342"
}

  Transfer: {
    from: "AIKO",
    to: "BTT",
    article: "4342",
    articleMatches: true,        // ← Совпадает ли артикул?
    articleTrimmed: "4342",
    searchingFor: "4342",
    quantity: 203.28,
    isFromWarehouse: false,      // ← Это transfer ИЗ BTT?
    isToWarehouse: true          // ← Это transfer В BTT?
  }

🔄 Stock after transfers: {"4342": 203.28}  // ← Остатки после transfers

🎯 Final available for article 4342: 203.28  // ← Финальный остаток

📊 Stock calculation for 4342 in BTT: {
  produced: 0,           // ← Произведено на BTT
  shipped: 0,            // ← Отгружено с BTT
  transferredOut: 0,     // ← Перемещено С BTT
  transferredIn: 203.28, // ← Перемещено НА BTT
  availableStock: 203.28,// ← ИТОГО доступно
  requestedQuantity: 203 // ← Запрашивают
}
```

**СКОПИРУЙТЕ ВСЕ СЕРВЕРНЫЕ ЛОГИ** и отправьте мне!

---

## 🎯 ЧТО Я ИЩУЗЗ В ЛОГАХ:

### 1. Типы данных:
- `articleType` должен быть `"string"` ✅
- `quantityType` должен быть `"number"` ✅

### 2. Production logs:
- `warehouseLogs` для BTT = 0 (нормально, не производился там)
- `articles: []` (пустой массив - нормально)

### 3. Transfers:
- `totalTransfers` > 0 (должны быть transfers)
- Хотя бы один transfer где:
  - `to: "BTT"`
  - `article: "4342"`
  - `isToWarehouse: true` ✅
  - `quantity` > 0

### 4. Final stock:
- `🔄 Stock after transfers` должен показать `{"4342": 203.28}` или подобное
- `🎯 Final available` должен быть > 0
- `transferredIn` в итоговой статистике должен быть > 0

---

## 🐛 Возможные проблемы:

### Проблема A: Артикул не совпадает

**Симптомы:**
```javascript
Transfer: {
  article: "4342 ",      // ← Пробел в конце!
  searchingFor: "4342",
  articleMatches: false  // ← НЕ совпадает!
}
```

**Решение:** Нужно trim() артикулы

---

### Проблема B: Transfers не загрузились

**Симптомы:**
```javascript
📋 Processing transfers: {
  totalTransfers: 0  // ← Нет transfers вообще!
}
```

**Решение:** База данных пустая или префикс неправильный

---

### Проблема C: Quantity - строка

**Симптомы:**
```javascript
Transfer: {
  quantity: 0,  // ← Всегда 0!
}
```

**Решение:** parseFloat не работает, данные в неправильном формате

---

### Проблема D: Warehouse не совпадает

**Симптомы:**
```javascript
Transfer: {
  to: "BTT ",           // ← Пробел!
  isToWarehouse: false  // ← НЕ совпадает!
}
```

**Решение:** Нужно trim() warehouse names

---

### Проблема E: stockByArticle не обновляется

**Симптомы:**
```javascript
💼 Initial stock: {}
🔄 Stock after transfers: {}  // ← Все еще пустой!
🎯 Final available: 0
```

Но при этом:
```javascript
Transfer: {
  isToWarehouse: true,
  quantity: 203.28
}
```

**Решение:** Код не выполняется или есть ошибка в логике

---

## 🚨 ОТПРАВЬТЕ МНЕ:

1. ✅ Логи из **консоли браузера** (полностью)
2. ✅ Логи из **Supabase Edge Function** (если есть доступ)
3. ✅ Скриншот диалога перемещения (какие значения выбраны)

С этими данными я смогу точно определить проблему!

---

## 🔧 Временное решение (если срочно):

Если нужно срочно и нет времени на отладку, можно:

1. Открыть **Supabase Dashboard**
2. Перейти в **Edge Functions**
3. Найти функцию **server**
4. Нажать **Restart** (перезапуск)

Это иногда помогает если код не обновился после изменений.

Но **лучше найти корневую причину** с помощью логов!
