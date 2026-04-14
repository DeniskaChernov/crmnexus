# ✅ Перемещения и зарплата - объяснение логики

## ❓ Вопрос: 
"При перемещении со склада на склад, зарплата не меняется у того кто сделал эту нитку?"

## ✅ Ответ: 
**Правильно, зарплата НЕ меняется!** И это правильная логика.

---

## 🧠 Логика работы:

### Производство товара (production_log):
```
Сотрудник → Произвел нитку → Получил зарплату
```

**Что сохраняется:**
- `production_log:ID` - запись о производстве
- `worker` - кто намотал (получает оплату за намотку)
- `twistedWorker` - кто перекрутил (получает оплату за перекрутку)
- `amount` - количество (кг)
- `rateSnapshotWinding` / `rateSnapshotTwisting` - ставки на момент производства

**Расчет зарплаты:**
```javascript
empLogs.forEach(l => {
    const amount = parseFloat(l.amount) || 0;
    
    // Намотка
    if (l.worker === employee.name) {
        windingKg += amount;
        salaryPiecework += amount * actualWindingRate;
    }
    
    // Перекрутка
    if (l.twistedWorker === employee.name) {
        twistingKg += amount;
        salaryPiecework += amount * actualTwistingRate;
    }
});
```

### Перемещение товара (transfer):
```
Склад A → Переместили готовый товар → Склад B
```

**Что сохраняется:**
- `transfer:ID` - запись о перемещении
- `fromWarehouse` - откуда
- `toWarehouse` - куда
- `article` - что
- `quantity` - сколько
- `note` - примечание

**НЕТ полей:**
- ❌ `worker` - нет
- ❌ `twistedWorker` - нет
- ❌ `rateSnapshot` - нет

**Расчет зарплаты:**
```javascript
// Transfers НЕ участвуют в расчете зарплаты вообще!
// Используются только production_log записи
```

---

## 📊 Пример:

### Сценарий:

1. **1 января** - Иван намотал 100 кг XP-3658 на складе AIKO
   - Создается `production_log`
   - `worker: "Иван"`
   - `amount: 100`
   - `warehouse: "AIKO"`
   - **Зарплата Ивана:** 100 кг × 1000 сум = **100,000 сум** ✅

2. **15 января** - Переместили 50 кг из AIKO в BTT
   - Создается `transfer`
   - `fromWarehouse: "AIKO"`
   - `toWarehouse: "BTT"`
   - `article: "XP-3658"`
   - `quantity: 50`
   - **Зарплата Ивана:** по-прежнему **100,000 сум** ✅
   - **Товар НЕ "переделывался"** - просто переместился

3. **20 января** - Еще раз переместили 20 кг из BTT в Bizly
   - Создается еще один `transfer`
   - **Зарплата Ивана:** всё та же **100,000 сум** ✅

### Итого за январь:
- **Иван произвел:** 100 кг (1 раз)
- **Товар перемещался:** 2 раза
- **Зарплата Ивана:** 100,000 сум (за производство, не за перемещения)

---

## 🎯 Почему это правильно:

### Производство = Работа = Зарплата
- Сотрудник **создал** товар своим трудом
- Он потратил время и усилия
- Он заслужил оплату

### Перемещение ≠ Работа ≠ Зарплата  
- Товар **уже существует**
- Никто **не создавал** его заново
- Это просто логистическая операция
- Платить за перемещение = **двойная оплата** ❌

---

## 🔍 Как проверить:

### 1. Посмотрите в базу данных:

**Production logs** (участвуют в зарплате):
```
production_log:1234567890
{
  id: "production_log:1234567890",
  worker: "Иван",          ✅ Есть
  twistedWorker: "Петр",   ✅ Есть
  amount: 100,
  warehouse: "AIKO",
  ...
}
```

**Transfers** (НЕ участвуют в зарплате):
```
transfer:9876543210
{
  id: "transfer:9876543210",
  fromWarehouse: "AIKO",
  toWarehouse: "BTT",
  article: "XP-3658",
  quantity: 50,
  note: "Балансировка",
  // ❌ Нет поля worker
  // ❌ Нет поля twistedWorker
}
```

### 2. Проверьте код расчета зарплаты:

Файл: `/components/Employees.tsx`, строка 70:
```javascript
fetch(`${baseUrl}/production-logs`, { headers })
```

**Берутся ТОЛЬКО production-logs**, не transfers!

Строка 245:
```javascript
const empLogs = logs.filter(l => {
    const logDate = parseISO(l.date);
    return isWithinInterval(logDate, { start, end });
});
```

**empLogs** содержит только production записи.

Строка 267:
```javascript
if (l.worker && l.worker.toLowerCase() === employee.name.toLowerCase()) {
    windingKg += amount;
    salaryPiecework += amount * rate;
}
```

**Проверяется наличие поля `worker`** - у transfers его нет!

---

## ✅ Вывод:

### Перемещения НЕ влияют на зарплату потому что:

1. **Технически:** У transfers нет полей `worker` и `twistedWorker`
2. **Логически:** Расчет зарплаты использует только `production-logs`
3. **По смыслу:** Перемещение - не производство, оплачивать не за что
4. **Код:** Фильтр `l.worker === employee.name` не сработает для transfers

### Это правильное поведение! ✅

---

## 🚀 Если нужна другая логика:

### Сценарий: "Платить за перемещение"

Если вы хотите платить сотруднику за **физическую работу** по перемещению:

1. **Добавьте поле `mover`** в transfer:
   ```javascript
   {
     id: "transfer:123",
     fromWarehouse: "AIKO",
     toWarehouse: "BTT",
     article: "XP-3658",
     quantity: 50,
     mover: "Василий",        // ← Новое поле
     movingRate: 100          // ← Ставка за перемещение (сум/кг)
   }
   ```

2. **Измените расчет зарплаты:**
   ```javascript
   // В Employees.tsx
   const transfers = await fetch(`${baseUrl}/transfers`);
   
   transfers.forEach(t => {
     if (t.mover === employee.name) {
       salaryMoving += t.quantity * t.movingRate;
     }
   });
   
   totalSalary = salaryHours + salaryPiecework + salaryMoving;
   ```

3. **Добавьте UI** для выбора mover в диалоге перемещения

### Но это нужно только если:
- Перемещение - **тяжелая физическая работа**
- Вы хотите **мотивировать** сотрудников
- Это **значительная часть** рабочего процесса

**В большинстве случаев** текущая логика (без оплаты) правильная! ✅

---

**Готово! 🎉**

Перемещения **не влияют** на зарплату, и это **правильно**!
