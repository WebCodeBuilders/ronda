# ronda — guía para trabajar en el código

Leé el README primero (qué es y cómo se despliega en el local).

## Reglas de oro

1. **Next 16**: `params` y `searchParams` son Promises (`await`). `proxy.ts` reemplaza a `middleware`.
2. **Prisma 7**: el cliente se genera en `app/generated/prisma` y se usa vía `@/lib/prisma`.
   El esquema cambia SOLO con migraciones: después de tocar `schema.prisma`, `npm run db:migrate:new`
   y se commitea la carpeta de `prisma/migrations`. Producción aplica con `prisma migrate deploy`.
3. **Multi-comercio**: TODA query filtra por `organizationId`.
4. **Toda modificación de un pedido pasa por `lib/orders/service.ts`** (o `kitchen.ts`). Una
   pantalla o API que escriba `Order`/`OrderItem` a mano es un bug. Los precios los pone el servidor.
5. **La cuenta sale de `lib/orders/totals.ts`**. Nunca sumar totales en otro lado.
6. **Publicar después de confirmar**: `publish()` va DESPUÉS de la transacción, nunca adentro.
7. **Permisos por clave** (`lib/permissions.ts`), nunca por nombre de rol. Doble chequeo:
   la pantalla oculta (`pageUser`) y la API rechaza (`requireUser`).
8. **Lo sensible queda en el historial** (`audit()`): anulaciones, descuentos, reaperturas, caja, precios.
9. **Diseño**: solo tokens de `app/globals.css`, componentes de `components/ui` y `components/shared`,
   íconos lucide (sin emojis), radios 16 px / 12 px, `rounded-full` solo en chips y puntos.
   Plata con `formatCurrency`, horas con `formatTime` (24 h, Buenos Aires). Todo en castellano.
10. **El build es el gate**: `npm run typecheck && npm test && npm run build`.
