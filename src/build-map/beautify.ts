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
  ASTBinaryExpression,
  ASTBooleanLiteral,
  ASTCallExpression,
  ASTCallStatement,
  ASTChunk,
  ASTComment,
  ASTComparisonGroupExpression,
  ASTElseClause,
  ASTForGenericStatement,
  ASTFunctionStatement,
  ASTIdentifier,
  ASTIfClause,
  ASTIfStatement,
  ASTIndexExpression,
  ASTIsaExpression,
  ASTListConstructorExpression,
  ASTListValue,
  ASTLiteral,
  ASTLogicalExpression,
  ASTMapConstructorExpression,
  ASTMapKeyString,
  ASTMemberExpression,
  ASTNumericLiteral,
  ASTParenthesisExpression,
  ASTReturnStatement,
  ASTSliceExpression,
  ASTUnaryExpression,
  ASTWhileStatement
} from 'miniscript-core';
import { basename } from 'path';

import { injectImport } from '../utils/inject-imports';
import { transformBitOperation } from './beautify/utils';

const {
  SHORTHAND_OPERATORS,
  countRightBinaryExpressions,
  unwrap,
  containsMultilineItemInShortcutClauses,
  hasEmptyBody
} = BeautifyUtils;

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
      data: TransformerDataObject
    ): string => {
      const commentAtEnd = ctx.useComment(item.end);
      const expr = transformer.make(item.expression, {
        hasLogicalIndentActive: data.hasLogicalIndentActive
      });

      return '(' + expr + ')' + commentAtEnd;
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
        init instanceof ASTBinaryExpression &&
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

      if (hasEmptyBody(item.body)) {
        return blockStart + '\n' + blockEnd;
      }

      ctx.incIndent();
      const body = ctx.buildBlock(item);
      ctx.decIndent();

      return blockStart + '\n' + body.join('\n') + '\n' + blockEnd;
    },
    MapConstructorExpression: (
      item: ASTMapConstructorExpression,
      _data: TransformerDataObject
    ): string => {
      const commentStart = ctx.useComment(item.start);
      const commentEnd = ctx.useComment(item.end);

      if (item.fields.length === 0) {
        return '{}' + commentStart;
      }

      if (item.fields.length === 1) {
        const field = transformer.make(item.fields[0]);
        return '{ ' + field + ' }' + commentStart;
      }

      if (ctx.isMultilineAllowed) {
        const fields = [];
        const blockEnd = ctx.putIndent(
          '}' + commentEnd
        );

        ctx.incIndent();

        for (let index = item.fields.length - 1; index >= 0; index--) {
          const fieldItem = item.fields[index];
          fields.unshift(
            ctx.appendComment(
              fieldItem.end,
              transformer.make(fieldItem) + ','
            )
          );
        }

        ctx.decIndent();

        const blockStart = '{' + commentStart;

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
      const blockEnd = '}' + commentStart;

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
      item: ASTNumericLiteral,
      _data: TransformerDataObject
    ): string => {
      return (item.negated ? '-' : '') + item.value.toString();
    },
    WhileStatement: (
      item: ASTWhileStatement,
      _data: TransformerDataObject
    ): string => {
      const commentAtStart = ctx.useComment(item.start);
      const condition = transformer.make(unwrap(item.condition));
      const blockStart = 'while ' + condition + commentAtStart;
      const blockEnd = ctx.putIndent('end while');

      if (hasEmptyBody(item.body)) {
        return blockStart + '\n' + blockEnd;
      }

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
      const commentAtEnd = ctx.useComment(item.end);

      if (item.arguments.length === 0) {
        return base + commentAtEnd;
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
          ')' +
          commentAtEnd
        );
      }

      const args = item.arguments.map((argItem) => transformer.make(argItem));
      const argStr = args.join(', ');

      if (/\n/.test(argStr) && !/,(?!\n)/.test(argStr)) {
        ctx.incIndent();
        const args = item.arguments.map((argItem) => transformer.make(argItem));
        ctx.decIndent();
        const argStr = args.join(', ');

        return base + '(\n' + ctx.putIndent(argStr, 1) + ')' + commentAtEnd;
      }

      return data.isCommand && !keepParentheses
        ? base + ' ' + argStr + commentAtEnd
        : base + '(' + argStr + ')' + commentAtEnd;
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
      data: TransformerDataObject
    ): string => {
      const commentAtEnd = data.isCommand ? ctx.useComment(item.index.end) : '';
      const base = transformer.make(item.base);
      const index = transformer.make(item.index);

      return base + '[' + index + ']' + commentAtEnd;
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
      const commentAtEnd = !containsMultilineItemInShortcutClauses(
        item.start,
        item.clauses
      )
        ? ctx.useComment(item.start)
        : '';
      let clausesItem;

      for (clausesItem of item.clauses) {
        clauses.push(transformer.make(clausesItem));
      }

      return clauses.join(' ') + commentAtEnd;
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
      const commentAtStart = ctx.useComment(item.start);
      const variable = transformer.make(unwrap(item.variable));
      const iterator = transformer.make(unwrap(item.iterator));
      const blockStart = 'for ' + variable + ' in ' + iterator + commentAtStart;
      const blockEnd = ctx.putIndent('end for');

      if (hasEmptyBody(item.body)) {
        return blockStart + '\n' + blockEnd;
      }

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
      const commentAtStart = ctx.useComment(item.start);
      const condition = transformer.make(unwrap(item.condition));
      const blockStart = 'if ' + condition + ' then' + commentAtStart;

      ctx.incIndent();

      const body = ctx.buildBlock(item);

      ctx.decIndent();

      return blockStart + '\n' + body.join('\n');
    },
    ElseifClause: (item: ASTIfClause, _data: TransformerDataObject): string => {
      const commentAtStart = ctx.useComment(item.start);
      const condition = transformer.make(unwrap(item.condition));
      const blockStart =
        ctx.putIndent('else if') + ' ' + condition + ' then' + commentAtStart;

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
      return transformer.make(item.expression, { isCommand: true });
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
      const commentStart = ctx.useComment(item.start);
      const commentEnd = ctx.useComment(item.end);

      if (item.fields.length === 0) {
        return '[]' + commentStart;
      }

      if (item.fields.length === 1) {
        const field = transformer.make(item.fields[0]);
        return '[ ' + field + ' ]' + commentStart;
      }

      const fields = [];
      let fieldItem;

      if (ctx.isMultilineAllowed) {
        const blockEnd = ctx.putIndent(
          ']' + commentEnd
        );

        ctx.incIndent();

        for (let index = item.fields.length - 1; index >= 0; index--) {
          const fieldItem = item.fields[index];
          fields.unshift(
            ctx.appendComment(
              fieldItem.end,
              transformer.make(fieldItem) + ','
            )
          );
        }

        ctx.decIndent();

        const blockStart = '[' + commentStart;

        return (
          blockStart +
          '\n' +
          fields.map((field) => ctx.putIndent(field, 1)).join('\n') +
          '\n' +
          blockEnd
        );
      }

      const blockEnd = ctx.putIndent(']' + commentStart);
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
      item: ASTBooleanLiteral,
      _data: TransformerDataObject
    ): string => {
      return (item.negated ? '-' : '') + item.raw.toString();
    },
    EmptyExpression: (_item: ASTBase, _data: TransformerDataObject): string => {
      return '';
    },
    IsaExpression: (
      item: ASTIsaExpression,
      data: TransformerDataObject
    ): string => {
      const left = transformer.make(item.left, {
        hasLogicalIndentActive: data.hasLogicalIndentActive
      });
      const right = transformer.make(item.right, {
        hasLogicalIndentActive: data.hasLogicalIndentActive
      });

      return left + ' ' + item.operator + ' ' + right;
    },
    LogicalExpression: (
      item: ASTLogicalExpression,
      data: TransformerDataObject
    ): string => {
      const count = countRightBinaryExpressions(item.right);

      if (count > 2) {
        if (!data.hasLogicalIndentActive) ctx.incIndent();

        const left = transformer.make(item.left, {
          hasLogicalIndentActive: true
        });
        const right = transformer.make(item.right, {
          hasLogicalIndentActive: true
        });
        const operator = item.operator;
        const expression = left + ' ' + operator + '\n' + ctx.putIndent(right);

        if (!data.hasLogicalIndentActive) ctx.decIndent();

        return expression;
      }

      const left = transformer.make(item.left, {
        hasLogicalIndentActive: data.hasLogicalIndentActive
      });
      const right = transformer.make(item.right, {
        hasLogicalIndentActive: data.hasLogicalIndentActive
      });

      return left + ' ' + item.operator + ' ' + right;
    },
    BinaryExpression: (
      item: ASTBinaryExpression,
      data: TransformerDataObject
    ): string => {
      const left = transformer.make(item.left, {
        hasLogicalIndentActive: data.hasLogicalIndentActive
      });
      const right = transformer.make(item.right, {
        hasLogicalIndentActive: data.hasLogicalIndentActive
      });
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
    ComparisonGroupExpression: (
      item: ASTComparisonGroupExpression,
      _data: TransformerDataObject
    ): string => {
      const expressions: string[] = item.expressions.map((it) =>
        transformer.make(it)
      );
      const segments: string[] = [expressions[0]];

      for (let index = 0; index < item.operators.length; index++) {
        segments.push(item.operators[index], expressions[index + 1]);
      }

      return segments.join(' ');
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
