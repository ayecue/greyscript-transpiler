import {
  ASTAssignmentStatement,
  ASTMemberExpression,
  ASTIdentifier,
  ASTBinaryExpression
} from 'miniscript-core';

import { BeautifyFactory as BasicBeautifyFactory, BeautifyOptions, createExpressionHash, TokenType, TransformerDataObject, TransformerLike, unwrap } from 'greybel-transpiler';
import { ASTImportCodeExpression } from 'greyscript-core';
import { injectImport } from '../utils/inject-imports';
import { SHORTHAND_OPERATORS } from 'greybel-transpiler/dist/build-map/beautify/utils';

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
          SHORTHAND_OPERATORS.includes(init.operator) &&
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
        this.tokens.push({
          type: TokenType.Text,
          value: injectImport(this.transformer.context, item),
          ref: item
        });
      }
    }
  }
}
