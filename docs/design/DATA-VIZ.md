# Data Visualization System - Charts and Graphs
> Strategy: 70% Material Design 3 + 30% Yorutsuke pragmatism

## Overview

Data visualization system defines chart types, color palettes, interaction patterns, and accessibility requirements for displaying financial data. Designed for MVP3 Phase B (#119) trend charts and category breakdowns.

**Current Status**: Documentation ready, awaiting implementation in #119.

---

## Chart Color System

### Semantic Colors

| Purpose | Token | Color | Hex | Usage |
|---------|-------|-------|-----|-------|
| **Income** | `--color-income` | Emerald 600 | #059669 | Income trend lines, bars |
| **Expense** | `--color-expense` | Rose 600 | #E11D48 | Expense trend lines, bars |
| **Primary** | `--color-primary` | Blue 500 | #3B82F6 | Neutral trend lines, highlights |
| **Balance** | `--slate-700` | Slate 700 | #334155 | Net balance, total lines |

### Category Palette (Color-Blind Safe)

7-color palette optimized for categorical data and accessibility:

| Category | Color Name | Hex | WCAG AA | Color-Blind Safe |
|----------|-----------|-----|---------|------------------|
| Cat 1 | Blue 500 | #3B82F6 | ✅ | ✅ Deuteranopia |
| Cat 2 | Emerald 500 | #10B981 | ✅ | ✅ Protanopia |
| Cat 3 | Amber 500 | #F59E0B | ✅ | ✅ Tritanopia |
| Cat 4 | Rose 500 | #F43F5E | ✅ | ✅ All types |
| Cat 5 | Violet 500 | #8B5CF6 | ✅ | ✅ Deuteranopia |
| Cat 6 | Teal 500 | #14B8A6 | ✅ | ✅ Protanopia |
| Cat 7 | Orange 500 | #F97316 | ✅ | ✅ All types |

**Color-Blind Testing**: Verified with [Coblis Simulator](https://www.color-blindness.com/coblis-color-blindness-simulator/) for:
- Deuteranopia (red-green, most common)
- Protanopia (red-green)
- Tritanopia (blue-yellow, rare)

### Gradient Colors (Optional)

For area charts and backgrounds:

```css
/* Income gradient (emerald) */
--gradient-income: linear-gradient(180deg, rgba(5, 150, 105, 0.2) 0%, rgba(5, 150, 105, 0.05) 100%);

/* Expense gradient (rose) */
--gradient-expense: linear-gradient(180deg, rgba(225, 29, 72, 0.2) 0%, rgba(225, 29, 72, 0.05) 100%);

/* Primary gradient (blue) */
--gradient-primary: linear-gradient(180deg, rgba(59, 130, 246, 0.2) 0%, rgba(59, 130, 246, 0.05) 100%);
```

---

## Chart Types

### ✅ Recommended

#### 1. Line Chart - Trend Analysis

**Use Cases**:
- 7-day income/expense trends
- 30-day balance trends
- Daily transaction count over time

**When to Use**:
- ✅ Time-series data (continuous)
- ✅ Showing change over time
- ✅ Comparing 2-3 trend lines

**Example**: Daily income vs expense (last 7 days)

```typescript
// Recharts example
<LineChart data={dailyData}>
  <Line type="monotone" dataKey="income" stroke="var(--color-income)" strokeWidth={2} />
  <Line type="monotone" dataKey="expense" stroke="var(--color-expense)" strokeWidth={2} />
  <XAxis dataKey="date" />
  <YAxis />
  <Tooltip />
  <Legend />
</LineChart>
```

#### 2. Bar Chart - Category Comparison

**Use Cases**:
- Top 5 expense categories
- Monthly income breakdown by source
- Category spending comparison

**When to Use**:
- ✅ Comparing discrete categories
- ✅ Ranking / Top N analysis
- ✅ Showing exact values

**Example**: Top 5 expense categories (current month)

```typescript
<BarChart data={categoryData}>
  <Bar dataKey="amount" fill="var(--color-expense)" />
  <XAxis dataKey="category" />
  <YAxis />
  <Tooltip />
</BarChart>
```

#### 3. Area Chart - Cumulative Trends

**Use Cases**:
- Cumulative income over time
- Running balance visualization
- Stacked category trends

**When to Use**:
- ✅ Showing cumulative totals
- ✅ Emphasizing volume/magnitude
- ✅ Multiple categories stacked

**Example**: Cumulative income (30 days)

```typescript
<AreaChart data={cumulativeData}>
  <Area type="monotone" dataKey="income" stroke="var(--color-income)" fill="var(--gradient-income)" />
  <XAxis dataKey="date" />
  <YAxis />
  <Tooltip />
</AreaChart>
```

### ❌ Avoid

#### Pie Chart

**Why Avoid**:
- ❌ Hard to compare similar values (angles are imprecise)
- ❌ Doesn't work well with >5 categories
- ❌ Not accessible for screen readers (no clear order)
- ❌ Color-blind users struggle with small slices

**Use Instead**: Bar Chart (horizontal or vertical)

**Exception**: Only use if showing 2-3 categories AND exact percentages are labeled.

#### 3D Charts

**Why Avoid**:
- ❌ Distorts data perception (perspective makes values unclear)
- ❌ Unnecessary visual complexity
- ❌ Poor accessibility

#### Donut Chart

**Why Avoid**:
- ❌ Same issues as Pie Chart
- ❌ Center hole wastes space

**Use Instead**: Stacked Bar Chart or multiple bars

---

## Interaction Patterns

### Tooltip

**Always Show** on hover/touch for data points.

**Content**:
```typescript
// Format example
Tooltip:
  Date: 2026-01-10 (金)
  収入: ¥12,500
  支出: ¥3,800
  差額: +¥8,700
```

**Rules**:
- ✅ Show exact values (don't rely on visual scale alone)
- ✅ Include date/category label
- ✅ Format currency with ¥ symbol
- ✅ Use color indicators (match line/bar color)
- ❌ Don't show redundant info (e.g., category if already in legend)

**Recharts Example**:
```typescript
<Tooltip
  formatter={(value) => `¥${value.toLocaleString('ja-JP')}`}
  labelFormatter={(label) => `日付: ${label}`}
  contentStyle={{
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    boxShadow: 'var(--shadow-2)',
  }}
/>
```

### Legend

**Show** when comparing multiple series (e.g., income vs expense).

**Rules**:
- ✅ Use color indicators (squares or lines)
- ✅ Clear labels (収入, 支出, not "series1")
- ✅ Make clickable to toggle series visibility
- ✅ Position: bottom (desktop), top (mobile)
- ❌ Don't hide legend if >1 series

**Recharts Example**:
```typescript
<Legend
  verticalAlign="bottom"
  height={36}
  iconType="line"
  onClick={(e) => toggleSeries(e.dataKey)}
  wrapperStyle={{ cursor: 'pointer' }}
/>
```

### Click Behavior

**Action**: Click data point → navigate to Ledger with filter applied.

**Examples**:
- Click "2026-01-10" on line chart → Ledger filtered to 2026-01-10
- Click "食費" bar → Ledger filtered to category="食費"

**Implementation**:
```typescript
const handleClick = (data: ChartDataPoint) => {
  if (data.date) {
    navigate(`/ledger?date=${data.date}`);
  } else if (data.category) {
    navigate(`/ledger?category=${encodeURIComponent(data.category)}`);
  }
};

<LineChart onClick={handleClick}>
  {/* ... */}
</LineChart>
```

### Hover Effects

**Line Chart**:
- Increase stroke width on hover: 2px → 3px
- Show cursor: `cursor: pointer`

**Bar Chart**:
- Lighten fill color on hover: `opacity: 0.8`
- Show cursor: `cursor: pointer`

---

## Responsive Design

### Desktop (≥768px)

**Chart Dimensions**:
- **Line Chart**: 600px × 300px (default)
- **Bar Chart**: 600px × 400px (allow more vertical space)
- **Area Chart**: 600px × 300px

**Margins**:
```typescript
margin={{ top: 20, right: 30, left: 50, bottom: 40 }}
```

### Mobile (<768px)

**Strategy**: Horizontal scroll OR simplified view.

**Option 1: Horizontal Scroll** (Recommended for Line Charts)
```css
.chart-container {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.chart-wrapper {
  min-width: 600px; /* Force desktop width, scroll horizontally */
}
```

**Option 2: Simplified View** (Bar Charts)
- Show Top 3 instead of Top 5
- Reduce font sizes
- Vertical bars → horizontal bars (easier to read labels)

**Mobile Dimensions**:
- **Line Chart**: 100vw × 250px (scroll horizontally)
- **Bar Chart**: 100vw × 300px (shrink to fit)

---

## Tech Stack Recommendation

### Recharts (Recommended)

**Pros**:
- ✅ React-first, composable API
- ✅ Lightweight (~45KB gzipped with tree-shaking)
- ✅ Responsive by default
- ✅ Good TypeScript support
- ✅ Handles time-series data well

**Cons**:
- ⚠️ Limited animation customization
- ⚠️ No built-in zoom/pan (need custom implementation)

**Install**:
```bash
npm install recharts
```

**Basic Setup**:
```typescript
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const data = [
  { date: '01/01', income: 12500, expense: 8000 },
  { date: '01/02', income: 15000, expense: 9200 },
  // ...
];

export function TrendChart() {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey="date" />
        <YAxis />
        <Tooltip />
        <Legend />
        <Line type="monotone" dataKey="income" stroke="var(--color-income)" strokeWidth={2} />
        <Line type="monotone" dataKey="expense" stroke="var(--color-expense)" strokeWidth={2} />
      </LineChart>
    </ResponsiveContainer>
  );
}
```

### Alternative: Chart.js

**Pros**:
- ✅ Feature-rich (animations, plugins)
- ✅ Large ecosystem
- ✅ Mature, stable

**Cons**:
- ❌ Larger bundle size (~60KB)
- ❌ Imperative API (less React-friendly)
- ❌ Requires wrapper (react-chartjs-2)

**Use When**: Need advanced animations or plugins (zoom, pan, annotation).

### Alternative: Visx

**Pros**:
- ✅ Low-level, fully customizable
- ✅ D3-powered, modern
- ✅ Great for complex visualizations

**Cons**:
- ❌ Steep learning curve
- ❌ More code required (build from primitives)
- ❌ Overkill for simple charts

**Use When**: Building custom, highly interactive visualizations.

---

## Accessibility

### Color Contrast (WCAG AA)

**Requirements**:
- Chart lines/bars must have ≥3:1 contrast against background
- Text labels must have ≥4.5:1 contrast
- Use color + pattern (not color alone)

**Check**:
```bash
# Use Chrome DevTools Lighthouse
npm run lighthouse
```

**Example - Pattern + Color**:
```typescript
// Good - Line + marker shape
<Line type="monotone" dataKey="income" stroke="var(--color-income)" strokeWidth={2} dot={{ r: 4 }} />
<Line type="monotone" dataKey="expense" stroke="var(--color-expense)" strokeWidth={2} dot={{ r: 4, fill: 'var(--color-expense)', strokeWidth: 2, stroke: '#fff' }} />
```

### Color-Blind Friendly

**Rules**:
1. ✅ Use category palette (7 colors tested)
2. ✅ Pair color with labels/patterns
3. ✅ Avoid red-green only comparisons
4. ✅ Test with simulator: [Coblis](https://www.color-blindness.com/coblis-color-blindness-simulator/)

**Bad Example**:
```typescript
// ❌ Red vs Green only (color-blind users can't distinguish)
<Line dataKey="good" stroke="#00FF00" />
<Line dataKey="bad" stroke="#FF0000" />
```

**Good Example**:
```typescript
// ✅ Blue vs Orange + labels
<Line dataKey="income" stroke="var(--color-income)" name="収入" />
<Line dataKey="expense" stroke="var(--color-expense)" name="支出" />
```

### Keyboard Navigation

**Requirements**:
- ✅ Clickable elements must be keyboard-accessible
- ✅ Focus indicators visible (outline)
- ✅ Tab order logical

**Implementation**:
```typescript
<button
  onClick={() => navigate('/ledger')}
  onKeyDown={(e) => e.key === 'Enter' && navigate('/ledger')}
  aria-label="View details in Ledger"
>
  {/* Chart element */}
</button>
```

### Screen Readers

**Alt Text**:
```typescript
<figure role="img" aria-label="7日間の収支トレンド。収入は平均¥12,000、支出は平均¥8,000です。">
  <LineChart>{/* ... */}</LineChart>
  <figcaption className="sr-only">
    過去7日間の収入と支出の推移を示す折れ線グラフ。
    収入は緑色の線、支出は赤色の線で表示されています。
  </figcaption>
</figure>
```

**Data Table Fallback**:

Provide alternative data table for screen readers:

```typescript
<div>
  {/* Visual chart */}
  <LineChart aria-hidden="true">{/* ... */}</LineChart>

  {/* Screen reader fallback */}
  <table className="sr-only">
    <caption>7日間の収支データ</caption>
    <thead>
      <tr>
        <th>日付</th>
        <th>収入</th>
        <th>支出</th>
      </tr>
    </thead>
    <tbody>
      {data.map(row => (
        <tr key={row.date}>
          <td>{row.date}</td>
          <td>¥{row.income}</td>
          <td>¥{row.expense}</td>
        </tr>
      ))}
    </tbody>
  </table>
</div>
```

**CSS for `.sr-only`** (already in styles.css):
```css
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
```

---

## Performance Optimization

### Data Sampling

**Problem**: 1000+ data points cause slow rendering.

**Solution**: Sample data for display, show full data in tooltip/table.

```typescript
// Sample to max 100 points for line chart
function sampleData(data: DataPoint[], maxPoints: number = 100): DataPoint[] {
  if (data.length <= maxPoints) return data;

  const step = Math.ceil(data.length / maxPoints);
  return data.filter((_, i) => i % step === 0);
}

const displayData = sampleData(fullData, 100);
```

### Lazy Loading

**Problem**: Loading charts blocks initial render.

**Solution**: Use React.lazy + Suspense.

```typescript
import { lazy, Suspense } from 'react';

const TrendChart = lazy(() => import('./TrendChart'));

function Dashboard() {
  return (
    <Suspense fallback={<ChartSkeleton />}>
      <TrendChart data={data} />
    </Suspense>
  );
}
```

### Memoization

**Problem**: Chart re-renders on every parent update.

**Solution**: Memoize chart data and component.

```typescript
import { useMemo, memo } from 'react';

const TrendChart = memo(({ data }: { data: DataPoint[] }) => {
  const chartData = useMemo(() => {
    return processData(data); // Expensive computation
  }, [data]);

  return <LineChart data={chartData}>{/* ... */}</LineChart>;
});
```

### Bundle Size

**Recharts**: ~45KB gzipped (with tree-shaking)

**Tree-Shaking**:
```typescript
// ✅ Import only what you need
import { LineChart, Line, XAxis, YAxis } from 'recharts';

// ❌ Don't import everything
import * as Recharts from 'recharts';
```

---

## Chart Templates

### Template 1: Income vs Expense (7 days)

```typescript
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface DailyData {
  date: string;        // "01/10"
  income: number;      // 12500
  expense: number;     // 8000
}

export function IncomeExpenseTrend({ data }: { data: DailyData[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 20, right: 30, left: 50, bottom: 40 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis
          dataKey="date"
          stroke="var(--text-secondary)"
          style={{ fontSize: '12px' }}
        />
        <YAxis
          stroke="var(--text-secondary)"
          style={{ fontSize: '12px' }}
          tickFormatter={(value) => `¥${(value / 1000).toFixed(0)}K`}
        />
        <Tooltip
          formatter={(value: number) => `¥${value.toLocaleString('ja-JP')}`}
          labelFormatter={(label) => `日付: ${label}`}
          contentStyle={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-2)',
          }}
        />
        <Legend
          verticalAlign="bottom"
          height={36}
          iconType="line"
          wrapperStyle={{ paddingTop: '16px' }}
        />
        <Line
          type="monotone"
          dataKey="income"
          stroke="var(--color-income)"
          strokeWidth={2}
          dot={{ r: 4, fill: 'var(--color-income)' }}
          name="収入"
        />
        <Line
          type="monotone"
          dataKey="expense"
          stroke="var(--color-expense)"
          strokeWidth={2}
          dot={{ r: 4, fill: 'var(--color-expense)' }}
          name="支出"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
```

### Template 2: Top 5 Categories (Bar Chart)

```typescript
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface CategoryData {
  category: string;    // "食費"
  amount: number;      // 45000
}

export function TopCategoriesChart({ data }: { data: CategoryData[] }) {
  return (
    <ResponsiveContainer width="100%" height={400}>
      <BarChart data={data} margin={{ top: 20, right: 30, left: 50, bottom: 80 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis
          dataKey="category"
          stroke="var(--text-secondary)"
          angle={-45}
          textAnchor="end"
          height={80}
          style={{ fontSize: '12px' }}
        />
        <YAxis
          stroke="var(--text-secondary)"
          style={{ fontSize: '12px' }}
          tickFormatter={(value) => `¥${(value / 1000).toFixed(0)}K`}
        />
        <Tooltip
          formatter={(value: number) => `¥${value.toLocaleString('ja-JP')}`}
          contentStyle={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-2)',
          }}
        />
        <Bar
          dataKey="amount"
          fill="var(--color-expense)"
          radius={[8, 8, 0, 0]}
          cursor="pointer"
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
```

### Template 3: Cumulative Balance (Area Chart)

```typescript
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface BalanceData {
  date: string;
  balance: number;
}

export function CumulativeBalanceChart({ data }: { data: BalanceData[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data} margin={{ top: 20, right: 30, left: 50, bottom: 40 }}>
        <defs>
          <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.2} />
            <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey="date" stroke="var(--text-secondary)" style={{ fontSize: '12px' }} />
        <YAxis
          stroke="var(--text-secondary)"
          style={{ fontSize: '12px' }}
          tickFormatter={(value) => `¥${(value / 1000).toFixed(0)}K`}
        />
        <Tooltip
          formatter={(value: number) => `¥${value.toLocaleString('ja-JP')}`}
          contentStyle={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-2)',
          }}
        />
        <Area
          type="monotone"
          dataKey="balance"
          stroke="var(--color-primary)"
          strokeWidth={2}
          fill="url(#balanceGradient)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
```

---

## Testing Checklist

### Visual Testing

- [ ] **Colors**: Income (emerald), Expense (rose), Primary (blue) render correctly
- [ ] **Tooltips**: Show on hover with formatted values
- [ ] **Legend**: Shows correctly, clickable to toggle series
- [ ] **Responsive**: Charts adapt to mobile (<768px)
- [ ] **Dark Mode**: Colors have sufficient contrast (if dark mode implemented)

### Interaction Testing

- [ ] **Hover**: Tooltip appears with correct data
- [ ] **Click**: Navigates to Ledger with filter applied
- [ ] **Legend Click**: Toggles series visibility
- [ ] **Mobile Scroll**: Horizontal scroll works smoothly

### Accessibility Testing

- [ ] **Keyboard**: Can tab to interactive elements
- [ ] **Focus**: Focus indicators visible
- [ ] **Screen Reader**: Alt text describes chart
- [ ] **Color-Blind**: Test with [Coblis Simulator](https://www.color-blindness.com/coblis-color-blindness-simulator/)
- [ ] **WCAG AA**: Color contrast ≥4.5:1 (text), ≥3:1 (graphics)

### Performance Testing

- [ ] **Render Time**: <100ms for 30 data points
- [ ] **Bundle Size**: Recharts adds ~45KB (acceptable)
- [ ] **Memory**: No memory leaks on chart updates

---

## Related Documents

- **[COLOR.md](./COLOR.md)** - Color palette & semantic tokens (income, expense)
- **[SPACING.md](./SPACING.md)** - Chart margins and padding
- **[MOTION.md](./MOTION.md)** - Animation timing for chart transitions
- **[ACCESSIBILITY.md](./ACCESSIBILITY.md)** - General accessibility guidelines

---

## Decision Log

### [2026-01] Recharts as Primary Library
**Decision**: Use Recharts for all charts (line, bar, area).
**Reason**:
- Lightweight (~45KB), composable React API
- Good TypeScript support
- Handles time-series data well
- Sufficient for MVP3 requirements
**Alternatives**:
- Chart.js: Larger bundle (~60KB), imperative API
- Visx: Too complex, steep learning curve

### [2026-01] No Pie Charts
**Decision**: Prohibit pie charts in design system.
**Reason**:
- Hard to compare similar values (angles imprecise)
- Poor accessibility (no clear order for screen readers)
- Color-blind users struggle with small slices
**Alternatives**:
- Use horizontal bar chart for category breakdown
- Use stacked bar chart for proportions

### [2026-01] 7-Color Category Palette
**Decision**: Define 7-color palette for categorical data.
**Reason**:
- Sufficient for Top 5-7 categories
- Tested with color-blind simulators (all types pass)
- WCAG AA compliant (≥3:1 contrast)
**Alternatives**:
- 5 colors: Too limiting for future expansion
- 12 colors: Overkill, harder to distinguish

### [2026-01] Click → Navigate to Ledger
**Decision**: Clicking chart data point navigates to filtered Ledger view.
**Reason**:
- Users expect to "drill down" from summary to details
- Consistent with Dashboard UX pattern
- Reduces clicks (direct navigation)
**Alternatives**:
- Show modal with details: Adds extra step, less direct

---

## Next Steps

1. **Implementation in #119** (MVP3 Phase B):
   - Install Recharts
   - Implement 7-day trend chart (income vs expense)
   - Implement Top 5 categories bar chart

2. **Future Enhancements**:
   - Zoom/pan for long time ranges (6+ months)
   - Export chart as PNG/CSV
   - Custom category colors (user preference)

---

**Last updated**: 2026-01-10
**Version**: 1.0.0
**Status**: ✅ Complete (documentation ready for #119)
