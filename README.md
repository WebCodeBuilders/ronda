# ronda

Sistema de gestión gastronómica para **restaurantes, bares, paradores, cafeterías, pizzerías,
hamburgueserías, heladerías, food trucks y rotiserías**. Salón en vivo, mozos con tablet o
celular, comandas a cocina por pantalla o comandera térmica, caja, delivery, reservas, carta
QR, insumos con recetas y reportes.

Hecho con la misma línea de diseño que **pivoo / fullstock**: tokens de color, Outfit,
radios de 16 px, componentes del sistema y castellano rioplatense en toda la interfaz.

---

## Cómo funciona en el local

```
                 wifi del local
   ┌──────────────────────────────────────────────┐
   │                                              │
 ┌─┴──────────────────┐   tiempo real (SSE)   ┌───┴─────────────┐
 │ Compu principal    │◄────────────────────►│ Tablets / celus │  mozos: abren mesas,
 │ (servidor ronda +  │                      │ de los mozos    │  cargan y marchan
 │  Postgres) = CAJA  │                      └─────────────────┘
 └─┬──────────┬───────┘
   │          │ ESC/POS por TCP (puerto 9100)
   │          ▼
   │   ┌──────────────┐   ┌──────────────┐
   │   │ Comandera    │   │ Comandera    │   impresoras térmicas de red
   │   │ cocina       │   │ barra        │   (Epson, Hasar, 3nStar, Xprinter…)
   │   └──────────────┘   └──────────────┘
   ├──► Pantalla de cocina (KDS): una tablet o TV con navegador
   ├──► Pantalla de retiro para los clientes
   └──► Celular del cliente: carta QR de la mesa
```

- **La compu principal** corre el servidor (`docker compose up -d`) y hace de caja.
- **Cada equipo** (tablet del mozo, pantalla de cocina, TV de retiro) abre el navegador en
  `http://IP-DE-LA-COMPU:3000/vincular` y escribe un código de 6 números que se genera en
  *Configuración › Equipos*. Queda vinculado: sabe qué es y qué estación mira.
- **Los mozos** entran tocando su nombre y su **PIN de 4 números**. Cambiar de mozo en una
  tablet compartida lleva dos segundos.
- **La comanda** sale por la comandera térmica de la estación (sin drivers ni Windows: el
  servidor le habla directo por red) **y/o** aparece en la pantalla de cocina. Si la
  impresora está apagada o sin papel, la comanda **no se pierde**: queda en cola, se
  reintenta sola, la caja recibe un aviso y la pantalla la sigue mostrando.
- **Todo en tiempo real**: cuando cocina marca un plato listo, el mozo de esa mesa recibe
  el aviso con sonido en su teléfono. El indicador "En vivo / Reconectando" muestra si la
  terminal está al día.

No necesita internet para funcionar: todo vive en la compu del local. Opcionalmente se
puede subir a la nube (es multi-comercio desde el diseño: todo cuelga de `organizationId`).

---

## Qué trae (y qué no tiene la competencia)

