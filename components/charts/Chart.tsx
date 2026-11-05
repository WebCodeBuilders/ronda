"use client";

import { useId } from "react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line,
  Pie, PieChart, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis,
} from "recharts";
import { CHROME, SEMANTICOS, colorDeSerie, color, type ModoColor } from "./palette";

/**
 * ─── LOS GRÁFICOS DE LA CASA ─────────────────────────────────────────────────
 *
 * Envoltorios finos sobre Recharts. Existen para que ninguna pantalla configure
 * ejes, grillas ni colores a mano: un tablero donde cada gráfico eligió su gris
 * se lee como veinte gráficos, no como uno.
 *
 * ── Tres reglas ──
 *
 * 1. **El dato llega listo.** Estos componentes no filtran, no ordenan y no
 *    agregan: lo hace `lib/analytics-sql.ts`, en la base. Acá llegan decenas de
 *    puntos, nunca miles — una serie de más de ~400 puntos no se lee ni con el
 *    mejor gráfico.
 * 2. **El color se pasa, no se adivina.** `modo="pdf"` usa valores literales
 *    porque la exportación imprime en una ventana sin la hoja de estilos de la
 *    app, y ahí un `var(--accent)` no resuelve a nada.
 * 3. **La figura no reemplaza al número.** Cada gráfico va acompañado de su
 *    tabla o de sus totales: el gráfico muestra la forma, el número exacto se
 *    lee al lado.
 */

export interface Punto {
  [clave: string]: string | number;
}

interface Serie {
  /** Clave del dato en cada punto. */
  key: string;
  /** Cómo se llama en la leyenda y en el globito. */
  label: string;
  /** Por defecto, el color que le toca por posición en la paleta. */
  color?: string;
}

interface BaseProps {
  data: Punto[];
  /** Clave del eje horizontal. */
  xKey: string;
  series: Serie[];
  /** Alto en píxeles. Los gráficos de esta app no se estiran a lo alto. */
  height?: number;
  modo?: ModoColor;
  /** Cómo se escribe un valor en el eje y en el globito. */
  formato?: (v: number) => string;
  /** Cómo se escribe una etiqueta del eje horizontal. */
  formatoX?: (v: string) => string;
  /** Descripción para lectores de pantalla. Obligatoria: es lo único que leen. */
  aria: string;
}

const EJE = { fontSize: 11, tickLine: false, axisLine: false };

function ejeProps(modo: ModoColor) {
  return { ...EJE, stroke: color(CHROME.texto, modo) };
}

/** El globito. Se arma acá para que todos los gráficos digan lo mismo igual. */
function tooltipProps(modo: ModoColor, formato?: (v: number) => string) {
  return {
    contentStyle: {
      backgroundColor: color(CHROME.superficie, modo),
      border: `1px solid ${color(CHROME.grid, modo)}`,
      borderRadius: 12,
      fontSize: 12,
      padding: "8px 10px",
    },
    formatter: (v: unknown) => (typeof v === "number" && formato ? formato(v) : String(v ?? "")),
  };
}

/**
 * Serie temporal. Es el gráfico por defecto para "cómo viene esto en el tiempo".
 *
 * Con dos series, la segunda se dibuja punteada: se usa para superponer el
 * período anterior, y dos líneas llenas del mismo grosor compiten por la mirada
 * cuando una es solo la referencia.
 */
