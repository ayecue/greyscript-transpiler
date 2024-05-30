import {
  ASTBase,
  ASTEvaluationExpression,
  ASTParenthesisExpression,
  Operator
} from 'miniscript-core';

export const SHORTHAND_OPERATORS = [
  Operator.Plus,
  Operator.Minus,
  Operator.Asterik,
  Operator.Slash,
  Operator.Modulo,
  Operator.Power
] as string[];

export const countEvaluationExpressions = (
  item: ASTEvaluationExpression
): number => {
  const queue = [item];
  let count = 0;

  while (queue.length > 0) {
    const current = queue.pop();

    if (current.left instanceof ASTEvaluationExpression)
      queue.push(current.left);
    if (current.right instanceof ASTEvaluationExpression)
      queue.push(current.right);
    count++;
  }

  return count;
};

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

export const unwrap = (node: ASTBase): ASTBase => {
  while (node instanceof ASTParenthesisExpression) {
    node = node.expression;
  }
  return node;
};