| | ronda |
|---|---|
| **Salón** | Plano en vivo por sector (salón, terraza, playa) con mesas, banquetas, boxes, **sombrillas y reposeras**. Colores por estado: libre, ocupada, platos listos, comanda demorada, pidió la cuenta, llama al mozo, reservada. Editor con arrastrar y soltar. Vista de lista para el celular. Filtro "Mis mesas". |
| **Pedido** | Carta con categorías y buscador, modificadores con mínimo/máximo y precio (punto, guarnición, extras, "sin…"), aclaraciones para cocina, **comensal por plato**, precio libre (pesca del día). Lo cargado se guarda al instante en el servidor: si se cae la tablet, no se pierde nada. |
| **Marchar por pasos** | "Marchar" manda todo; "Por pasos" saca entradas y bebidas y deja los principales **en espera** (la cocina sabe que vienen). El mozo los libera con "Marchar" cuando la mesa termina. |
| **Comandas** | Una por estación (cocina, parrilla, barra…), con impresión ESC/POS y/o pantalla. Reimpresión, anulaciones impresas, cola con reintentos. |
| **Pantalla de cocina (KDS)** | Tarjetas con reloj (verde, ámbar, rojo), tocar un plato lo marca listo, "Listo" avisa al mozo, prioridad, recuperar lo despachado, **totales en curso** ("hay que sacar 6 milanesas"), **platos sin stock** que se apagan en todas las terminales y en el QR al instante. |
| **Cobro** | Todo junto, **partes iguales**, **por ítems** o **por comensal**, con varios medios de pago en la misma cuenta, propina, vuelto, recargo por medio de pago, cuenta corriente con límite. Cada parte se registra en el momento. |
| **Control** | Anular lo marchado pide motivo y **PIN de encargado** en la misma terminal; descuentos, reaperturas, devoluciones, cambios de precio y caja quedan en el **historial** con quién, cuándo y por qué. |
| **Caja** | Apertura con fondo, ingresos y retiros, cobros por medio, **arqueo contando billetes**, diferencia, cierre Z impreso, historial de cierres. |
| **Mostrador, para llevar y delivery** | Venta rápida (cobra y marcha), para llevar con nombre, delivery con dirección, envío, repartidor y horario. Tablero por estado con **aviso por WhatsApp** al cliente y link al mapa. **Pantalla de retiro** con los números listos. |
| **Carta QR en la mesa** | El cliente ve la carta, **pide desde el celular** (con aprobación del mozo opcional), **llama al mozo** y **pide la cuenta** diciendo cómo paga. Sin instalar nada. |
| **Reservas** | Por día, con mesa, notas, confirmación por WhatsApp; **lista de espera** con demora estimada y aviso "tu mesa está lista". Sentar abre la mesa con todo cargado. |
| **Clientes** | Ficha con historial, ticket promedio, lo que más pide, **alergias que el mozo ve en la mesa**, puntos de fidelidad, cuenta corriente con pagos. |
| **Insumos** | Recetas por plato: el stock **baja solo al marchar** y vuelve si se anula. Compras con costo promedio, mermas, conteos, alertas de mínimo y "alcanza para X días". |
| **Carta** | Productos, categorías con estación, grupos de opciones, margen por plato, costo desde la receta, **aumento masivo de precios por % con redondeo** y vista previa. |
| **Reportes** | Ventas por día y hora pico, productos, categorías, mozos (propinas, ticket promedio), medios de pago, canal, **tiempos de cocina por estación**, margen bruto, anulaciones. Comparación con el período anterior. Exporta CSV. |
| **Inicio** | Cómo viene el día contra el mismo día de la semana pasada, mesas ocupadas, lo abierto sin cobrar, alertas (caja cerrada, comandas demoradas, impresoras caídas, insumos bajos, lista de espera). |

---

## Instalar y publicar

### En el local o en un servidor (Docker)

Requiere Docker con Docker Compose.

```bash
git clone https://github.com/WebCodeBuilders/ronda.git && cd ronda
cp .env.example .env
```

Completá en `.env`:

| Variable | Qué poner |
|---|---|
| `DB_PASSWORD` | Una contraseña para la base de datos. |
| `SESSION_SECRET` | Una clave larga: `openssl rand -base64 48`. Sin ella el sistema no arranca. |
| `PUBLIC_URL` | Opcional: el dominio público, si los QR de las mesas tienen que funcionar fuera del wifi del local. |

```bash
docker compose up -d
```

Abrí `http://IP-DE-LA-COMPU:3000`. La primera vez aparece **Bienvenido a ronda**: cargás el
comercio, tu usuario de dueño y la cantidad de mesas, y queda armado un salón, la cocina, la
barra, categorías base y los medios de pago. Esa pantalla desaparece para siempre una vez
creado el comercio.

Después, en *Configuración › Equipos* generás un código para cada tablet, celular o pantalla
de cocina, y en cada uno abrís `http://IP-DE-LA-COMPU:3000/vincular`.

### Actualizar a una versión nueva

```bash
git pull
docker compose up -d --build
```

Al arrancar, el contenedor aplica las migraciones pendientes de la base (`prisma migrate
deploy`), que nunca borran datos.

### Copias de seguridad

```bash
docker compose exec db pg_dump -U ronda ronda > ronda-$(date +%F).sql
```

Conviene programarlo todos los días y guardar la copia fuera de la compu del local.

### Publicarlo en internet

