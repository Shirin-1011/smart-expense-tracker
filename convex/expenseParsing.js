const MATH_CHAR_REGEX = /[0-9+\-*/().,\s]/;
const OPERATOR_REGEX = /[+\-*/]/;
const NUMBER_REGEX = /\d+(?:\.\d+)?/g;
const MAX_EXPRESSION_LENGTH = 90;

export function annotateArithmeticExpressions(input) {
  const evaluations = extractArithmeticEvaluations(input);

  if (!evaluations.length) {
    return String(input ?? "");
  }

  const lines = evaluations.map(
    ({ expression, value }) => `- ${expression} = ${formatNumber(value)}`
  );

  return `${input}\n\nDetected arithmetic expressions, already evaluated:\n${lines.join("\n")}`;
}

export function extractArithmeticEvaluations(input) {
  const text = String(input ?? "");
  const candidates = [];
  let start = null;

  for (let index = 0; index <= text.length; index++) {
    const char = text[index];

    if (char && MATH_CHAR_REGEX.test(char)) {
      start ??= index;
      continue;
    }

    if (start !== null) {
      const candidate = trimExpressionEdges(text.slice(start, index));
      if (candidate) candidates.push(candidate);
      start = null;
    }
  }

  const uniqueCandidates = [...new Set(candidates)];
  const results = [];

  for (const candidate of uniqueCandidates) {
    const expression = normalizeExpression(candidate);
    const value = evaluateArithmeticExpression(expression);

    if (value === null) continue;
    if (results.some((result) => result.expression === expression)) continue;

    results.push({ expression, value: roundCurrency(value) });
  }

  return results;
}

export function evaluateArithmeticExpression(expression) {
  const normalized = normalizeExpression(expression);
  const numbers = normalized.match(NUMBER_REGEX) ?? [];

  if (
    normalized.length === 0 ||
    normalized.length > MAX_EXPRESSION_LENGTH ||
    !OPERATOR_REGEX.test(normalized) ||
    numbers.length < 2 ||
    /[^0-9+\-*/().\s]/.test(normalized) ||
    !hasBalancedParentheses(normalized)
  ) {
    return null;
  }

  const parser = createExpressionParser(normalized);
  const value = parser.parseExpression();

  if (!Number.isFinite(value) || !parser.isComplete()) {
    return null;
  }

  return value;
}

export function normalizeExpenseDescription(description) {
  if (typeof description !== "string") {
    return "";
  }

  const original = description.trim();
  const cleaned = original
    .replace(/\([^)]*[+\-*/][^)]*\)/g, " ")
    .replace(/(?:₹|rs\.?|inr)\s*\d+(?:\.\d+)?/gi, " ")
    .replace(/\b\d+(?:\.\d+)?\s*(?:rs|inr|rupees)\b/gi, " ")
    .replace(/\b(?:paid\s+by|was\s+paid\s+by|payer\s+is)\b[\s\S]*$/i, "")
    .replace(/\b(?:split|splitting|share|shared|exclude|excluding|except|rest\s+all|in\s+which|where)\b[\s\S]*$/i, "")
    .replace(/\b(?:paid|pays|paying)\b\s*(?:for)?/gi, " ")
    .replace(/\b(?:me|you|him|her|them)\b$/i, "")
    .replace(/["'`]/g, "")
    .replace(/\s+/g, " ")
    .replace(/^[\s:;,.\-]+|[\s:;,.\-]+$/g, "")
    .trim();

  return (cleaned || original).slice(0, 80);
}

export function normalizePossiblyExpressionNumber(value) {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value !== "string") {
    return Number(value);
  }

  const evaluated = evaluateArithmeticExpression(value);
  if (evaluated !== null) {
    return evaluated;
  }

  return Number(value.replace(/,/g, ""));
}

function createExpressionParser(expression) {
  let index = 0;

  function skipWhitespace() {
    while (expression[index] === " ") index++;
  }

  function parseExpression() {
    let value = parseTerm();

    while (true) {
      skipWhitespace();
      const operator = expression[index];
      if (operator !== "+" && operator !== "-") break;
      index++;
      const nextValue = parseTerm();
      value = operator === "+" ? value + nextValue : value - nextValue;
    }

    return value;
  }

  function parseTerm() {
    let value = parseFactor();

    while (true) {
      skipWhitespace();
      const operator = expression[index];
      if (operator !== "*" && operator !== "/") break;
      index++;
      const nextValue = parseFactor();
      if (operator === "/" && nextValue === 0) return Number.NaN;
      value = operator === "*" ? value * nextValue : value / nextValue;
    }

    return value;
  }

  function parseFactor() {
    skipWhitespace();

    if (expression[index] === "+" || expression[index] === "-") {
      const operator = expression[index++];
      const value = parseFactor();
      return operator === "-" ? -value : value;
    }

    if (expression[index] === "(") {
      index++;
      const value = parseExpression();
      skipWhitespace();
      if (expression[index] !== ")") return Number.NaN;
      index++;
      return value;
    }

    return parseNumber();
  }

  function parseNumber() {
    skipWhitespace();
    const match = expression.slice(index).match(/^\d+(?:\.\d+)?/);

    if (!match) {
      return Number.NaN;
    }

    index += match[0].length;
    return Number(match[0]);
  }

  function isComplete() {
    skipWhitespace();
    return index === expression.length;
  }

  return { parseExpression, isComplete };
}

function normalizeExpression(expression) {
  return String(expression ?? "")
    .replace(/,/g, "")
    .replace(/×/g, "*")
    .replace(/÷/g, "/")
    .replace(/\s+/g, " ")
    .trim();
}

function trimExpressionEdges(value) {
  return value
    .replace(/^[\s+*/.)-]+/, "")
    .replace(/[\s+*/.(,-]+$/, "")
    .trim();
}

function hasBalancedParentheses(expression) {
  let depth = 0;

  for (const char of expression) {
    if (char === "(") depth++;
    if (char === ")") depth--;
    if (depth < 0) return false;
  }

  return depth === 0;
}

function roundCurrency(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function formatNumber(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}