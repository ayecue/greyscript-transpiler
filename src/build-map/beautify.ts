import {
  ASTFeatureEnvarExpression,
  ASTFeatureFileExpression,
  ASTFeatureImportExpression,
  ASTFeatureIncludeExpression,
  ASTFeatureInjectExpression
} from 'greybel-core';
import {
  BeautifyContext,
  BeautifyUtils,
  Factory,
  TransformerDataObject
} from 'greybel-transpiler';
import { BeautifyOptions } from 'greybel-transpiler/dist/build-map/beautify';
import { createExpressionHash } from 'greybel-transpiler/dist/utils/create-expression-hash';
import { ASTImportCodeExpression } from 'greyscript-core';
import {
  ASTAssignmentStatement,
  ASTBase,
  ASTCallExpression,
  ASTCallStatement,
  ASTChunk,
  ASTComment,
  ASTElseClause,
  ASTEvaluationExpression,
  ASTForGenericStatement,
  ASTFunctionStatement,
  ASTIdentifier,
  ASTIfClause,
  ASTIfStatement,
  ASTIndexExpression,
  ASTListConstructorExpression,
  ASTListValue,
  ASTLiteral,
  ASTMapConstructorExpression,
  ASTMapKeyString,
  ASTMemberExpression,
  ASTParenthesisExpression,
  ASTReturnStatement,
  ASTSliceExpression,
  ASTUnaryExpression,
  ASTWhileStatement
} from 'miniscript-core';
import { basename } from 'path';

import { injectImport } from '../utils/inject-imports';
import { transformBitOperation } from './beautify/utils';

const { SHORTHAND_OPERATORS, countEvaluationExpressions, unwrap } =
  BeautifyUtils;

export enum IndentationType {
  Tab,
  Whitespace
}

