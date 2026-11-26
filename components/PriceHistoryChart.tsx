'use client';

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { buildPriceChartData, type ChartLink } from '@/lib/chart-data';

const LINE_COLORS = ['#2563eb', '#16a34a', '#d97706', '#dc2626', '#7c3aed', '#0891b2'];

export function PriceHistoryChart({ links }: { links: ChartLink[] }) {
  const data = buildPriceChartData(links);

  if (data.length === 0) {
    return <p className="text-sm text-slate-500">No price history yet — check back after the next price check.</p>;
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="date" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} width={60} />
          <Tooltip />
          <Legend />
          {links.map((link, i) => (
            <Line
              key={link.id}
              type="monotone"
              dataKey={link.storeName}
              stroke={LINE_COLORS[i % LINE_COLORS.length]}
              connectNulls
              dot={{ r: 2 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
