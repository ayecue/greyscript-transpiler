import {
  BeautifyFactory as BasicBeautifyFactory,
  BeautifyOptions,
  BeautifyUtils,
  createExpressionHash,
  TokenType,
  TransformerDataObject,
  TransformerLike,
  unwrap
} from 'greybel-transpiler';
import { ASTImportCodeExpression } from 'greyscript-core';
import {
  ASTAssignmentStatement,
  ASTBinaryExpression,
  ASTIdentifier,
  ASTMemberExpression
} from 'miniscript-core';

import { injectImport } from '../utils/inject-imports';

export class BeautifyFactory extends BasicBeautifyFactory {
  constructor(options: TransformerLike<BeautifyOptions>) {
    super(options);
    this.extend();
  }

  extend() {
    this.handlers = {
      ...this.handlers,
      AssignmentStatement: function (
        this: BeautifyFactory,
        item: ASTAssignmentStatement,
        _data: TransformerDataObject
      ): void {
        const variable = item.variable;
        const init = item.init;

        this.process(variable);

        // might can create shorthand for expression
        if (
          this.context.options.isDevMode &&
          (variable instanceof ASTIdentifier ||
            variable instanceof ASTMemberExpression) &&
          init instanceof ASTBinaryExpression &&
          (init.left instanceof ASTIdentifier ||
            init.left instanceof ASTMemberExpression) &&
          BeautifyUtils.SHORTHAND_OPERATORS.includes(init.operator) &&
          createExpressionHash(variable) === createExpressionHash(init.left)
        ) {
          this.tokens.push({
            type: TokenType.Text,
            value: ' ' + init.operator + '= ',
            ref: item
          });
          this.process(unwrap(init.right));
          return;
        }

        this.tokens.push({
          type: TokenType.Text,
          value: ' = ',
          ref: item
        });

        this.process(init);
      },
      BinaryExpression: function (
        this: BeautifyFactory,
        item: ASTBinaryExpression,
        _data: TransformerDataObject
      ): void {
        if (
          item.operator === '<<' ||
          item.operator === '>>' ||
          item.operator === '>>>' ||
          item.operator === '|' ||
          item.operator === '&'
        ) {
          this.tokens.push({
            type: TokenType.Text,
            value: `bitwise("${item.operator}", `,
            ref: item
          });
          this.process(item.left);
          this.tokens.push({
            type: TokenType.Text,
            value: ', ',
            ref: item
          });
          this.process(item.right);
          this.tokens.push({
            type: TokenType.Text,
            value: ')',
            ref: item
          });
          return;
        }

        this.process(item.left);
        this.tokens.push({
          type: TokenType.Text,
          value: ' ' + item.operator + ' ',
          ref: item
        });
        this.process(item.right);
      },
      ImportCodeExpression: function (
        this: BeautifyFactory,
        item: ASTImportCodeExpression,
        _data: TransformerDataObject
      ): void {
        const injections = injectImport(this.transformer.context, item);

        for (let index = 0; index < injections.length; index++) {
          this.tokens.push({
            type: TokenType.Text,
            value: injections[index],
            ref: item
          });
          if (index !== injections.length - 1)
            this.tokens.push({
              type: TokenType.EndOfLine,
              value: '\n',
              ref: item
            });
        }
      }
    };
  }
}
