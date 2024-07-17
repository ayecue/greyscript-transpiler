export const transformBitOperation = (
  expression: string,
  left: string,
  right: string,
  operator: string
): string => {
  if (
    operator === '<<' ||
    operator === '>>' ||
    operator === '>>>' ||
    operator === '|' ||
    operator === '&'
  ) {
    expression =
      'bitwise(' + ['"' + operator + '"', left, right].join(', ') + ')';
  }

  return expression;
};