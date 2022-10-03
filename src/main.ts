import * as ts from 'typescript';
import * as tstl from 'typescript-to-lua';

const plugin: tstl.Plugin = {
	visitors: {
		[ts.SyntaxKind.ExportAssignment](node, context) {
			if (ts.isArrayLiteralExpression(node.expression)) {
				const expressions: tstl.Expression[] = [];

				for (const element of node.expression.elements) {
					expressions.push(context.transformExpression(element));
				}

				return tstl.createReturnStatement(expressions, node);
			}

			return context.superTransformStatements(node);
		},
	},
};

export default plugin;
