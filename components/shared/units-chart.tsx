"use client";

import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type UnitsChartProps = {
  data: Array<{ day: string; units: number }>;
};

export function UnitsChart({ data }: UnitsChartProps) {
  return (
    <div className="h-52 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="unitsGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#0891b2" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#0891b2" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={12} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} />
          <Tooltip />
          <Area type="monotone" dataKey="units" stroke="#0e7490" fillOpacity={1} fill="url(#unitsGradient)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
