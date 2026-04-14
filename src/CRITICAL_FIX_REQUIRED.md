# КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ ТРЕБУЕТСЯ

## Проблема
В файле `/supabase/functions/server/index.tsx` на строке 2627 открывается блок кода:
```typescript
if (!error && wonDeals && wonDeals.length > 0) {
```

Но этот блок НЕ закрывается перед строкой 2679 где находится `} catch (e) {`

## Решение
Вам нужно ВРУЧНУЮ добавить закрывающую скобку `}` после строки 2678.

### Текущий код (строки 2676-2683):
```typescript
                      }
                 });
             }
         } catch (e) {
             console.error("Error processing won deals for inventory:", e);
         }
      }

      // 4. (Removed redundant loop)
```

### Должно быть (с добавленной скобкой):
```typescript
                      }
                 });
                }
            }
         } catch (e) {
             console.error("Error processing won deals for inventory:", e);
         }
      }

      // 4. (Removed redundant loop)
```

## Где добавить
- **После строки 2678**: `             }` (это закрытие `if (allDealItems)`)
- **Добавьте строку**:  `                }` (с 16 пробелами) - закрытие `if (allDealItems)`
- **Добавьте строку**:  `            }` (с 12 пробелами) - закрытие `if (!error && wonDeals...)`

## Проверка правильности
После исправления:
- Строка 2678: `             }` - закрывает forEach
- Строка 2679: `                }` - закрывает if (allDealItems) - ДОБАВИТЬ
- Строка 2680: `            }` - закрывает if (!error && wonDeals) - ДОБАВИТЬ  
- Строка 2681: `         } catch (e) {` - начало блока catch

Это исправит обе ошибки deploy:
- "Expected a semicolon at line 2679"
- "Expression expected at line 2718"
