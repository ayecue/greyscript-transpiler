import {
  ASTFeatureEnvarExpression,
  ASTFeatureFileExpression,
  ASTFeatureImportExpression,
  ASTFeatureIncludeExpression,
  ASTFeatureInjectExpression
} from 'greybel-core';
import { Factory, TransformerDataObject } from 'greybel-transpiler';
import { DefaultFactoryOptions } from 'greybel-transpiler/dist/build-map/factory';
import { ASTImportCodeExpression } from 'greyscript-core';
import {
  ASTAssignmentStatement,
  ASTBase,
  ASTBinaryExpression,
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
  ASTParenthesisExpression,
  ASTReturnStatement,
  ASTSliceExpression,
  ASTUnaryExpression,
  ASTWhileStatement,
  ASTNumericLiteral,
  ASTBooleanLiteral
} from 'miniscript-core';
import { basename } from 'path';

import { injectImport } from '../utils/inject-imports';

export const uglifyFactory: Factory<DefaultFactoryOptions> = (transformer) => {
  const { isDevMode = false } = transformer.buildOptions;

  return {
    ParenthesisExpression: (
      item: ASTParenthesisExpression,
      _data: TransformerDataObject
    ): string => {
      const expr = transformer.make(item.expression);

      return '(' + expr + ')';
    },
    Comment: (_item: ASTComment, _data: TransformerDataObject): string => {
      return '';
    },
    AssignmentStatement: (
      item: ASTAssignmentStatement,
      data: TransformerDataObject
    ): string => {
      const varibale = item.variable;
      const init = item.init;
      const left = transformer.make(varibale);
      const right = transformer.make(init, data);

      return left + '=' + right;
    },
    MemberExpression: (
      item: ASTMemberExpression,
      _data: TransformerDataObject
    ): string => {
      const identifier = item.identifier;
      const base = transformer.make(item.base);
      const globalNamespace = transformer.context.variables.get('globals');

      const value = transformer.make(identifier, {
        usesNativeVar:
          base === globalNamespace || base === 'locals' || base === 'outer',
        isMember: true
      });

      return [base, value].join(item.indexer);
    },
    FunctionDeclaration: (
      item: ASTFunctionStatement,
      _data: TransformerDataObject
    ): string => {
      const parameters = [];
      const body = [];
      let parameterItem;
      let bodyItem;

      for (parameterItem of item.parameters) {
        parameters.push(transformer.make(parameterItem, { isArgument: true }));
      }

      for (bodyItem of item.body) {
        const transformed = transformer.make(bodyItem);
        if (transformed === '') continue;
        body.push(transformed);
      }

      if (parameters.length === 0) {
        return 'function\n' + body.join('\n') + '\nend function';
      }

      return (
        'function(' +
        parameters.join(',') +
        ')\n' +
        body.join('\n') +
        '\nend function'
      );
    },
    MapConstructorExpression: (
      item: ASTMapConstructorExpression,
      _data: TransformerDataObject
    ): string => {
      const fields = [];
      let fieldItem;

      for (fieldItem of item.fields) {
        fields.push(transformer.make(fieldItem));
      }

      return '{' + fields.join(',') + '}';
    },
    MapKeyString: (
      item: ASTMapKeyString,
      _data: TransformerDataObject
    ): string => {
      const key = transformer.make(item.key);
      const value = transformer.make(item.value);

      return [key, value].join(':');
    },
    Identifier: (item: ASTIdentifier, data: TransformerDataObject): string => {
      const name = item.name;

      if (data.isMember) {
        if (data.usesNativeVar) {
          return transformer.context.variables.get(name) || name;
        }

        return name;
      }

      return transformer.context.variables.get(name) || name;
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
      { isArgument = false }: TransformerDataObject
    ): string => {
      const literal = transformer.context.literals.get(item);
      if (!isArgument && literal != null && literal.namespace != null)
        return literal.namespace;
      return (item.negated ? '-' : '') + item.value.toString();
    },
    WhileStatement: (
      item: ASTWhileStatement,
      _data: TransformerDataObject
    ): string => {
      const condition = transformer.make(item.condition);
      const body = [];
      let bodyItem;

      for (bodyItem of item.body) {
        const transformed = transformer.make(bodyItem);
        if (transformed === '') continue;
        body.push(transformed);
      }

      return 'while ' + condition + '\n' + body.join('\n') + '\nend while';
    },
    CallExpression: (
      item: ASTCallExpression,
      _data: TransformerDataObject
    ): string => {
      const base = transformer.make(item.base);
      const globalNamespace = transformer.context.variables.get('globals');
      const isNativeVarHasIndex =
        base === globalNamespace + '.hasIndex' ||
        base === 'locals.hasIndex' ||
        base === 'outer.hasIndex';
      let argItem;

      if (isNativeVarHasIndex) {
        argItem = item.arguments[0];

        if (argItem.type === 'StringLiteral') {
          const namespace = (argItem as ASTLiteral).value.toString();
          const optNamespace = transformer.context.variables.get(namespace);
          return base + '("' + (optNamespace ?? namespace) + '")';
        }

        return base + '(' + transformer.make(argItem) + ')';
      }

      const args = [];

      for (argItem of item.arguments) {
        args.push(transformer.make(argItem));
      }

      if (args.length === 0) return base;
      return base + '(' + args.join(',') + ')';
    },
    StringLiteral: (
      item: ASTLiteral,
      { isArgument = false }: TransformerDataObject
    ): string => {
      const literal = transformer.context.literals.get(item);
      if (!isArgument && literal != null && literal.namespace != null)
        return literal.namespace;
      return item.raw.toString();
    },
    SliceExpression: (
      item: ASTSliceExpression,
      _data: TransformerDataObject
    ): string => {
      const base = transformer.make(item.base);
      const left = transformer.make(item.left);
      const right = transformer.make(item.right);

      return base + '[' + [left, right].join(':') + ']';
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
    FeatureDebuggerExpression: (
      _item: ASTBase,
      _data: TransformerDataObject
    ): string => {
      if (isDevMode) return `debugger`;
      return '//debugger';
    },
    FeatureLineExpression: (
      item: ASTBase,
      _data: TransformerDataObject
    ): string => {
      if (isDevMode) return `#line`;
      return `${item.start.line}`;
    },
    FeatureFileExpression: (
      item: ASTFeatureFileExpression,
      _data: TransformerDataObject
    ): string => {
      if (isDevMode) return `#filename`;
      return `"${basename(item.filename).replace(/"/g, '"')}"`;
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

      return clauses.join('\n') + '\nend if';
    },
    IfShortcutClause: (
      item: ASTIfClause,
      _data: TransformerDataObject
    ): string => {
      const condition = transformer.make(item.condition);
      const statement = transformer.make(item.body[0]);

      return 'if ' + condition + ' then\n' + statement;
    },
    ElseifShortcutClause: (
      item: ASTIfClause,
      _data: TransformerDataObject
    ): string => {
      const condition = transformer.make(item.condition);
      const statement = transformer.make(item.body[0]);

      return 'else if ' + condition + ' then\n' + statement;
    },
    ElseShortcutClause: (
      item: ASTElseClause,
      _data: TransformerDataObject
    ): string => {
      const statement = transformer.make(item.body[0]);

      return 'else\n' + statement;
    },
    NilLiteral: (
      item: ASTLiteral,
      { isArgument = false }: TransformerDataObject
    ): string => {
      const literal = transformer.context.literals.get(item);
      if (!isArgument && literal != null && literal.namespace != null)
        return literal.namespace;
      return 'null';
    },
    ForGenericStatement: (
      item: ASTForGenericStatement,
      _data: TransformerDataObject
    ): string => {
      const variable = transformer.make(item.variable);
      const iterator = transformer.make(item.iterator);
      const body = [];
      let bodyItem;

      for (bodyItem of item.body) {
        const transformed = transformer.make(bodyItem);
        if (transformed === '') continue;
        body.push(transformed);
      }

      return (
        'for ' +
        variable +
        ' in ' +
        iterator +
        '\n' +
        body.join('\n') +
        '\nend for'
      );
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

      return clauses.join('\n') + '\nend if';
    },
    IfClause: (item: ASTIfClause, _data: TransformerDataObject): string => {
      const condition = transformer.make(item.condition);
      const body = [];
      let bodyItem;

      for (bodyItem of item.body) {
        const transformed = transformer.make(bodyItem);
        if (transformed === '') continue;
        body.push(transformed);
      }

      return 'if ' + condition + ' then\n' + body.join('\n');
    },
    ElseifClause: (item: ASTIfClause, _data: TransformerDataObject): string => {
      const condition = transformer.make(item.condition);
      const body = [];
      let bodyItem;

      for (bodyItem of item.body) {
        const transformed = transformer.make(bodyItem);
        if (transformed === '') continue;
        body.push(transformed);
      }

      return 'else if ' + condition + ' then\n' + body.join('\n');
    },
    ElseClause: (item: ASTElseClause, _data: TransformerDataObject): string => {
      const body = [];
      let bodyItem;

      for (bodyItem of item.body) {
        const transformed = transformer.make(bodyItem);
        if (transformed === '') continue;
        body.push(transformed);
      }

      return 'else\n' + body.join('\n');
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

      const requireMethodName = transformer.context.variables.get('__REQUIRE');
      return (
        transformer.make(item.name) +
        '=' +
        requireMethodName +
        '("' +
        item.namespace +
        '")'
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
    ListConstructorExpression: (
      item: ASTListConstructorExpression,
      _data: TransformerDataObject
    ): string => {
      const fields = [];
      let fieldItem;

      for (fieldItem of item.fields) {
        fields.push(transformer.make(fieldItem));
      }

      return '[' + fields.join(',') + ']';
    },
    ListValue: (item: ASTListValue, _data: TransformerDataObject): string => {
      return transformer.make(item.value);
    },
    BooleanLiteral: (
      item: ASTBooleanLiteral,
      { isArgument = false }: TransformerDataObject
    ): string => {
      const literal = transformer.context.literals.get(item);
      if (!isArgument && literal != null && literal.namespace != null)
        return literal.namespace;
      return (item.negated ? '-' : '') +  item.raw.toString();
    },
    EmptyExpression: (_item: ASTBase, _data: TransformerDataObject): string => {
      return '';
    },
    IsaExpression: (
      item: ASTIsaExpression,
      _data: TransformerDataObject
    ): string => {
      const left = transformer.make(item.left);
      const right = transformer.make(item.right);

      return left + ' ' + item.operator + ' ' + right;
    },
    LogicalExpression: (
      item: ASTLogicalExpression,
      _data: TransformerDataObject
    ): string => {
      const left = transformer.make(item.left);
      const right = transformer.make(item.right);

      return left + ' ' + item.operator + ' ' + right;
    },
    BinaryExpression: (
      item: ASTBinaryExpression,
      _data: TransformerDataObject
    ): string => {
      const left = transformer.make(item.left);
      const right = transformer.make(item.right);
      const operator = item.operator;
      let expression = left + operator + right;

      if (
        operator === '<<' ||
        operator === '>>' ||
        operator === '>>>' ||
        operator === '|' ||
        operator === '&'
      ) {
        expression =
          'bitwise(' + ['"' + operator + '"', left, right].join(',') + ')';
      }

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

      return segments.join('');
    },
    Chunk: (item: ASTChunk, _data: TransformerDataObject): string => {
      const body = [];
      let bodyItem;

      for (bodyItem of item.body) {
        const transformed = transformer.make(bodyItem);
        if (transformed === '') continue;
        body.push(transformed);
      }

      return body.join('\n');
    },
    ImportCodeExpression: (
      item: ASTImportCodeExpression,
      _data: TransformerDataObject
    ): string => {
      return injectImport(transformer.context, item);
    }
  };
};
