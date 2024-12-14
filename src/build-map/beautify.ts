import {
  BeautifyFactory as BasicBeautifyFactory,
  BeautifyOptions,
  BeautifyUtils,
  createExpressionHash,
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
          this.pushSegment(' ' + init.operator + '= ');
          this.process(unwrap(init.right));
          return;
        }

        this.pushSegment(' = ');

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
          this.pushSegment('bitwise("' + item.operator + '", ', item);
          this.process(item.left);
          this.pushSegment(', ', item);
          this.process(item.right);
          this.pushSegment(')', item);
          return;
        }

        this.process(item.left);
        this.pushSegment(' ' + item.operator + ' ', item);
        this.process(item.right);
      },
      ImportCodeExpression: function (
        this: BeautifyFactory,
        item: ASTImportCodeExpression,
        _data: TransformerDataObject
      ): void {
        const injections = injectImport(this.transformer.context, item);

        for (let index = 0; index < injections.length; index++) {
          this.pushSegment(injections[index], item);
          if (index < injections.length - 1) this.eol();
        }
      }
    };
  }
}
