/**
 * Tiny expression language for numeric values in content packs.
 * Grammar: expr := term (('+'|'-') term)* ; term := unary (('*'|'/') unary)* ;
 * unary := '-' unary | primary ; primary := number | ident | ident '(' args ')' | '(' expr ')'
 * Functions: floor, min, max, classLevel(<classId>), prompt(<promptId>).
 */
export type ExprVars = {
  [name: string]: number | Record<string, number> | undefined;
  classLevel?: Record<string, number>;
  prompt?: Record<string, number>;
};

export type Expr = number | string;

export function evalExpr(expr: Expr, vars: ExprVars): number {
  if (typeof expr === 'number') return expr;
  const p = new Parser(expr, vars);
  const v = p.parseExpr();
  p.expectEnd();
  return v;
}

class Parser {
  private i = 0;
  private src: string;
  private vars: ExprVars;
  constructor(src: string, vars: ExprVars) {
    this.src = src;
    this.vars = vars;
  }

  parseExpr(): number {
    let v = this.parseTerm();
    for (;;) {
      this.ws();
      const c = this.src[this.i];
      if (c === '+' || c === '-') {
        this.i++;
        const r = this.parseTerm();
        v = c === '+' ? v + r : v - r;
      } else return v;
    }
  }

  private parseTerm(): number {
    let v = this.parseUnary();
    for (;;) {
      this.ws();
      const c = this.src[this.i];
      if (c === '*' || c === '/') {
        this.i++;
        const r = this.parseUnary();
        v = c === '*' ? v * r : v / r;
      } else return v;
    }
  }

  private parseUnary(): number {
    this.ws();
    if (this.src[this.i] === '-') {
      this.i++;
      return -this.parseUnary();
    }
    return this.parsePrimary();
  }

  private parsePrimary(): number {
    this.ws();
    const c = this.src[this.i];
    if (c === undefined) throw new Error(`Unexpected end of expression: "${this.src}"`);
    if (c === '(') {
      this.i++;
      const v = this.parseExpr();
      this.expect(')');
      return v;
    }
    const num = /^\d+(\.\d+)?/.exec(this.src.slice(this.i));
    if (num) {
      this.i += num[0].length;
      return Number(num[0]);
    }
    const id = /^[A-Za-z_][A-Za-z0-9_]*/.exec(this.src.slice(this.i));
    if (!id) throw new Error(`Unexpected "${c}" at ${this.i} in "${this.src}"`);
    this.i += id[0].length;
    const name = id[0];
    this.ws();
    if (this.src[this.i] === '(') {
      this.i++;
      return this.callFn(name);
    }
    const v = this.vars[name];
    if (typeof v !== 'number') throw new Error(`Unknown variable "${name}" in "${this.src}"`);
    return v;
  }

  private callFn(name: string): number {
    if (name === 'classLevel' || name === 'prompt') {
      this.ws();
      const id = /^[A-Za-z_][A-Za-z0-9_.-]*/.exec(this.src.slice(this.i));
      if (!id) throw new Error(`${name}() needs an identifier in "${this.src}"`);
      this.i += id[0].length;
      this.expect(')');
      const table = (this.vars[name] ?? {}) as Record<string, number>;
      return table[id[0]] ?? 0;
    }
    const args: number[] = [];
    for (;;) {
      args.push(this.parseExpr());
      this.ws();
      if (this.src[this.i] === ',') { this.i++; continue; }
      this.expect(')');
      break;
    }
    switch (name) {
      case 'floor': return Math.floor(args[0] ?? 0);
      case 'min': return Math.min(...args);
      case 'max': return Math.max(...args);
      default: throw new Error(`Unknown function "${name}" in "${this.src}"`);
    }
  }

  private ws() { while (this.src[this.i] === ' ') this.i++; }
  private expect(ch: string) {
    this.ws();
    if (this.src[this.i] !== ch) throw new Error(`Expected "${ch}" at ${this.i} in "${this.src}"`);
    this.i++;
  }
  expectEnd() {
    this.ws();
    if (this.i < this.src.length) throw new Error(`Unexpected "${this.src[this.i]}" at ${this.i} in "${this.src}"`);
  }
}