export const beautifyFactory: Factory<BeautifyOptions> = (transformer) => {
  const {
    isDevMode = false,
    keepParentheses = false,
    indentation = IndentationType.Tab,
    indentationSpaces = 2
  } = transformer.buildOptions;
  const ctx = new BeautifyContext(transformer, {
    keepParentheses,
    indentation,
    indentationSpaces,
    isDevMode
  });

  return {
    ParenthesisExpression: (
      item: ASTParenthesisExpression,
      _data: TransformerDataObject
    ): string => {
      const expr = transformer.make(item.expression);

      if (/\n/.test(expr) && !/,(?!\n)/.test(expr)) {
        ctx.incIndent();
        const expr = ctx.putIndent(transformer.make(item.expression), 1);
        ctx.decIndent();
        return '(\n' + expr + ')';
      }

      return '(' + expr + ')';
    },
    Comment: (item: ASTComment, _data: TransformerDataObject): string => {
      if (item.isMultiline) {
        if (isDevMode) {
          return `/*${item.value}*/`;
        }

        return item.value
          .split('\n')
          .map((line) => `//${line}`)
          .join('\n');
      }

      return '// ' + item.value.trimStart();
    },
    AssignmentStatement: (
      item: ASTAssignmentStatement,
      _data: TransformerDataObject
    ): string => {
      const varibale = item.variable;
      const init = item.init;
      const left = transformer.make(varibale);

      // might can create shorthand for expression
      if (
        isDevMode &&
        (varibale instanceof ASTIdentifier ||
          varibale instanceof ASTMemberExpression) &&
        init instanceof ASTEvaluationExpression &&
        (init.left instanceof ASTIdentifier ||
          init.left instanceof ASTMemberExpression) &&
        SHORTHAND_OPERATORS.includes(init.operator) &&
        createExpressionHash(varibale) === createExpressionHash(init.left)
      ) {
        const right = transformer.make(unwrap(init.right));
        return left + ' ' + init.operator + '= ' + right;
      }

      const right = transformer.make(init);

      return left + ' = ' + right;
    },
    MemberExpression: (
      item: ASTMemberExpression,
      _data: TransformerDataObject
    ): string => {
      const identifier = transformer.make(item.identifier);
      const base = transformer.make(item.base);

      return [base, identifier].join(item.indexer);
    },
    FunctionDeclaration: (
      item: ASTFunctionStatement,
      _data: TransformerDataObject
    ): string => {
      ctx.disableMultiline();
      const parameters = item.parameters.map((item) => transformer.make(item));
      ctx.enableMultiline();

      const blockStart = ctx.appendComment(
        item.start,
        parameters.length === 0
          ? 'function'
          : 'function(' + parameters.join(', ') + ')'
      );
      const blockEnd = ctx.putIndent('end function');

      ctx.incIndent();
      const body = ctx.buildBlock(item);
      ctx.decIndent();

      return blockStart + '\n' + body.join('\n') + '\n' + blockEnd;
    },
    MapConstructorExpression: (
      item: ASTMapConstructorExpression,
      _data: TransformerDataObject
    ): string => {
      if (item.fields.length === 0) {
        return '{}';
      }

      if (item.fields.length === 1) {
        const field = transformer.make(item.fields[0]);
        return ctx.appendComment(item.fields[0].end, '{ ' + field + ' }');
      }

      if (ctx.isMultilineAllowed) {
        const fields = [];
        const blockEnd = ctx.putIndent(ctx.appendComment(item.start, '}'));

        ctx.incIndent();

        for (let index = item.fields.length - 1; index >= 0; index--) {
          const fieldItem = item.fields[index];
          fields.unshift(
            ctx.appendComment(fieldItem.end, transformer.make(fieldItem) + ',')
          );
        }

        ctx.decIndent();

        const blockStart = ctx.appendComment(item.start, '{');

        return (
          blockStart +
          '\n' +
          fields.map((field) => ctx.putIndent(field, 1)).join('\n') +
          '\n' +
          blockEnd
        );
      }

      const fields = [];
      let fieldItem;
      const blockStart = '{';
      const blockEnd = ctx.appendComment(item.start, '}');

      for (fieldItem of item.fields) {
        fields.push(transformer.make(fieldItem));
      }

      return (
        blockStart +
        ' ' +
        fields.map((field) => ctx.putIndent(field, 1)).join(', ') +
        ' ' +
        blockEnd
      );
    },
    MapKeyString: (
      item: ASTMapKeyString,
      _data: TransformerDataObject
    ): string => {
      const key = transformer.make(item.key);
      const value = transformer.make(item.value);

      return [key, value].join(': ');
    },
    Identifier: (item: ASTIdentifier, _data: TransformerDataObject): string => {
      return item.name;
    },
    ReturnStatement: (
      item: ASTReturnStatement,
      _data: TransformerDataObject
    ): string => {
      const arg = item.argument ? transformer.make(item.argument) : '';
      return 'return ' + arg;
    },
    NumericLiteral: (
      item: ASTLiteral,
      _data: TransformerDataObject
    ): string => {
      return item.value.toString();
    },
    WhileStatement: (
      item: ASTWhileStatement,
      _data: TransformerDataObject
    ): string => {
      const condition = transformer.make(unwrap(item.condition));
      const blockStart = ctx.appendComment(item.start, 'while ' + condition);
      const blockEnd = ctx.putIndent('end while');

      ctx.incIndent();

      const body = ctx.buildBlock(item);

      ctx.decIndent();

      return blockStart + '\n' + body.join('\n') + '\n' + blockEnd;
    },
    CallExpression: (
      item: ASTCallExpression,
      data: TransformerDataObject
    ): string => {
      const base = transformer.make(item.base);

      if (item.arguments.length === 0) {
        return base;
      }

      if (item.arguments.length > 3 && ctx.isMultilineAllowed) {
        let argItem;
        const args = [];

        ctx.incIndent();

        for (argItem of item.arguments) {
          args.push(transformer.make(argItem));
        }

        ctx.decIndent();

        return (
          base +
          '(\n' +
          args.map((item) => ctx.putIndent(item, 1)).join(',\n') +
          ')'
        );
      }

      const args = item.arguments.map((argItem) => transformer.make(argItem));
      const argStr = args.join(', ');

      if (/\n/.test(argStr) && !/,(?!\n)/.test(argStr)) {
        ctx.incIndent();
        const args = item.arguments.map((argItem) => transformer.make(argItem));
        ctx.decIndent();
        const argStr = args.join(', ');

        return base + '(\n' + ctx.putIndent(argStr, 1) + ')';
      }

      return data.isCommand && !keepParentheses
        ? base + ' ' + argStr
        : base + '(' + argStr + ')';
    },
    StringLiteral: (item: ASTLiteral, _data: TransformerDataObject): string => {
      return item.raw.toString();
    },
    SliceExpression: (
      item: ASTSliceExpression,
      _data: TransformerDataObject
    ): string => {
      const base = transformer.make(item.base);
      const left = transformer.make(item.left);
      const right = transformer.make(item.right);

      return base + '[' + [left, right].join(' : ') + ']';
    },
    IndexExpression: (
      item: ASTIndexExpression,
      _data: TransformerDataObject
    ): string => {
      const base = transformer.make(item.base);
      const index = transformer.make(item.index);

      return base + '[' + index + ']';
    },
    UnaryExpression: (
      item: ASTUnaryExpression,
      _data: TransformerDataObject
    ): string => {
      const arg = transformer.make(item.argument);

      if (item.operator === 'new') return item.operator + ' ' + arg;

      return item.operator + arg;
    },
    NegationExpression: (
      item: ASTUnaryExpression,
      _data: TransformerDataObject
    ): string => {
      const arg = transformer.make(item.argument);

      return 'not ' + arg;
    },
    FeatureEnvarExpression: (
      item: ASTFeatureEnvarExpression,
      _data: TransformerDataObject
    ): string => {
      if (isDevMode) return `#envar ${item.name}`;
      const value = transformer.environmentVariables.get(item.name);
      if (!value) return 'null';
      return `"${value}"`;
    },
    IfShortcutStatement: (
      item: ASTIfStatement,
      _data: TransformerDataObject
    ): string => {
      const clauses = [];
      let clausesItem;

      for (clausesItem of item.clauses) {
        clauses.push(transformer.make(clausesItem));
      }

      return clauses.join(' ');
    },
    IfShortcutClause: (
      item: ASTIfClause,
      _data: TransformerDataObject
    ): string => {
      const condition = transformer.make(unwrap(item.condition));
      const statement = transformer.make(item.body[0]);

      return 'if ' + condition + ' then ' + statement;
    },
    ElseifShortcutClause: (
      item: ASTIfClause,
      _data: TransformerDataObject
    ): string => {
      const condition = transformer.make(unwrap(item.condition));
      const statement = transformer.make(item.body[0]);

      return 'else if ' + condition + ' then ' + statement;
    },
    ElseShortcutClause: (
      item: ASTElseClause,
      _data: TransformerDataObject
    ): string => {
      const statement = transformer.make(item.body[0]);
      return 'else ' + statement;
    },
    NilLiteral: (_item: ASTLiteral, _data: TransformerDataObject): string => {
      return 'null';
    },
    ForGenericStatement: (
      item: ASTForGenericStatement,
      _data: TransformerDataObject
    ): string => {
      const variable = transformer.make(unwrap(item.variable));
      const iterator = transformer.make(unwrap(item.iterator));
      const blockStart = ctx.appendComment(
        item.start,
        'for ' + variable + ' in ' + iterator
      );
      const blockEnd = ctx.putIndent('end for');

      ctx.incIndent();

      const body = ctx.buildBlock(item);

      ctx.decIndent();

      return blockStart + '\n' + body.join('\n') + '\n' + blockEnd;
    },
    IfStatement: (
      item: ASTIfStatement,
      _data: TransformerDataObject
    ): string => {
      const clauses = [];
      let clausesItem;

      for (clausesItem of item.clauses) {
        clauses.push(transformer.make(clausesItem));
      }

      return clauses.join('\n') + '\n' + ctx.putIndent('end if');
    },
    IfClause: (item: ASTIfClause, _data: TransformerDataObject): string => {
      const condition = transformer.make(unwrap(item.condition));
      const blockStart = ctx.appendComment(
        item.start,
        'if ' + condition + ' then'
      );

      ctx.incIndent();

      const body = ctx.buildBlock(item);

      ctx.decIndent();

      return blockStart + '\n' + body.join('\n');
    },
    ElseifClause: (item: ASTIfClause, _data: TransformerDataObject): string => {
      const condition = transformer.make(unwrap(item.condition));
      const blockStart = ctx.appendComment(
        item.start,
        ctx.putIndent('else if') + ' ' + condition + ' then'
      );

      ctx.incIndent();

      const body = ctx.buildBlock(item);

      ctx.decIndent();

      return blockStart + '\n' + body.join('\n');
    },
    ElseClause: (item: ASTElseClause, _data: TransformerDataObject): string => {
      const blockStart = ctx.appendComment(item.start, ctx.putIndent('else'));

      ctx.incIndent();

      const body = ctx.buildBlock(item);

      ctx.decIndent();

      return blockStart + '\n' + body.join('\n');
    },
    ContinueStatement: (
      _item: ASTBase,
      _data: TransformerDataObject
    ): string => {
      return 'continue';
    },
    BreakStatement: (_item: ASTBase, _data: TransformerDataObject): string => {
      return 'break';
    },
    CallStatement: (
      item: ASTCallStatement,
      _data: TransformerDataObject
    ): string => {
      return transformer.make(item.expression);
    },
    FeatureInjectExpression: (
      item: ASTFeatureInjectExpression,
      _data: TransformerDataObject
    ): string => {
      if (isDevMode) return `#inject "${item.path}";`;
      if (transformer.currentDependency === null)
        return `#inject "${item.path}";`;

      const content = transformer.currentDependency.injections.get(item.path);

      if (content == null) return 'null';

      return `"${content.replace(/"/g, '""')}"`;
    },
    FeatureImportExpression: (
      item: ASTFeatureImportExpression,
      _data: TransformerDataObject
    ): string => {
      if (isDevMode)
        return (
          '#import ' +
          transformer.make(item.name) +
          ' from "' +
          item.path +
          '";'
        );
      if (!item.chunk)
        return (
          '#import ' +
          transformer.make(item.name) +
          ' from "' +
          item.path +
          '";'
        );

      return (
        transformer.make(item.name) + ' = __REQUIRE("' + item.namespace + '")'
      );
    },
    FeatureIncludeExpression: (
      item: ASTFeatureIncludeExpression,
      _data: TransformerDataObject
    ): string => {
      if (isDevMode) return '#include "' + item.path + '";';
      if (!item.chunk) return '#include "' + item.path + '";';

      return transformer.make(item.chunk);
    },
    FeatureDebuggerExpression: (
      _item: ASTBase,
      _data: TransformerDataObject
    ): string => {
      if (isDevMode) return 'debugger';
      return '//debugger';
    },
    FeatureLineExpression: (
      item: ASTBase,
      _data: TransformerDataObject
    ): string => {
      if (isDevMode) return '#line';
      return `${item.start.line}`;
    },
    FeatureFileExpression: (
      item: ASTFeatureFileExpression,
      _data: TransformerDataObject
    ): string => {
      if (isDevMode) return '#filename';
      return `"${basename(item.filename).replace(/"/g, '"')}"`;
    },
    ListConstructorExpression: (
      item: ASTListConstructorExpression,
      _data: TransformerDataObject
    ): string => {
      if (item.fields.length === 0) {
        return '[]';
      }

      if (item.fields.length === 1) {
        const field = transformer.make(item.fields[0]);
        return ctx.appendComment(item.fields[0].end, '[ ' + field + ' ]');
      }

      const fields = [];
      let fieldItem;

      if (ctx.isMultilineAllowed) {
        const blockEnd = ctx.putIndent(ctx.appendComment(item.end, ']'));

        ctx.incIndent();

        for (let index = item.fields.length - 1; index >= 0; index--) {
          const fieldItem = item.fields[index];
          fields.unshift(
            ctx.appendComment(fieldItem.end, transformer.make(fieldItem) + ',')
          );
        }

        ctx.decIndent();

        const blockStart = ctx.appendComment(item.start, '[');

        return (
          blockStart +
          '\n' +
          fields.map((field) => ctx.putIndent(field, 1)).join('\n') +
          '\n' +
          blockEnd
        );
      }

      const blockEnd = ctx.putIndent(ctx.appendComment(item.end, ']'));
      const blockStart = '[';

      for (fieldItem of item.fields) {
        fields.push(transformer.make(fieldItem));
      }

      return blockStart + ' ' + fields.join(', ') + ' ' + blockEnd;
    },
    ListValue: (item: ASTListValue, _data: TransformerDataObject): string => {
      return transformer.make(item.value);
    },
    BooleanLiteral: (
      item: ASTLiteral,
      _data: TransformerDataObject
    ): string => {
      return item.raw.toString();
    },
    EmptyExpression: (_item: ASTBase, _data: TransformerDataObject): string => {
      return '';
    },
    IsaExpression: (
      item: ASTEvaluationExpression,
      _data: TransformerDataObject
    ): string => {
      const left = transformer.make(item.left);
      const right = transformer.make(item.right);

      return left + ' ' + item.operator + ' ' + right;
    },
    LogicalExpression: (
      item: ASTEvaluationExpression,
      data: TransformerDataObject
    ): string => {
      const count = data.isInEvalExpression
        ? 0
        : countEvaluationExpressions(item);

      if (count > 3 || data.isEvalMultiline) {
        if (!data.isEvalMultiline) ctx.incIndent();

        const left = transformer.make(item.left, {
          isInEvalExpression: true,
          isEvalMultiline: true
        });
        const right = transformer.make(item.right, {
          isInEvalExpression: true,
          isEvalMultiline: true
        });
        const operator = item.operator;
        const expression = left + ' ' + operator + '\n' + ctx.putIndent(right);

        if (!data.isEvalMultiline) ctx.decIndent();

        return expression;
      }

      const left = transformer.make(item.left, { isInEvalExpression: true });
      const right = transformer.make(item.right, { isInEvalExpression: true });

      return left + ' ' + item.operator + ' ' + right;
    },
    BinaryExpression: (
      item: ASTEvaluationExpression,
      data: TransformerDataObject
    ): string => {
      const count = data.isInBinaryExpression
        ? 0
        : countEvaluationExpressions(item);

      if (count > 3 || data.isEvalMultiline) {
        if (!data.isEvalMultiline) ctx.incIndent();

        const left = transformer.make(item.left, {
          isInEvalExpression: true,
          isEvalMultiline: true
        });
        const right = transformer.make(item.right, {
          isInEvalExpression: true,
          isEvalMultiline: true
        });
        const operator = item.operator;
        const expression = transformBitOperation(
          left + ' ' + operator + '\n' + ctx.putIndent(right),
          left,
          right,
          operator
        );

        if (!data.isEvalMultiline) ctx.decIndent();

        return expression;
      }

      const left = transformer.make(item.left, { isInEvalExpression: true });
      const right = transformer.make(item.right, { isInEvalExpression: true });
      const operator = item.operator;
      const expression = transformBitOperation(
        left + ' ' + operator + ' ' + right,
        left,
        right,
        operator
      );

      return expression;
    },
    BinaryNegatedExpression: (
      item: ASTUnaryExpression,
      _data: TransformerDataObject
    ): string => {
      const arg = transformer.make(item.argument);
      const operator = item.operator;

      return operator + arg;
    },
    Chunk: (item: ASTChunk, _data: TransformerDataObject): string => {
      ctx.pushLines(item.lines);
      const body = ctx.buildBlock(item).join('\n');
      ctx.popLines();
      return body;
    },
    ImportCodeExpression: (
      item: ASTImportCodeExpression,
      _data: TransformerDataObject
    ): string => {
      return injectImport(transformer.context, item);
    }
  };
};
