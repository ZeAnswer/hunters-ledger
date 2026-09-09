import type { EvalContext } from './context';
import { evalExpr } from './expr';
import { countHistory } from './history';
import type { Condition } from './schema';
import { ORDINALS, readSelector, type SelValue } from './selectors';
import { exprVars } from './vars';

function cmp(op: string, a: number, b: number): boolean {
  switch (op) {
    case '=': return a === b;
    case '!=': return a !== b;
    case '<': return a < b;
    case '<=': return a <= b;
    case '>': return a > b;
    case '>=': return a >= b;
    default: return false;
  }
}

/** Resolve the right-hand side of a compare: number, ordinal name, selector path, or expression. */
function rhs(ctx: EvalContext, sel: string, value: number | string, left: SelValue): number | string | undefined {
  if (typeof value === 'number') return value;
  const ord = ORDINALS[sel];
  if (ord) return ord.indexOf(value);
  if (typeof left === 'string' || typeof left === 'boolean') return value;
  if (/^(self|target|attack|battle|flag)\./.test(value)) { const v = readSelector(ctx, value); return typeof v === 'number' ? v : undefined; }
  try { return evalExpr(value, exprVars(ctx)); } catch { return value; }
}

export function evalCondition(cond: Condition, ctx: EvalContext): boolean {
  if ('all' in cond) return cond.all.every((c) => evalCondition(c, ctx));
  if ('any' in cond) return cond.any.some((c) => evalCondition(c, ctx));
  if ('none' in cond) return !cond.none.some((c) => evalCondition(c, ctx));
  if ('not' in cond) return !evalCondition(cond.not, ctx);
  if ('count' in cond) return cond.count.filter((c) => evalCondition(c, ctx)).length >= cond.atLeast;
  if ('is' in cond) { const v = readSelector(ctx, cond.is); return v === true || (typeof v === 'number' && v > 0); }
  if ('exists' in cond) { const v = readSelector(ctx, cond.exists); return v !== undefined && v !== false && !(Array.isArray(v) && v.length === 0); }
  if ('compare' in cond) {
    const left = readSelector(ctx, cond.compare);
    if (left === undefined) return false;
    const ord = ORDINALS[cond.compare];
    const l = ord ? ord.indexOf(String(left)) : typeof left === 'boolean' ? (left ? 1 : 0) : left;
    const r = rhs(ctx, cond.compare, cond.value, left);
    if (r === undefined) return false;
    if (typeof l === 'number' && typeof r === 'number') return cmp(cond.op, l, r);
    if (typeof l === 'string' && typeof r === 'string') return cond.op === '!=' ? l !== r : l === r;
    return false;
  }
  if ('in' in cond) {
    const left = readSelector(ctx, cond.in);
    const set = new Set(cond.set ?? (cond.param ? (readSelector(ctx, `self.param.${cond.param}`) as string[] | undefined) ?? [] : []));
    if (Array.isArray(left)) return left.some((x) => set.has(x));
    return typeof left === 'string' && set.has(left);
  }
  if ('history' in cond) {
    const n = countHistory(ctx, cond.history);
    return cmp(cond.op ?? '>=', n, cond.value ?? 1);
  }
  return false;
}