export function GraficoDeLinea({
  data, xKey, series, height = 260, modo = "pantalla", formato, formatoX, aria,
}: BaseProps) {
  const id = useId();
  return (
    <figure role="img" aria-label={aria} className="w-full">
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            {series.map((s, i) => (
              <linearGradient key={s.key} id={`${id}-${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color ?? colorDeSerie(i, modo)} stopOpacity={0.22} />
                <stop offset="100%" stopColor={s.color ?? colorDeSerie(i, modo)} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={color(CHROME.grid, modo)} />
          <XAxis dataKey={xKey} {...ejeProps(modo)} tickFormatter={formatoX} minTickGap={24} />
          <YAxis {...ejeProps(modo)} width={64} tickFormatter={formato} />
          <Tooltip {...tooltipProps(modo, formato)} />
          {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
          {series.map((s, i) => (
            <Area
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={s.color ?? colorDeSerie(i, modo)}
              strokeWidth={2}
              strokeDasharray={i > 0 ? "4 4" : undefined}
              fill={`url(#${id}-${i})`}
              dot={false}
              activeDot={{ r: 4 }}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </figure>
  );
}

/** Barras. Horizontal cuando las etiquetas son nombres: un nombre no entra vertical. */
export function GraficoDeBarras({
  data, xKey, series, height = 260, modo = "pantalla", formato, aria, horizontal = false, apilado = false,
}: BaseProps & { horizontal?: boolean; apilado?: boolean }) {
  return (
    <figure role="img" aria-label={aria} className="w-full">
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={data}
          layout={horizontal ? "vertical" : "horizontal"}
          margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={horizontal} horizontal={!horizontal} stroke={color(CHROME.grid, modo)} />
          {horizontal ? (
            <>
              <XAxis type="number" {...ejeProps(modo)} tickFormatter={formato} />
              <YAxis type="category" dataKey={xKey} {...ejeProps(modo)} width={140} />
            </>
          ) : (
            <>
              <XAxis dataKey={xKey} {...ejeProps(modo)} />
              <YAxis {...ejeProps(modo)} width={64} tickFormatter={formato} />
            </>
          )}
          <Tooltip {...tooltipProps(modo, formato)} cursor={{ fill: color(CHROME.grid, modo), opacity: 0.25 }} />
          {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
          {series.map((s, i) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.label}
              stackId={apilado ? "una" : undefined}
              fill={s.color ?? colorDeSerie(i, modo)}
              radius={apilado ? 0 : horizontal ? [0, 6, 6, 0] : [6, 6, 0, 0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </figure>
  );
}

export interface PorcionDona {
  name: string;
  value: number;
  color?: string;
}

/**
 * Dona. Para proporciones de UN total, con pocas categorías.
 *
 * Con más de siete porciones deja de leerse: quien llama tiene que haber
 * agrupado la cola en "Otros" antes.
 */
export function GraficoDeDona({
  data, height = 240, modo = "pantalla", formato, aria,
}: {
  data: PorcionDona[]; height?: number; modo?: ModoColor; formato?: (v: number) => string; aria: string;
}) {
  return (
    <figure role="img" aria-label={aria} className="w-full">
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="80%" paddingAngle={2}>
            {data.map((d, i) => (
              <Cell key={d.name} fill={d.color ?? colorDeSerie(i, modo)} stroke="none" />
            ))}
          </Pie>
          <Tooltip {...tooltipProps(modo, formato)} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
    </figure>
  );
}

export interface PuntoDispersion {
  x: number;
  y: number;
  z: number;
  name: string;
}

/**
 * Dispersión. El gráfico que una lista ordenada NO puede dar: dos variables a la
 * vez. Con margen en un eje y volumen en el otro se ven los cuatro cuadrantes —
 * qué vendés mucho y te deja poco, y al revés.
 */
export function GraficoDeDispersion({
  data, height = 300, modo = "pantalla", etiquetaX, etiquetaY, formatoX, formatoY, aria,
}: {
  data: PuntoDispersion[];
  height?: number;
  modo?: ModoColor;
  etiquetaX: string;
  etiquetaY: string;
  formatoX?: (v: number) => string;
  formatoY?: (v: number) => string;
  aria: string;
}) {
  return (
    <figure role="img" aria-label={aria} className="w-full">
      <ResponsiveContainer width="100%" height={height}>
        <ScatterChart margin={{ top: 8, right: 16, left: 0, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={color(CHROME.grid, modo)} />
          <XAxis
            type="number" dataKey="x" name={etiquetaX} {...ejeProps(modo)}
            tickFormatter={formatoX}
            label={{ value: etiquetaX, position: "insideBottom", offset: -12, fontSize: 11, fill: color(CHROME.texto, modo) }}
          />
          <YAxis
            type="number" dataKey="y" name={etiquetaY} {...ejeProps(modo)} width={64}
            tickFormatter={formatoY}
          />
          {/* El tamaño del punto es una TERCERA variable (la facturación): sin
              esto, un producto de dos ventas pesa lo mismo que uno de mil. */}
          <ZAxis type="number" dataKey="z" range={[40, 400]} />
          <Tooltip
            {...tooltipProps(modo, undefined)}
            cursor={{ strokeDasharray: "3 3" }}
            formatter={(v: unknown, n: unknown) =>
              [typeof v === "number"
                ? (n === etiquetaY ? (formatoY?.(v) ?? String(v)) : (formatoX?.(v) ?? String(v)))
                : String(v ?? ""), String(n ?? "")] as [string, string]}
          />
          <Scatter data={data} fill={color(SEMANTICOS.acento, modo)} fillOpacity={0.65} />
        </ScatterChart>
      </ResponsiveContainer>
    </figure>
  );
}

/**
 * Pareto: barras de facturación por producto más la curva del acumulado.
 *
 * Responde "¿cuántos artículos me hacen el 80%?", que es la pregunta con la que
 * se decide qué mirar y qué no.
 */
export function GraficoDePareto({
  data, height = 300, modo = "pantalla", formato, aria,
}: {
  data: { name: string; revenue: number; acumuladoPct: number }[];
  height?: number; modo?: ModoColor; formato?: (v: number) => string; aria: string;
}) {
  return (
    <figure role="img" aria-label={aria} className="w-full">
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 8, right: 48, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={color(CHROME.grid, modo)} />
          <XAxis dataKey="name" {...ejeProps(modo)} tick={false} />
          <YAxis yAxisId="izq" {...ejeProps(modo)} width={64} tickFormatter={formato} />
          <YAxis
            yAxisId="der" orientation="right" domain={[0, 100]} {...ejeProps(modo)} width={44}
            tickFormatter={(v: number) => `${v}%`}
          />
          <Tooltip {...tooltipProps(modo, formato)} cursor={{ fill: color(CHROME.grid, modo), opacity: 0.25 }} />
          <Bar yAxisId="izq" dataKey="revenue" name="Facturación" fill={color(SEMANTICOS.acento, modo)} radius={[4, 4, 0, 0]} />
          <Line
            yAxisId="der" type="monotone" dataKey="acumuladoPct" name="Acumulado"
            stroke={color(SEMANTICOS.aviso, modo)} strokeWidth={2} dot={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </figure>
  );
}