Detrás de un proxy con HTTPS (Caddy, Nginx, Traefik o el panel del hosting) apuntando al
puerto 3000. Las cookies se marcan seguras solas cuando se entra por HTTPS. El servidor
expone `GET /api/health` para el monitoreo (200 si la base responde).

### Para desarrollar

Requiere Node 22 y Postgres 16.

```bash
npm install
cp .env.example .env     # ajustá DATABASE_URL y SESSION_SECRET
npm run db:migrate       # crea las tablas
npm run db:seed          # opcional: demo "Parador La Ronda"
npm run dev              # http://localhost:3000 (escucha en toda la red)
```

Si cambiás `prisma/schema.prisma`, generá la migración con `npm run db:migrate:new`.

### Demo (solo con `npm run db:seed`)

| Acceso | Datos |
|---|---|
| Dueño (email) | `duenio@ronda.app` / `ronda1234` |
| Encargado (email) | `encargado@ronda.app` / `ronda1234` |
| PIN | Sofía 1111 · Diego 2222 · Carla (caja) 3333 · Lucía 4444 · Martín 5555 · Nicolás 8888 · Cocina 6666 · Repartidor 7777 |
| Vincular equipos (`/vincular`) | 111111 caja · 222222 tablet mozo · 333333 pantalla cocina · 444444 pantalla barra · 555555 pantalla de retiro |

> La demo borra y vuelve a crear el comercio "Parador La Ronda". No la corras sobre la base de un local en uso.

---

## Arquitectura

- **Next.js 16** (App Router) · React 19 · **Prisma 7** con Postgres · Tailwind v4 · lucide-react · zod · recharts.
- **Tiempo real** con `LISTEN/NOTIFY` de Postgres y Server-Sent Events (`/api/stream`): no
  hace falta un broker aparte y funciona igual con uno o varios servidores. Los eventos son
  avisos ("cambió el pedido X"); cada pantalla vuelve a pedir lo suyo, así nunca hay dos
  versiones de la verdad. Si la conexión se corta, al volver todas las pantallas se resincronizan.
- **Sesiones** firmadas con HMAC (sin tabla de sesiones), 12 h de duración, cortadas al cambiar
  PIN, contraseña, rol o al dar de baja. Equipos vinculados con token propio de un año.
- **Permisos** por clave (`lib/permissions.ts`), nunca por nombre de rol. Roles: dueño,
  encargado, cajero, mozo, cocina, repartidor.

| Dónde | Qué |
|---|---|
| `lib/orders/service.ts` | **Motor de pedidos**: abrir, cargar, marchar, pasos, anular, descuentos, pasar/unir mesas, cobrar, cerrar, reabrir, devolver. Toda modificación pasa por acá. |
| `lib/orders/totals.ts` | La cuenta de un pedido, en un solo lugar (con tests). |
| `lib/orders/kitchen.ts` | Acciones de cocina y aviso al mozo. |
| `lib/printing/` | Formato de comandas y tickets, ESC/POS por TCP y cola con reintentos. |
| `lib/realtime/` | Bus de eventos (servidor) y hooks `useRealtime` / `useLiveRefresh` (cliente). |
| `lib/salon/state.ts` | El estado de una mesa en una palabra (con tests). |
| `lib/reports.ts` | Todas las cuentas de reportes e Inicio. |
| `app/api/*` | API con validación zod, permiso en cada ruta y errores en castellano. |
| `components/ui`, `components/shared` | Sistema de diseño heredado de pivoo. |

```bash
npm run typecheck   # tipos
npm test            # tests de totales, estados de mesa y formato de impresión
npm run build       # build de producción
npm audit           # dependencias sin vulnerabilidades conocidas
```

---

## Próximos pasos sugeridos

- **Facturación electrónica ARCA/AFIP** (reutilizando el módulo de pivoo/fullstock).
- Integración con **Mercado Pago Point / QR** para cobrar desde la mesa y conciliar solo.
- Modo **sin conexión** en la tablet del mozo (cola local que sincroniza al volver el wifi).
- Pedidos online propios (web de delivery) y conexión con PedidosYa / Rappi.
- Multi-sucursal con stock central y reportes consolidados.
- Liquidación de propinas por mozo y control de turnos/fichaje.
